'use strict';

// Loaded into the test backend with `node -r`. Replaces llm/client with a deterministic
// stand-in so runs need no API keys and give the same answer every time.
//
// It behaves like a model that *tries* to do what the user asks, using only the tools it
// was offered. If the wanted tool was not offered, it says so in plain text, which is the
// honest outcome of per-persona tool filtering. A message starting "FORCE:<tool>" makes
// it call that tool regardless, simulating a manipulated model, to show the second
// check at execution time still refuses.

const fs = require('fs');
const path = require('path');
const Module = require('module');

const LOG = process.env.E2E_LLM_LOG;

const INTENTS = [
  [/record.*payment|payment.*record/i, 'payment.record', { amount: 5400, method: 'cash' }],
  [/record.*payout|pay.*teacher/i, 'payout.record', { amount: 20000, method: 'bank', period_start: '2026-10-01', period_end: '2026-10-31' }],
  [/profit|p&l|finance summary|finance/i, 'finance.summary', {}],
  [/revenue/i, 'report.revenue', { from_date: '2026-10-01', to_date: '2026-10-31' }],
  [/overdue|unpaid|low credit|who owes/i, 'reminder.payment', {}],
  [/fee|price|cost/i, 'fee.query', { instrument: 'Keyboard' }],
  [/active students|list students|all students/i, 'student.list', {}],
  [/schedule|timing/i, 'batch.schedule', { batch_id: 'Keyboard' }],
  [/payout|salary/i, 'teacher.payout', { teacher_id: 'Ravi Kumar' }],
];

const text = (t) => ({
  content: JSON.stringify({ type: 'text', text: t, suggestions: ['What can you do?'], card: null }),
  tool_calls: [],
  finish_reason: 'stop',
});

const toolCall = (name, args) => ({
  content: null,
  tool_calls: [{ id: `mock-${Date.now()}`, type: 'function', function: { name, arguments: JSON.stringify(args) } }],
  finish_reason: 'tool_calls',
});

async function callLLM({ messages, tools = [] }) {
  const last = [...messages].reverse().find(m => m.role === 'user');
  const message = typeof last?.content === 'string' ? last.content : '';
  const offered = tools.map(t => t.function.name);
  const system = messages.find(m => m.role === 'system')?.content || '';
  const persona = (system.match(/Role: ([a-z ]+?) —/) || [])[1] || 'unknown';

  let result;
  let wanted = null;
  const forced = message.match(/^FORCE:([a-z_.]+)/i);
  if (forced) {
    wanted = forced[1];
    result = toolCall(wanted, { student_id: 'Priya Singh', amount: 5400, method: 'cash', package_id: '00000000-0000-0000-0000-000000000000' });
  } else {
    const hit = INTENTS.find(([re]) => re.test(message));
    if (hit) {
      wanted = hit[1];
      result = offered.includes(wanted)
        ? toolCall(wanted, hit[2])
        : text("I can't do that for your role. I can help with the things on your menu.");
    } else {
      result = text('I can help with attendance, students, schedules and fees depending on your role.');
    }
  }

  if (LOG) {
    fs.appendFileSync(LOG, JSON.stringify({
      at: new Date().toISOString(), persona, message, wanted, offered_count: offered.length, offered,
      outcome: result.tool_calls.length ? `tool_call:${result.tool_calls[0].function.name}` : 'text',
    }) + '\n');
  }
  return result;
}

const original = Module._load;
Module._load = function patched(request, parent, isMain) {
  const resolved = (() => { try { return Module._resolveFilename(request, parent); } catch { return ''; } })();
  if (resolved.endsWith(path.join('llm', 'client.js'))) {
    return { callLLM, isProviderConfigured: () => true };
  }
  return original.apply(this, arguments);
};
