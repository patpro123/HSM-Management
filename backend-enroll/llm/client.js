'use strict';

const https = require('https');

const GROQ_API_KEY    = process.env.GROQ_API_KEY;
const GEMINI_API_KEY  = process.env.GEMINI_API_KEY;
const XAI_API_KEY     = process.env.XAI_API_KEY;
const DEFAULT_PROVIDER  = process.env.LLM_PROVIDER          || 'groq';
const FALLBACK_PROVIDER = process.env.LLM_FALLBACK_PROVIDER  || 'groq';
const OLLAMA_HOST     = process.env.OLLAMA_HOST || 'http://localhost:11434';
const GROQ_MODEL      = process.env.GROQ_MODEL  || 'llama-3.1-8b-instant';
const GEMINI_MODEL    = process.env.GEMINI_MODEL || 'gemini-2.0-flash';
const XAI_MODEL       = process.env.XAI_MODEL   || 'grok-3-mini';

const postJson = (urlString, payload, headers = {}) => new Promise((resolve, reject) => {
  const url    = new URL(urlString);
  const body   = JSON.stringify(payload);
  const reqHeaders = {
    'Content-Type':   'application/json',
    'Content-Length': Buffer.byteLength(body),
    ...headers,
  };

  const options = {
    method:   'POST',
    hostname: url.hostname,
    port:     url.port || 443,
    path:     url.pathname + (url.search || ''),
    headers:  reqHeaders,
  };

  const req = https.request(options, (res) => {
    let data = '';
    res.on('data', (chunk) => { data += chunk; });
    res.on('end', () => {
      if (res.statusCode >= 400) {
        const err = new Error(`HTTP ${res.statusCode}`);
        err.statusCode = res.statusCode;
        err.body = data;
        return reject(err);
      }
      try { resolve({ status: res.statusCode, data: JSON.parse(data) }); }
      catch (e) { reject(new Error('Invalid JSON from LLM provider')); }
    });
  });
  req.on('error', reject);
  req.write(body);
  req.end();
});

const withRetry = async (fn, retries = 2) => {
  try {
    return await fn();
  } catch (err) {
    if (retries > 0 && err.statusCode && [429, 503].includes(err.statusCode)) {
      const delay = err.statusCode === 429 ? 3000 : 1000;
      await new Promise(r => setTimeout(r, delay));
      return withRetry(fn, retries - 1);
    }
    throw err;
  }
};

const callGroq = (messages, tools) => withRetry(() =>
  postJson(
    'https://api.groq.com/openai/v1/chat/completions',
    {
      model:       GROQ_MODEL,
      messages,
      tools:       tools && tools.length ? tools : undefined,
      tool_choice: tools && tools.length ? 'auto' : undefined,
    },
    { Authorization: `Bearer ${GROQ_API_KEY}` }
  ).then(({ data }) => {
    const choice  = data.choices[0];
    const message = choice.message;
    return {
      content:      message.content || null,
      tool_calls:   message.tool_calls || [],
      finish_reason: choice.finish_reason,
    };
  })
);

const callGemini = (messages, tools) => withRetry(() => {
  const systemMsg = messages.find(m => m.role === 'system');
  const turns     = messages.filter(m => m.role !== 'system');

  const contents = turns.map(m => ({
    role:  m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: typeof m.content === 'string' ? m.content : JSON.stringify(m.content) }],
  }));

  const body = {
    contents,
    systemInstruction: systemMsg
      ? { parts: [{ text: systemMsg.content }] }
      : undefined,
    generationConfig: { responseMimeType: 'application/json' },
  };

  if (tools && tools.length) {
    body.tools = [{
      functionDeclarations: tools.map(t => ({
        name:        t.function.name,
        description: t.function.description,
        parameters:  t.function.parameters,
      })),
    }];
  }

  return postJson(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`,
    body
  ).then(({ data }) => {
    const candidate = data.candidates[0];
    const part      = candidate.content.parts[0];

    if (part.functionCall) {
      return {
        content:    null,
        tool_calls: [{
          id:       `gemini-${Date.now()}`,
          type:     'function',
          function: { name: part.functionCall.name, arguments: JSON.stringify(part.functionCall.args) },
        }],
        finish_reason: 'tool_calls',
      };
    }

    return {
      content:      part.text || null,
      tool_calls:   [],
      finish_reason: 'stop',
    };
  });
});

// xAI (Grok) — same OpenAI-compatible format as Groq, different base URL
const callXAI = (messages, tools) => withRetry(() =>
  postJson(
    'https://api.x.ai/v1/chat/completions',
    {
      model:       XAI_MODEL,
      messages,
      tools:       tools && tools.length ? tools : undefined,
      tool_choice: tools && tools.length ? 'auto' : undefined,
    },
    { Authorization: `Bearer ${XAI_API_KEY}` }
  ).then(({ data }) => {
    const choice  = data.choices[0];
    const message = choice.message;
    return {
      content:      message.content || null,
      tool_calls:   message.tool_calls || [],
      finish_reason: choice.finish_reason,
    };
  })
);

const callOllama = (messages) => {
  const prompt = messages.map(m => `${m.role}: ${m.content}`).join('\n');
  const http   = require('http');
  return new Promise((resolve, reject) => {
    const body = JSON.stringify({ model: process.env.OLLAMA_MODEL || 'llama3', prompt, stream: false });
    const url  = new URL(`${OLLAMA_HOST}/api/generate`);
    const req  = http.request({
      method: 'POST', hostname: url.hostname,
      port: url.port || 11434, path: url.pathname,
      headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) },
    }, (res) => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ content: parsed.response || '', tool_calls: [] });
        } catch (e) { reject(e); }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
};

/**
 * @param {object} opts
 * @param {Array}  opts.messages   - OpenAI-style [{role, content}]
 * @param {Array}  [opts.tools]    - OpenAI-style tool definitions
 * @param {string} [opts.provider] - 'groq' | 'gemini' | 'xai' | 'ollama'
 * @returns {Promise<{ content: string|null, tool_calls: Array }>}
 */
const callProvider = (provider, messages, tools) => {
  switch (provider) {
    case 'groq':   return callGroq(messages, tools);
    case 'gemini': return callGemini(messages, tools);
    case 'xai':    return callXAI(messages, tools);
    case 'ollama': return callOllama(messages);
    default:       throw new Error(`Unknown LLM provider: ${provider}`);
  }
};

const callLLM = async ({ messages, tools = [], provider = DEFAULT_PROVIDER }) => {
  try {
    return await callProvider(provider, messages, tools);
  } catch (err) {
    const isRateLimited = err.statusCode === 429;
    const fallback = FALLBACK_PROVIDER;
    if (isRateLimited && fallback && fallback !== provider) {
      console.warn(`[LLM] ${provider} rate-limited — falling back to ${fallback}`);
      return callProvider(fallback, messages, tools);
    }
    throw err;
  }
};

module.exports = { callLLM };
