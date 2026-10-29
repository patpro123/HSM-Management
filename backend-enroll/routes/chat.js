'use strict';

const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateJWT } = require('../auth/jwtMiddleware');
const { callLLM } = require('../llm/client');
const { skills, TOOL_DEFINITIONS, ACTION_SKILLS } = require('../llm/skills');
const { getPrompt } = require('../llm/prompts');
const { resolvePersona, canUseTool, toolsForPersona } = require('../auth/actionPermissions');
const { checkRateLimit, getCached, setCached } = require('../llm/rateLimit');

const { tryAttendanceCommand, parseSummaryCommand } = require('../llm/attendanceCommands');

const SESSION_TTL_DAYS = 7;
const MAX_HISTORY_MESSAGES = 20;

// Attendance command replies carry a full student list for follow-up commands;
// the LLM doesn't need it, so drop the card to save tokens.
function withoutAttendanceContext(msg) {
  if (msg.role !== 'assistant' || typeof msg.content !== 'string' || !msg.content.includes('attendance_context')) return msg;
  try {
    const parsed = JSON.parse(msg.content);
    return { ...msg, content: JSON.stringify({ ...parsed, card: null }) };
  } catch {
    return msg;
  }
}

// POST /api/chat
router.post('/', authenticateJWT, async (req, res) => {
  const { message, session_id } = req.body;

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ error: 'message is required' });
  }
  if (message.trim().length > 500) {
    return res.status(400).json({ error: 'message too long (max 500 chars)' });
  }

  const userId = req.user.id;
  const userName = req.user.name || null;
  const userRole = resolvePersona(req.user.roles) || 'parent';
  const provider = process.env.LLM_PROVIDER || 'groq';

  // Short-circuit greetings — no LLM call needed
  const GREETING_RE = /^\s*(hi|hello|hey|yo|howdy|good\s+(morning|afternoon|evening|day)|namaste|hola|greetings|what'?s\s+up|wassup)\s*[!?.]*\s*$/i;
  if (GREETING_RE.test(message.trim())) {
    const firstName = userName ? userName.split(' ')[0] : 'there';
    return res.json({
      session_id: null,
      type: 'text',
      text: `Hey ${firstName}! 🎵 I'm Cleff, your musical sidekick at HSM. What can I play for you today?`,
      suggestions: ["Today's attendance", 'Active students', 'Payment status', 'What can you do?'],
      card: null,
    });
  }

  try {
    // Load or create session
    let session = null;
    if (session_id) {
      const result = await pool.query(
        `SELECT * FROM chat_sessions WHERE session_id = $1 AND user_id = $2 AND expires_at > NOW()`,
        [session_id, userId]
      );
      session = result.rows[0] || null;
    }

    if (!session) {
      const result = await pool.query(
        `INSERT INTO chat_sessions (user_id, role, messages, expires_at)
         VALUES ($1, $2, '[]'::jsonb, NOW() + INTERVAL '${SESSION_TTL_DAYS} days')
         RETURNING *`,
        [userId, userRole]
      );
      session = result.rows[0];
    }

    const history = Array.isArray(session.messages) ? session.messages : [];
    const trimmed = history.slice(-MAX_HISTORY_MESSAGES);

    const saveHistory = (botResponse) => pool.query(
      `UPDATE chat_sessions SET messages = $1::jsonb, updated_at = NOW() WHERE session_id = $2`,
      [JSON.stringify([
        ...trimmed,
        { role: 'user', content: message.trim() },
        { role: 'assistant', content: JSON.stringify(botResponse) },
      ].slice(-MAX_HISTORY_MESSAGES)), session.session_id]
    );

    // Fixed-format attendance commands — no LLM call, not rate limited
    const commandResponse = await tryAttendanceCommand({ message: message.trim(), user: req.user, history: trimmed });
    if (commandResponse) {
      await saveHistory(commandResponse);
      return res.json({ session_id: session.session_id, ...commandResponse });
    }

    // "Today's attendance" and similar — answered by the stats skill directly, no LLM call
    const summary = parseSummaryCommand(message.trim());
    if (summary && canUseTool(userRole, 'stats.attendance')) {
      const summaryResponse = await skills['stats.attendance']({ params: summary, userId, userRole, user: req.user, pool });
      await saveHistory(summaryResponse);
      return res.json({ session_id: session.session_id, ...summaryResponse });
    }

    // Rate limit check
    const allowed = await checkRateLimit(userId, userRole, pool);
    if (!allowed) {
      return res.status(429).json({
        type: 'error',
        text: 'Daily chat limit reached. Please try again tomorrow.',
        suggestions: [],
        card: null,
      });
    }

    const systemPrompt = getPrompt(userRole, new Date(), userName);
    const llmMessages = [
      { role: 'system', content: systemPrompt },
      ...trimmed.map(withoutAttendanceContext),
      { role: 'user', content: message.trim() },
    ];

    // Cache hit for identical lookup requests
    const cacheKey = `${userId}:${message.trim().toLowerCase()}`;
    const cached = getCached(cacheKey);
    if (cached) {
      return res.json({ session_id: session.session_id, ...cached });
    }

    // First LLM call
    let llmResponse = await callLLM({ messages: llmMessages, tools: toolsForPersona(TOOL_DEFINITIONS, userRole), provider });
    let botResponse = null;

    if (llmResponse.tool_calls && llmResponse.tool_calls.length > 0) {
      const toolCall = llmResponse.tool_calls[0];
      const skillName = toolCall.function.name;

      let skillParams;
      try {
        skillParams = typeof toolCall.function.arguments === 'string'
          ? JSON.parse(toolCall.function.arguments)
          : toolCall.function.arguments;
        skillParams = skillParams || {};
      } catch (e) {
        skillParams = {};
      }

      const skillHandler = skills[skillName];
      if (!skillHandler) {
        botResponse = { type: 'error', text: `Unknown skill: ${skillName}`, suggestions: [], card: null };
      } else if (!canUseTool(userRole, skillName)) {
        // The model can only name tools it was shown, but never trust that: check again here.
        console.warn(`[chat] ${userRole} ${userId} attempted ${skillName}`);
        botResponse = { type: 'error', text: "You don't have access to that.", suggestions: ['What can you do?'], card: null };
      } else {
        const skillResult = await skillHandler({ params: skillParams, userId, userRole, user: req.user, pool });

        // Always return skill result directly — skip second LLM call to halve token usage.
        botResponse = skillResult;
      }
    } else {
      try {
        botResponse = JSON.parse(llmResponse.content);
      } catch (e) {
        botResponse = {
          type: 'text',
          text: llmResponse.content || 'I could not understand that. Could you rephrase?',
          suggestions: ['Start over', 'What can you do?'],
          card: null,
        };
      }
    }

    // Cache pure lookups for 5 minutes
    const isLookup = !llmResponse.tool_calls?.some(tc => ACTION_SKILLS.has(tc.function.name));
    if (isLookup && botResponse.type !== 'error') {
      setCached(cacheKey, botResponse);
    }

    await saveHistory(botResponse);

    return res.json({ session_id: session.session_id, ...botResponse });

  } catch (err) {
    console.error('[POST /api/chat] Error:', err.message, err.body || '');
    return res.status(500).json({
      type: 'error',
      text: 'Something went wrong. Please try again.',
      suggestions: ['Try again'],
      card: null,
    });
  }
});

// GET /api/chat/sessions/:id
router.get('/sessions/:id', authenticateJWT, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT session_id, role, messages, created_at, updated_at
       FROM chat_sessions WHERE session_id = $1 AND user_id = $2 AND expires_at > NOW()`,
      [req.params.id, req.user.id]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Session not found or expired' });
    res.json({ session: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load session' });
  }
});

// DELETE /api/chat/sessions/:id
router.delete('/sessions/:id', authenticateJWT, async (req, res) => {
  try {
    await pool.query(
      `DELETE FROM chat_sessions WHERE session_id = $1 AND user_id = $2`,
      [req.params.id, req.user.id]
    );
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete session' });
  }
});

module.exports = router;
