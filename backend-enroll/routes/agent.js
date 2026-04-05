const express = require('express');
const router = express.Router();
const crypto = require('crypto');
const http = require('http');
const https = require('https');

const REQUIRED_FIELDS = ['fullName', 'dob', 'phone', 'guardianContact', 'instruments', 'dateOfJoining'];
const PAYMENT_OPTIONS = ['Monthly', 'Quarterly'];
const LLM_PROVIDER = process.env.LLM_PROVIDER || 'ollama';
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3';

// In-memory session store for conversational enrollment
const enrollmentSessions = new Map();

const safeJsonExtract = (text) => {
  if (!text || typeof text !== 'string') return null;
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch (err) {
    console.warn('Failed to parse JSON from LLM response');
    return null;
  }
};

const postJson = (urlString, payload) => new Promise((resolve, reject) => {
  const url = new URL(urlString);
  const isHttps = url.protocol === 'https:';
  const body = JSON.stringify(payload);
  const options = {
    method: 'POST',
    hostname: url.hostname,
    port: url.port || (isHttps ? 443 : 80),
    path: url.pathname,
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
  };
  const client = isHttps ? https : http;
  const req = client.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      if (res.statusCode && res.statusCode >= 400) {
        return reject(new Error(`LLM HTTP ${res.statusCode}`));
      }
      try {
        resolve(JSON.parse(data));
      } catch (err) {
        reject(new Error('Invalid JSON from LLM'));
      }
    });
  });
  req.on('error', reject);
  req.write(body);
  req.end();
});

const callOllama = async (prompt) => {
  const response = await postJson(`${OLLAMA_HOST}/api/generate`, { model: OLLAMA_MODEL, prompt, stream: false });
  return response && response.response ? response.response : '';
};

const runLLM = async (prompt) => {
  if (!prompt) return '';
  if (LLM_PROVIDER === 'ollama') return callOllama(prompt);
  return '';
};

const fallbackExtract = (message) => {
  const result = {};
  if (!message || typeof message !== 'string') return result;
  const phoneMatch = message.match(/\+?\d[\d\s-]{8,}/);
  const emailMatch = message.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const dateMatch = message.match(/\b\d{4}-\d{2}-\d{2}\b/);
  const nameMatch = message.match(/name is ([A-Za-z\s]+)/i);
  if (phoneMatch) result.phone = phoneMatch[0].trim();
  if (emailMatch) result.email = emailMatch[0].trim();
  if (dateMatch) result.dob = dateMatch[0];
  if (nameMatch) result.fullName = nameMatch[1].trim();
  return result;
};

const mergeCollected = (current, incoming) => {
  const merged = { ...current };
  if (!incoming || typeof incoming !== 'object') return merged;
  for (const [key, value] of Object.entries(incoming)) {
    if (value === undefined || value === null) continue;
    if (key === 'instruments' && Array.isArray(value)) {
      merged.instruments = Array.isArray(merged.instruments) ? merged.instruments : [];
      value.forEach((entry) => {
        if (!entry || typeof entry !== 'object') return;
        if (!entry.instrument) return;
        const normalizedPayment = entry.payment_plan && PAYMENT_OPTIONS.includes(entry.payment_plan) ? entry.payment_plan : null;
        const normalized = {
          instrument: entry.instrument,
          batch_preference: entry.batch_preference || entry.batch,
          payment_plan: normalizedPayment
        };
        merged.instruments.push(normalized);
      });
    } else {
      merged[key] = value;
    }
  }
  return merged;
};

const detectMissing = (collected) => {
  const missing = [];
  if (!collected.fullName) missing.push('fullName');
  if (!collected.dob) missing.push('dob');
  if (!collected.phone) missing.push('phone');
  if (!collected.guardianContact) missing.push('guardianContact');
  if (!collected.dateOfJoining) missing.push('dateOfJoining');
  if (!Array.isArray(collected.instruments) || collected.instruments.length === 0) {
    missing.push('instruments');
  } else {
    collected.instruments.forEach((item, idx) => {
      if (!item.instrument) missing.push(`instruments[${idx}].instrument`);
      if (!item.batch_preference) missing.push(`instruments[${idx}].batch_preference`);
      if (!item.payment_plan) missing.push(`instruments[${idx}].payment_plan (Monthly/Quarterly)`);
    });
  }
  return missing;
};

const buildClarification = (missing) => {
  if (!missing.length) return 'All required fields captured. Reply CONFIRM to proceed to enrollment.';
  return `Need these details: ${missing.join(', ')}. Please provide them in natural language.`;
};

const buildPrompt = (message, collected) => {
  const context = collected && Object.keys(collected).length ? JSON.stringify(collected) : 'none';
  return [
    'You are an enrollment assistant for a music school.',
    'Extract structured data as JSON. Only return JSON.',
    'Fields: fullName, dob (YYYY-MM-DD), phone, guardianContact, email, address, dateOfJoining (YYYY-MM-DD), instruments [{instrument, batch_preference, payment_plan (Monthly|Quarterly)}].',
    'Keep values short and do not invent data.',
    `Existing context: ${context}`,
    `User message: ${message}`,
    'Return JSON only.'
  ].join('\n');
};

// POST /api/agent/enroll - conversational enrollment via LLM guidance
router.post('/enroll', async (req, res) => {
  const { sessionId, message } = req.body || {};
  if (!message) return res.status(400).json({ error: 'message is required' });

  const sid = sessionId || crypto.randomUUID();
  const session = enrollmentSessions.get(sid) || { collected: {}, history: [] };

  let llmExtract = null;
  try {
    const llmResponse = await runLLM(buildPrompt(message, session.collected));
    llmExtract = safeJsonExtract(llmResponse);
  } catch (err) {
    console.warn('LLM call failed, using heuristics only', err.message);
  }

  const heuristicExtract = fallbackExtract(message);
  const merged = mergeCollected(session.collected, llmExtract);
  const mergedWithFallback = mergeCollected(merged, heuristicExtract);

  const missing = detectMissing(mergedWithFallback);
  const prompt = buildClarification(missing);

  session.collected = mergedWithFallback;
  session.history.push({ user: message, extracted: mergedWithFallback, missing });
  enrollmentSessions.set(sid, session);

  res.json({
    sessionId: sid,
    collected: session.collected,
    missing,
    prompt,
    readyForSubmission: missing.length === 0
  });
});

module.exports = router;
