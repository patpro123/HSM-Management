'use strict';

const express = require('express');
const router  = express.Router();
const pool    = require('../db');
const { authenticateJWT } = require('../auth/jwtMiddleware');
const { callLLM }         = require('../llm/client');
const { skills, TOOL_DEFINITIONS, ACTION_SKILLS } = require('../llm/skills');
const { getPrompt }       = require('../llm/prompts');
const { checkRateLimit, getCached, setCached } = require('../llm/rateLimit');

const SESSION_TTL_DAYS     = 7;
const MAX_HISTORY_MESSAGES = 20;

// POST /api/chat
router.post('/', authenticateJWT, async (req, res) => {
  const { message, session_id } = req.body;

  if (!message || typeof message !== 'string' || message.trim().length === 0) {
    return res.status(400).json({ error: 'message is required' });
  }
  if (message.trim().length > 500) {
    return res.status(400).json({ error: 'message too long (max 500 chars)' });
  }

  const userId   = req.user.id;
  const userName = req.user.name || null;
  const userRole = (req.user.roles || []).find(r => ['admin', 'teacher', 'student', 'parent'].includes(r)) || 'parent';
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

    const systemPrompt = getPrompt(userRole, new Date(), userName);
    const llmMessages  = [
      { role: 'system',    content: systemPrompt },
      ...trimmed,
      { role: 'user',      content: message.trim() },
    ];

    // Cache hit for identical lookup requests
    const cacheKey = `${userId}:${message.trim().toLowerCase()}`;
    const cached   = getCached(cacheKey);
    if (cached) {
      return res.json({ session_id: session.session_id, ...cached });
    }

    // First LLM call
    let llmResponse = await callLLM({ messages: llmMessages, tools: TOOL_DEFINITIONS, provider });
    let botResponse = null;

    if (llmResponse.tool_calls && llmResponse.tool_calls.length > 0) {
      const toolCall  = llmResponse.tool_calls[0];
      const skillName = toolCall.function.name;

      let skillParams;
      try {
        skillParams = typeof toolCall.function.arguments === 'string'
          ? JSON.parse(toolCall.function.arguments)
          : toolCall.function.arguments;
      } catch (e) {
        skillParams = {};
      }

      const skillHandler = skills[skillName];
      if (!skillHandler) {
        botResponse = { type: 'error', text: `Unknown skill: ${skillName}`, suggestions: [], card: null };
      } else {
        const skillResult = await skillHandler({ params: skillParams, userId, userRole, pool });

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

    // Persist updated message history
    const updatedMessages = [
      ...trimmed,
      { role: 'user',      content: message.trim() },
      { role: 'assistant', content: JSON.stringify(botResponse) },
    ].slice(-MAX_HISTORY_MESSAGES);

    await pool.query(
      `UPDATE chat_sessions SET messages = $1::jsonb, updated_at = NOW() WHERE session_id = $2`,
      [JSON.stringify(updatedMessages), session.session_id]
    );

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
