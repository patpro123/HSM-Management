'use strict';

const express = require('express');
const router  = express.Router();
const { callLLM } = require('../llm/client');

// ── In-memory IP rate limit ───────────────────────────────────────────────────
const ipMap = new Map(); // ip → { count, resetAt }
const IP_LIMIT  = 40;
const IP_WINDOW = 60 * 60 * 1000; // 1 hour

function checkIpLimit(ip) {
  const now = Date.now();
  const entry = ipMap.get(ip);
  if (!entry || now > entry.resetAt) {
    ipMap.set(ip, { count: 1, resetAt: now + IP_WINDOW });
    return true;
  }
  if (entry.count >= IP_LIMIT) return false;
  entry.count++;
  return true;
}

// Prune old entries every 30 min
setInterval(() => {
  const now = Date.now();
  for (const [ip, e] of ipMap.entries()) {
    if (now > e.resetAt) ipMap.delete(ip);
  }
}, 30 * 60 * 1000);

// ── System prompt ─────────────────────────────────────────────────────────────
const SYSTEM_PROMPT = `You are Cleff — a friendly, musical chatbot for Hyderabad School of Music (HSM).
Your job: warmly answer visitor questions and nudge them to book a FREE demo class.

School Facts:
- Name: Hyderabad School of Music (HSM)
- Location: Kismatpur, Hyderabad (near Bandlaguda, Rajendranagar). All classes are in-person only.
- Working Hours: Closed on Mondays. Tue–Fri 5 PM–9 PM | Sat 3 PM–9 PM | Sun 10 AM–1 PM & 5 PM–9 PM
- Instruments (8 total): Guitar, Keyboard, Piano, Drums, Tabla, Violin, Hindustani Vocals, Carnatic Vocals
- Age range: 5 years to 60+. Absolute beginners welcome — zero prior experience needed.
- Packages: Trial pack (4 classes, starting ₹2000) or Quarterly (24 classes). There is NO monthly package.
- Every instrument: 2 classes per week, each class is 45 minutes to 1 hour.
- First demo class is completely FREE. No commitment, no payment required to try.
- Flexible pause policy — life happens and we understand.
- Students play their first song within 4–6 weeks typically.

Tone: Warm, enthusiastic, musical. Use a light music metaphor occasionally but keep it natural.
Length: 2–3 sentences max per reply. Be concise.
Goal: After answering, gently nudge towards the free demo if relevant.

CRITICAL: Respond ONLY with valid JSON — no markdown, no code fences, nothing else:
{"text":"...","suggestions":["...","...","..."],"cta":null}

Set "cta" to "book_demo" when the visitor asks about enrolling, fees, demos, or shows any interest in joining.
Suggestions should be short follow-up questions (max 3, max 5 words each).`;

const MAX_HISTORY = 10;

// ── POST /api/public/chat ─────────────────────────────────────────────────────
router.post('/', async (req, res) => {
  const ip = req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';

  if (!checkIpLimit(ip)) {
    return res.status(429).json({
      text: "You've sent quite a few messages! Come back in an hour or just book your free demo right now — we'd love to have you.",
      suggestions: ['Book free demo'],
      cta: 'book_demo',
    });
  }

  const { message, history = [] } = req.body;
  if (!message || typeof message !== 'string' || !message.trim()) {
    return res.status(400).json({ error: 'message is required' });
  }
  if (message.trim().length > 400) {
    return res.status(400).json({ error: 'message too long' });
  }

  // Trim + sanitise history
  const trimmed = Array.isArray(history)
    ? history
        .filter(m => m && ['user', 'assistant'].includes(m.role) && typeof m.content === 'string')
        .slice(-MAX_HISTORY)
    : [];

  const messages = [
    { role: 'system',    content: SYSTEM_PROMPT },
    ...trimmed,
    { role: 'user',      content: message.trim() },
  ];

  try {
    const provider = process.env.LLM_PROVIDER || 'groq';
    const llmResp  = await callLLM({ messages, tools: [], provider });
    const raw      = llmResp.content || '';

    let parsed;
    try {
      // Strip accidental markdown fences
      const clean = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
      parsed = JSON.parse(clean);
    } catch {
      parsed = {
        text: raw || "I didn't quite catch that — could you rephrase?",
        suggestions: ['What instruments do you teach?', 'Is the demo free?', 'Where are you located?'],
        cta: null,
      };
    }

    return res.json({
      text:        String(parsed.text        || ''),
      suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions.slice(0, 4) : [],
      cta:         parsed.cta === 'book_demo' ? 'book_demo' : null,
    });
  } catch (err) {
    console.error('[POST /api/public/chat] Error:', err.message);
    return res.status(500).json({
      text: 'Oops, something went off-key on my end. Please try again!',
      suggestions: ['What instruments do you teach?', 'Book a free demo'],
      cta: null,
    });
  }
});

module.exports = router;
