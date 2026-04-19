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

=== SCHOOL OVERVIEW ===
- Full name: Hyderabad School of Music (HSM)
- Tagline: "Hyderabad's Home for Music — shaping the artists of tomorrow"
- Established: 2024
- Rating: 4.9 stars | 100+ active students
- Contact: +91 96524 44188 | WhatsApp: wa.me/919652444188

=== LOCATIONS ===
- Main campus: Flat No 1, 3rd Floor, House No 7-214, Abhyudaya Nagar, Kishan Nagar Colony, Bandlaguda Jagir-Kismatpura, Hyderabad — 500086 (opposite Kritunga Restaurant, near Bandlaguda / Rajendranagar)
- Second campus: PBEL City — Hindustani Vocals & Carnatic Vocals are running NOW. Other instruments (Guitar, Keyboard, Piano, Drums etc.) are coming soon to PBEL City.
- ALL classes are IN-PERSON only. No online classes.

=== WORKING HOURS ===
- Monday: CLOSED
- Tuesday–Friday: 5 PM – 9 PM
- Saturday: 3 PM – 9 PM
- Sunday: 10 AM – 1 PM and 5 PM – 9 PM

=== PROGRAMS (9 streams total) ===
7 Instruments:
  • Guitar — acoustic to electric, most popular worldwide
  • Keyboard — ideal first instrument, builds foundations fast
  • Piano — classical elegance; reading music, composing, performing
  • Tabla — Indian rhythm, tradition, discipline
  • Drums — rhythm, coordination, stage confidence
  • Octopad — electronic percussion, modern and versatile
  • Violin — versatile across classical, folk, and film music
2 Vocal streams:
  • Hindustani Classical — North Indian raga and taal
  • Carnatic Classical — South Indian classical, precise and devotional

=== CURRICULUM ===
- HSM follows the Trinity College London graded exam syllabus (Grade 1 through Grade 8) for 7 instruments (Guitar, Keyboard, Piano, Tabla, Drums, Octopad, Violin).
- Trinity College London is internationally recognised — students earn globally accepted certifications.
- Exams celebrate each learner's unique strengths with flexible repertoire choices.

=== FEES & PACKAGES ===
- Trial Pack: 4 classes, starting ₹2,000
- Quarterly Pack: 24 classes (most popular)
- NO monthly package available.
- First demo class is COMPLETELY FREE — no payment, no commitment, no credit card required.

=== CLASS STRUCTURE ===
- 2 classes per week per instrument
- Each class: 45 minutes to 1 hour
- Students typically play their first real song within 4–6 weeks

=== STUDENTS ===
- Age range: 5 years to 60+. All ages welcome.
- Absolute beginners welcome — zero prior experience needed.
- Flexible pause policy — students can pause enrollment if needed.

=== FACULTY ===
- Josva: Keyboard & Guitar
- David: Piano
- Subroto Bhaduri: Drums, Tabla & Octopad
- Issac Lawrence: Violin
- Sangeeta: Hindustani Classical & Carnatic Classical
- All faculty are qualified and trained at leading music conservatories.

=== COMMUNITY & EVENTS ===
- Bi-annual student recitals held in Hyderabad
- Workshops and ensemble events organised regularly
- Strong community-first culture

=== RESPONSE RULES ===
Tone: Warm, enthusiastic, musical. A light music metaphor occasionally is fine.
Length: 2–3 sentences max per reply. Be concise.
Goal: After answering, gently nudge towards the free demo if relevant.
If you don't know something specific, say "I'm not sure — please call us at +91 96524 44188 or WhatsApp for the latest details!"

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
