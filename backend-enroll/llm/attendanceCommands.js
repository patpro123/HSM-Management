'use strict';

// Deterministic Cleff commands for attendance — handled without any LLM call.
//
//   "Get all students for <instrument> for date <date> [at <time>] [teacher <name>]"
//     → lists every student in that instrument's classes on that date
//       (also "guitar students today", "list keyboard students for 28 Oct")
//   "All students today" / "today's students" / "all students for 28 Oct at 5pm"
//     → the same list across every instrument's classes on that date
//   "Set students <names> as absent and rest as present"
//   "Mark all present except <names>"
//     → marks attendance for the students in the most recent list in this chat
//
// The list response carries an `attendance_context` in its card, which is persisted
// in the chat history so a later "set …" command knows which students "the rest" means.

const pool = require('../db');
const svc = require('../services/attendanceService');
const { isOperationsStaff, canMarkAttendanceOn, canUseTool, resolvePersona } = require('../auth/actionPermissions');

const makeResponse = (type, text, suggestions = [], card = null) =>
  ({ type, text, suggestions, card });

const STATUSES = ['present', 'absent', 'excused'];
const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const WEEKDAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const USAGE =
  'Try:\n' +
  '• "Get all students for Keyboard for date today"\n' +
  '• "Set students Riya, Arjun as absent and rest as present"\n' +
  '• "Mark all present except Riya"';

// ── Dates ────────────────────────────────────────────────────────────────────

function isoFromParts(y, m, d) {
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null;
  return dt.toISOString().slice(0, 10);
}

function addDays(iso, n) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

const MONTH_NAMES = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

// Accepts a month name or any prefix of it of 3+ letters ("oct", "sept", "october"), not "octember".
function monthIndex(word) {
  const w = word.toLowerCase();
  const i = MONTHS.indexOf(w.slice(0, 3));
  return i === -1 || !MONTH_NAMES[i].startsWith(w) ? null : i + 1;
}

// Parses "today", "yesterday", "2026-10-28", "28/10", "28/10/2026", "28 Oct", "Oct 28",
// "tuesday" / "last tuesday" (most recent such day). Returns YYYY-MM-DD or null.
function parseDate(text, today = svc.todayIST()) {
  const t = String(text || '').trim().toLowerCase().replace(/[.,!?]+$/, '').replace(/\s+/g, ' ');
  if (!t || t === 'today' || t === 'tonight') return today;
  if (t === 'yesterday') return addDays(today, -1);
  if (t === 'tomorrow') return addDays(today, 1);

  const [ty] = today.split('-').map(Number);
  let m;

  if ((m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/))) return isoFromParts(+m[1], +m[2], +m[3]);

  if ((m = t.match(/^(\d{1,2})[/.-](\d{1,2})(?:[/.-](\d{2}|\d{4}))?$/))) {
    const y = m[3] ? (m[3].length === 2 ? 2000 + +m[3] : +m[3]) : ty;
    return isoFromParts(y, +m[2], +m[1]);
  }

  if ((m = t.match(/^(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]{3,})(?:\s+(\d{4}))?$/))) {
    const mo = monthIndex(m[2]);
    return mo ? isoFromParts(m[3] ? +m[3] : ty, mo, +m[1]) : null;
  }

  if ((m = t.match(/^([a-z]{3,})\s+(\d{1,2})(?:st|nd|rd|th)?(?:\s+(\d{4}))?$/))) {
    const mo = monthIndex(m[1]);
    return mo ? isoFromParts(m[3] ? +m[3] : ty, mo, +m[2]) : null;
  }

  if ((m = t.match(/^(last\s+)?([a-z]{3,})$/))) {
    const wd = WEEKDAYS.indexOf(m[2].slice(0, 3));
    if (wd === -1 || !'sunday monday tuesday wednesday thursday friday saturday'.split(' ')[wd].startsWith(m[2])) return null;
    const [y, mo, d] = today.split('-').map(Number);
    const todayDow = new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
    let back = (todayDow - wd + 7) % 7;
    if (back === 0 && m[1]) back = 7;
    return addDays(today, -back);
  }

  return null;
}

function formatDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC',
  });
}

// "5pm" → { hour: 17, minute: null }, "17:30" → { hour: 17, minute: 30 }.
// Without am/pm, hours before 9 are read as afternoon (classes run 10:00–21:00).
function parseTime(text) {
  const m = String(text).trim().toLowerCase().match(/^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/);
  if (!m) return null;
  let hour = +m[1];
  if (m[3] === 'pm' && hour < 12) hour += 12;
  if (m[3] === 'am' && hour === 12) hour = 0;
  if (!m[3] && hour < 9) hour += 12;
  return { hour, minute: m[2] != null ? +m[2] : null };
}

// ── Parsers (pure) ───────────────────────────────────────────────────────────

const LIST_RE = /^\s*(?:get|show|list|fetch)\s+(?:me\s+)?(?:all\s+)?(?:the\s+)?students\s+(?:for|in|of)\s+(.+?)(?:\s+(?:for|on)\s+(?:the\s+)?(?:date\s+)?(.+?))?\s*[.?!]*\s*$/i;
// Instrument before "students": "guitar students today", "list keyboard students for 28 Oct at 5pm"
const LOOSE_LIST_RE = /^\s*(?:(?:get|show|list|fetch)\s+(?:me\s+)?(?:all\s+)?(?:the\s+)?)?(?:(.+?)\s+)?students\b(?:\s+(?:for|on)\s+(?:the\s+)?(?:date\s+)?|\s+)?(.*?)\s*[.?!]*\s*$/i;
// Where the instrument would be, these mean every class on the date
const ALL_INSTRUMENTS_RE = /^(?:all|all the|every|everyone|everybody)?$/i;

// "guitar today" → ['guitar', 'today']; text that doesn't end in a date comes back unchanged
function splitTrailingDate(text) {
  const words = text.split(/\s+/);
  for (let n = Math.min(3, words.length - 1); n >= 1; n--) {
    const dateText = words.slice(-n).join(' ');
    if (parseDate(dateText)) return [words.slice(0, -n).join(' '), dateText];
  }
  return [text, ''];
}

// Optional trailing filters, in either order: "at 5pm", "teacher Mriganka" / "with Mriganka".
// Returns { rest, time, teacher } with the filters removed from the end of s.
function takeFilters(s) {
  let time = null;
  let teacher = null;
  for (let i = 0; i < 2; i++) {
    let f;
    // Time first: it's anchored at the end, so "teacher X at 5pm" doesn't read "X at 5pm" as the teacher
    if (!time && (f = s.match(/^(.*?)\s*\bat\s+(\d{1,2}(?::\d{2})?\s*(?:am|pm)?)$/i))) { time = f[2].trim(); s = f[1].trim(); continue; }
    if (!teacher && (f = s.match(/^(.*?)\s*\b(?:teacher|with)\s+(.+)$/i))) { teacher = f[2].trim(); s = f[1].trim(); continue; }
  }
  return { rest: s, time, teacher };
}

// Words that can surround a date in a whole-day request without naming an instrument
const DAY_LIST_FILLER = new Set((
  'get show list fetch give me all the every students student who is are attending have has ' +
  'class classes batch batches session sessions instrument instruments in of for on from scheduled date'
).split(' '));

// "students in today's batches", "who is attending today", "all students for all instruments on 28 Oct":
// the message mentions students, and apart from filler words it is only a date.
function parseDayListCommand(message) {
  const text = String(message).replace(/’/g, "'").replace(/[.?!]+\s*$/, '').trim();
  if (!/\b(?:students?|attending)\b/i.test(text)) return null;
  const { rest, time, teacher } = takeFilters(text);
  const dateText = rest.split(/\s+/)
    .map(w => w.replace(/'s$/i, ''))
    .filter(w => w && !DAY_LIST_FILLER.has(w.toLowerCase()))
    .join(' ');
  if (!dateText || !parseDate(dateText)) return null;
  return { instrumentText: null, dateText, time, teacher };
}

// Returns null if the message isn't a list command. A `loose` result (instrument before
// "students") may just be a question like "active students"; the caller falls through to
// the LLM when its instrument doesn't resolve. instrumentText is null for every class on
// the date ("all students today", "students in today's batches").
function parseListCommand(message) {
  const dayList = parseDayListCommand(message);
  if (dayList) return dayList;

  const strict = String(message).match(LIST_RE);
  const loose = strict ? null : String(message).match(LOOSE_LIST_RE);
  const m = strict || loose;
  if (!m) return null;
  let instrumentText = (m[1] || '').trim();
  let tail = (m[2] || '').trim();
  let time = null;
  let teacher = null;

  // Filters may follow the date or (when no date is given) the instrument
  if (tail) {
    ({ rest: tail, time, teacher } = takeFilters(tail));
  } else {
    ({ rest: instrumentText, time, teacher } = takeFilters(instrumentText));
    // "list all students for today", "today's students": the date sits where the instrument would
    const asDate = instrumentText.replace(/^(?:the\s+)?date\s+/i, '').replace(/['’]s$/i, '');
    if (asDate && parseDate(asDate)) [instrumentText, tail] = ['', asDate];
    else [instrumentText, tail] = splitTrailingDate(instrumentText);
  }

  if (ALL_INSTRUMENTS_RE.test(instrumentText)) {
    if (!tail) return null; // "list all students" is a roster question — leave it to the LLM
    instrumentText = null;
  }
  if (loose && tail && !parseDate(tail)) return null; // "how many students do we have"
  const cmd = { instrumentText, dateText: tail || 'today', time, teacher };
  if (loose) cmd.loose = true;
  return cmd;
}

// "Today's attendance", "attendance summary", "this week's attendance", "attendance stats for this month"
const SUMMARY_RE = /^\s*(?:(?:get|show|give|tell)\s+(?:me\s+)?|what(?:['’]s|\s+is|\s+was)\s+)?(?:the\s+)?(?:(today|this\s+week|this\s+month)(?:['’]?s)?\s+)?attendance(?:\s+(?:summary|stats|statistics|report|overview|numbers|counts?))?(?:\s+(?:for\s+)?(today|this\s+week|this\s+month))?\s*[.?!]*\s*$/i;

// Returns { period: 'today' | 'week' | 'month' } or null
function parseSummaryCommand(message) {
  const m = String(message).match(SUMMARY_RE);
  if (!m) return null;
  const when = (m[1] || m[2] || 'today').toLowerCase();
  return { period: when.endsWith('week') ? 'week' : when.endsWith('month') ? 'month' : 'today' };
}

const MARK_RE = /^\s*(?:set|mark)\s+(?:the\s+)?(?:students?\s+)?(.+?)\s+(?:as\s+)?(present|absent|excused)\b(.*)$/i;
const REST_RE = /^\s*(?:,|and|&)?\s*(?:and\s+)?(?:the\s+)?(?:rest|others|remaining|everyone else|everybody else|all others)(?:\s+(?:of\s+the\s+)?students)?\s+(?:as\s+)?(present|absent|excused)\s*[.!]*\s*$/i;
const EXCEPT_RE = /^\s*,?\s*(?:except|but(?:\s+not)?)\s+(.+?)\s*[.!]*\s*$/i;
const ALL_RE = /^(?:all|everyone|everybody|all\s+students|all\s+of\s+them|them\s+all)$/i;

const splitNames = (s) => s.split(/\s*(?:,|\band\b|&)\s*/i).map(n => n.trim()).filter(Boolean);

// Returns null if the message isn't a mark command, { invalid: true } if it looks like one
// but can't be read, else { all, names, status, restStatus }.
function parseMarkCommand(message) {
  const m = String(message).match(MARK_RE);
  if (!m) return null;
  const namesText = m[1].trim();
  const status = m[2].toLowerCase();
  const tail = m[3].trim();
  const all = ALL_RE.test(namesText);

  if (!tail || /^[.!]+$/.test(tail)) {
    return all ? { all: true, names: [], status, restStatus: null } : { all: false, names: splitNames(namesText), status, restStatus: null };
  }

  let t;
  if (!all && (t = tail.match(REST_RE))) {
    return { all: false, names: splitNames(namesText), status, restStatus: t[1].toLowerCase() };
  }
  if (all && (t = tail.match(EXCEPT_RE))) {
    if (status === 'excused') return { invalid: true };
    // "all present except A, B" → A, B absent and the rest present
    return { all: false, names: splitNames(t[1]), status: status === 'present' ? 'absent' : 'present', restStatus: status };
  }
  return { invalid: true };
}

// ── Name matching (pure) ─────────────────────────────────────────────────────

function levenshtein(a, b) {
  const dp = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
  }
  return dp[a.length][b.length];
}

const norm = (s) => String(s).toLowerCase().replace(/\s+/g, ' ').trim();

// entries: [{ student_id, student_name, time_slot }]. Matches each name to exactly one student.
// Returns { matchedIds: Set, unmatched: [{ name, suggestions }], ambiguous: [{ name, options }] }
function matchNames(names, entries) {
  const students = new Map();
  for (const e of entries) {
    if (!students.has(e.student_id)) students.set(e.student_id, { id: e.student_id, name: e.student_name, slots: [] });
    if (e.time_slot) students.get(e.student_id).slots.push(e.time_slot);
  }
  const list = [...students.values()];

  const matchedIds = new Set();
  const unmatched = [];
  const ambiguous = [];

  for (const raw of names) {
    const q = norm(raw);
    const exact = list.filter(s => norm(s.name) === q);
    const first = list.filter(s => norm(s.name).split(' ')[0] === q);
    const prefix = list.filter(s => norm(s.name).startsWith(q));
    const hits = exact.length ? exact : first.length ? first : prefix;

    if (hits.length === 1) {
      matchedIds.add(hits[0].id);
    } else if (hits.length > 1) {
      ambiguous.push({ name: raw, options: hits.map(s => `${s.name}${s.slots.length ? ` (${s.slots.join(', ')})` : ''}`) });
    } else {
      const suggestions = list
        .map(s => ({ s, d: levenshtein(q, norm(s.name).split(' ')[0]) }))
        .filter(x => x.d <= 2)
        .sort((a, b) => a.d - b.d)
        .slice(0, 3)
        .map(x => x.s.name);
      unmatched.push({ name: raw, suggestions });
    }
  }
  return { matchedIds, unmatched, ambiguous };
}

// Plans the status for each entry. Returns [{ entry, status }] for entries whose status changes.
function planChanges(entries, { all, status, restStatus }, matchedIds) {
  const changes = [];
  for (const e of entries) {
    const next = all || matchedIds.has(e.student_id) ? status : restStatus;
    if (next && next !== e.status) changes.push({ entry: e, status: next });
  }
  return changes;
}

// ── DB-backed helpers ────────────────────────────────────────────────────────

// Returns { instrument } or { error: text }
async function resolveInstrument(db, text) {
  const rows = (await db.query('SELECT id, name FROM instruments ORDER BY name')).rows;
  const q = norm(text);
  const singular = q.replace(/s$/, '');
  const exact = rows.filter(r => norm(r.name) === q || norm(r.name) === singular);
  if (exact.length === 1) return { instrument: exact[0] };
  const partial = rows.filter(r => {
    const n = norm(r.name);
    return n.includes(q) || n.includes(singular) || n.split(' ').some(w => w.startsWith(singular));
  });
  if (partial.length === 1) return { instrument: partial[0] };
  if (partial.length > 1) {
    return { error: `"${text}" could mean ${partial.map(r => r.name).join(' or ')}. Which one?` };
  }
  return { error: `I don't know the instrument "${text}". Instruments: ${rows.map(r => r.name).join(', ')}.` };
}

const flattenEntries = (batches) => batches.flatMap(b =>
  b.students.map(s => ({
    ...s, batch_id: b.batch_id, time_slot: b.time_slot, teacher_name: b.teacher_name, instrument_name: b.instrument_name,
  }))
);

// Stands in for an instrument when a list covers every class on the date
const ALL_CLASSES = { id: null, name: 'All classes' };

const STATUS_LABEL = { present: '✓ Present', absent: '✗ Absent', excused: '~ Excused' };

// List response for a set of batches, carrying the context needed by a follow-up "set" command
function buildListResponse({ heading, instrument, date, batches }) {
  const entries = flattenEntries(batches);
  const counts = { present: 0, absent: 0, excused: 0, unmarked: 0 };
  entries.forEach(e => { counts[e.status || 'unmarked']++; });

  const summary = [
    `${counts.present} present`, `${counts.absent} absent`,
    counts.excused ? `${counts.excused} excused` : null,
    counts.unmarked ? `${counts.unmarked} not marked` : null,
  ].filter(Boolean).join(', ');

  const classes = batches.length === 1 ? '1 class' : `${batches.length} classes`;
  const text = `${heading ? heading + ' ' : ''}${instrument.name} · ${formatDate(date)} — ${entries.length} students in ${classes} (${summary})`;

  const firstName = entries[0]?.student_name.split(' ')[0] || 'Name';
  return makeResponse('list', text,
    [
      'Set all present',
      `Set students ${firstName} as absent and rest as present`,
    ],
    {
      students: entries.map(e => ({
        name: e.student_name,
        secondary: [
          instrument.id ? null : e.instrument_name,
          e.time_slot,
          e.teacher_name ? e.teacher_name.split(' ')[0] : null,
          STATUS_LABEL[e.status] || 'Not marked',
          e.is_guest ? 'out of turn' : null,
        ].filter(Boolean).join(' · '),
        value: '', // tapping a row does nothing
      })),
      attendance_context: {
        date,
        instrument_id: instrument.id,
        instrument_name: instrument.name,
        batch_ids: batches.map(b => b.batch_id),
      },
    }
  );
}

// Most recent attendance_context saved in this chat's history, or null
function findContext(history) {
  for (let i = history.length - 1; i >= 0; i--) {
    const msg = history[i];
    if (msg.role !== 'assistant' || typeof msg.content !== 'string' || !msg.content.includes('attendance_context')) continue;
    try {
      const ctx = JSON.parse(msg.content)?.card?.attendance_context;
      if (ctx?.date && Array.isArray(ctx.batch_ids)) return ctx;
    } catch { /* not JSON */ }
  }
  return null;
}

// Applies a mark plan to the given batches and saves. Shared by the chat command and
// the LLM attendance.mark_batch skill. Returns a bot response.
async function applyMarks({ user, date, instrument, batches, plan }) {
  const entries = flattenEntries(batches);
  let matchedIds = new Set();

  if (!plan.all) {
    const result = matchNames(plan.names, entries);
    if (result.unmatched.length || result.ambiguous.length) {
      const lines = [
        ...result.unmatched.map(u => `• Couldn't find "${u.name}"${u.suggestions.length ? ` — did you mean ${u.suggestions.join(' or ')}?` : ''}`),
        ...result.ambiguous.map(a => `• "${a.name}" matches ${a.options.join(', ')} — use the full name`),
      ];
      return makeResponse('text', `Nothing saved.\n${lines.join('\n')}`, []);
    }
    matchedIds = result.matchedIds;
  }

  const changes = planChanges(entries, plan, matchedIds);
  if (changes.length === 0) {
    return buildListResponse({ heading: 'No changes needed —', instrument, date, batches });
  }

  const roles = user.roles || [];
  if (!canMarkAttendanceOn(roles, date, svc.todayIST())) {
    return makeResponse('text', 'Teachers can only mark attendance for today. Please ask an admin to change a past date.', []);
  }
  let teacherId = null;
  if (!isOperationsStaff(roles)) {
    teacherId = await svc.getLinkedTeacherId(pool, user.id);
    if (!teacherId) {
      return makeResponse('text', "Your account isn't linked to a teacher profile yet, so I can't mark attendance. Please ask an admin.", []);
    }
  }

  const records = changes.map(c => ({
    batch_id: c.entry.batch_id, student_id: c.entry.student_id, date, status: c.status, is_extra: false,
  }));
  const notes = await svc.buildAttendanceNotes(pool, {
    batchIds: [...new Set(records.map(r => r.batch_id))],
    teacherId,
    markerName: user.name || user.email,
    via: 'Cleff',
  });
  await svc.saveAttendanceTransaction(records, notes || new Map());

  const batchIds = new Set(batches.map(b => b.batch_id));
  const fresh = (await svc.getAttendanceByDate(pool, date)).filter(b => batchIds.has(b.batch_id));
  return buildListResponse({
    heading: `Saved ${changes.length} change${changes.length === 1 ? '' : 's'}:`,
    instrument, date, batches: fresh,
  });
}

// ── Command handlers ─────────────────────────────────────────────────────────

async function runList(cmd) {
  const date = parseDate(cmd.dateText);
  if (!date) {
    return makeResponse('text', `I couldn't read the date "${cmd.dateText}". Try today, yesterday, 28/10, 28 Oct or 2026-10-28.`, []);
  }
  let instrument = ALL_CLASSES;
  if (cmd.instrumentText !== null) {
    const resolved = await resolveInstrument(pool, cmd.instrumentText);
    if (resolved.error) return cmd.loose ? null : makeResponse('text', resolved.error, []);
    instrument = resolved.instrument;
  }

  let batches = (await svc.getAttendanceByDate(pool, date))
    .filter(b => (!instrument.id || b.instrument_id === instrument.id) && (b.scheduled || b.students.some(s => s.status)));

  const filters = [];
  if (cmd.time) {
    const t = parseTime(cmd.time);
    if (!t) return makeResponse('text', `I couldn't read the time "${cmd.time}". Try "at 5pm" or "at 17:00".`, []);
    const hh = String(t.hour).padStart(2, '0');
    const prefix = t.minute != null ? `${hh}:${String(t.minute).padStart(2, '0')}` : `${hh}:`;
    batches = batches.filter(b => (b.time_slot || '').startsWith(prefix));
    filters.push(`at ${cmd.time}`);
  }
  if (cmd.teacher) {
    const q = norm(cmd.teacher);
    batches = batches.filter(b => norm(b.teacher_name || '').includes(q));
    filters.push(`with ${cmd.teacher}`);
  }

  if (batches.length === 0) {
    const what = instrument.id ? `${instrument.name} classes` : 'classes';
    return makeResponse('text', `No ${what} on ${formatDate(date)}${filters.length ? ' ' + filters.join(' ') : ''}.`, []);
  }
  return buildListResponse({ instrument, date, batches });
}

async function runMark(cmd, user, history) {
  if (cmd.invalid) return makeResponse('text', `I didn't follow that. ${USAGE}`, []);

  const ctx = findContext(history);
  if (!ctx) {
    return makeResponse('text', 'Which class? First run e.g. "Get all students for Keyboard for date today", then tell me who to mark.', []);
  }
  const batchIds = new Set(ctx.batch_ids);
  const batches = (await svc.getAttendanceByDate(pool, ctx.date)).filter(b => batchIds.has(b.batch_id));
  if (batches.length === 0) {
    return makeResponse('text', 'Those classes have no students any more. Please fetch the list again.', []);
  }
  return applyMarks({
    user,
    date: ctx.date,
    instrument: { id: ctx.instrument_id, name: ctx.instrument_name },
    batches,
    plan: cmd,
  });
}

// Entry point from routes/chat.js. Returns a bot response, or null if the message
// isn't one of these commands (so the caller falls through to the LLM).
async function tryAttendanceCommand({ message, user, history }) {
  if (!canUseTool(resolvePersona(user.roles), 'attendance.mark_batch')) return null;

  const list = parseListCommand(message);
  if (list) {
    const listResponse = await runList(list);
    if (listResponse) return listResponse;
  }

  const mark = parseMarkCommand(message);
  if (mark) return runMark(mark, user, history);

  return null;
}

// LLM skill attendance.mark_batch: { batch_id (instrument / time / UUID), default_status,
// exceptions, session_date }. Covers every class of that instrument on the date.
async function markBatchFromSkill(params, user) {
  const date = params.session_date ? parseDate(params.session_date) : svc.todayIST();
  if (!date) return makeResponse('text', `I couldn't read the date "${params.session_date}".`, []);

  const all = await svc.getAttendanceByDate(pool, date);
  let batches;
  let instrument;
  const raw = String(params.batch_id || '').trim();
  if (UUID_RE.test(raw)) {
    batches = all.filter(b => b.batch_id === raw);
    if (!batches.length) return makeResponse('text', 'That batch has no students on that date.', []);
    instrument = { id: batches[0].instrument_id, name: batches[0].instrument_name };
  } else {
    if (!raw) return makeResponse('text', `Which instrument? ${USAGE}`, []);
    const resolved = await resolveInstrument(pool, raw);
    if (resolved.error) return makeResponse('text', resolved.error, []);
    instrument = resolved.instrument;
    batches = all.filter(b => b.instrument_id === instrument.id && (b.scheduled || b.students.some(s => s.status)));
    if (!batches.length) return makeResponse('text', `No ${instrument.name} classes on ${formatDate(date)}.`, []);
  }

  const defStatus = STATUSES.includes(String(params.default_status).toLowerCase()) ? params.default_status.toLowerCase() : 'present';
  const exceptions = Array.isArray(params.exceptions)
    ? params.exceptions.map(String)
    : typeof params.exceptions === 'string' ? splitNames(params.exceptions) : [];
  const plan = exceptions.length
    ? { all: false, names: exceptions, status: defStatus === 'present' ? 'absent' : 'present', restStatus: defStatus }
    : { all: true, names: [], status: defStatus, restStatus: null };

  return applyMarks({ user, date, instrument, batches, plan });
}

module.exports = {
  tryAttendanceCommand,
  markBatchFromSkill,
  // exported for tests
  parseDate,
  parseTime,
  parseListCommand,
  parseSummaryCommand,
  parseMarkCommand,
  matchNames,
  planChanges,
  findContext,
};
