'use strict';

// Everything Cleff can do with batches. The model only ever supplies names and phrases
// ("Guitar", "Thursday 6pm", "Rahul"); every id is resolved here from the database, and
// every change is raised as a proposal rather than written directly.

const pool = require('../db');
const proposalService = require('../services/proposalService');
const { ServiceError } = require('../services/serviceError');

const makeResponse = (type, text, suggestions = [], card = null) => ({ type, text, suggestions, card });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
const MAX_OPTIONS = 6;

// Does a recurrence like "TUE 17:00-18:00, THU 17:00-18:00" fit a phrase like "Thursday 6pm"?
// Every day and time mentioned in the phrase must appear in the recurrence.
function recurrenceMatches(recurrence, phrase) {
  const rec = String(recurrence).toUpperCase();
  // "17:00-17:45" names a class by its start; drop the range end so it isn't read as a start too.
  const text = String(phrase).toLowerCase().replace(/\s*[-–]\s*\d{1,2}:\d{2}(\s*[ap]m)?/g, '');
  const days = DAYS.filter(d => new RegExp(`\\b${d}`).test(text));
  if (days.some(d => !rec.includes(d.toUpperCase()))) return false;
  const times = [...text.matchAll(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/g)]
    .filter(m => m[3] || m[2] || Number(m[1]) > 12)
    .map(m => {
      let h = Number(m[1]);
      if (m[3] === 'pm' && h < 12) h += 12;
      if (m[3] === 'am' && h === 12) h = 0;
      return `${String(h).padStart(2, '0')}:${m[2] || '00'}`;
    });
  // A time names when the class starts, so match it against slot starts only ("18:00-").
  if (times.some(t => !new RegExp(`(^|[^\\d])${t}\\s*-`).test(rec))) return false;
  return days.length > 0 || times.length > 0;
}

// Non-makeup batches matching any of: instrument name, teacher name, a day/time phrase.
async function findBatches({ instrument, teacher, when }) {
  const rows = (await pool.query(
    `SELECT b.id, b.recurrence, b.capacity, b.instrument_id, b.teacher_id,
            i.name AS instrument, t.name AS teacher,
            COUNT(eb.id) FILTER (WHERE e.status = 'active')::int AS students
       FROM batches b
       JOIN instruments i ON i.id = b.instrument_id
       LEFT JOIN teachers t ON t.id = b.teacher_id
       LEFT JOIN enrollment_batches eb ON eb.batch_id = b.id
       LEFT JOIN enrollments e ON e.id = eb.enrollment_id
      WHERE b.is_makeup = false
        AND ($1::text IS NULL OR i.name ILIKE $1)
        AND ($2::text IS NULL OR t.name ILIKE $2)
      GROUP BY b.id, i.name, t.name
      ORDER BY i.name, b.recurrence`,
    [instrument ? `%${instrument}%` : null, teacher ? `%${teacher}%` : null]
  )).rows;
  return when ? rows.filter(r => recurrenceMatches(r.recurrence, when)) : rows;
}

const describe = (b) => `${b.instrument} ${b.recurrence}${b.teacher ? ` (${b.teacher})` : ''}`;

// Suggestion bubbles are sent back verbatim as the user's next message, so each one is worded
// as a complete request the bot can act on without the earlier turns.
const MAX_BUBBLES = 6;
const startOf = (recurrence) => (String(recurrence).match(/\d{1,2}:\d{2}/) || [''])[0];
const batchRef = (b) => `${b.instrument} ${dayOf(b.recurrence)} ${startOf(b.recurrence)} batch${b.teacher ? ` with ${b.teacher}` : ''}`;

// Which batch did you mean? Used when a roster/schedule request names no single batch.
// Returns { text, suggestions }.
async function batchChoices(raw, verb = 'Students in') {
  const text = String(raw || '').toLowerCase();
  const all = await findBatches({});
  const instrument = all.find(b => text.includes(b.instrument.toLowerCase()))?.instrument;
  if (!instrument) {
    const names = [...new Set(all.map(b => b.instrument))];
    return { text: 'Which instrument?', suggestions: names.map(n => `${verb} ${n} batches`).slice(0, MAX_BUBBLES) };
  }
  const batches = all.filter(b => b.instrument === instrument);
  const list = batches.map(b => `${b.recurrence}${b.teacher ? ` (${b.teacher})` : ''} · ${b.students}/${b.capacity}`).join('\n');
  const suggestions = batches.length <= MAX_BUBBLES
    ? batches.map(b => `${verb} ${batchRef(b)}`)
    : [...new Set(batches.map(b => dayOf(b.recurrence)))].map(d => `${verb} ${instrument} ${d} batches`).slice(0, MAX_BUBBLES);
  return { text: `Which ${instrument} batch?\n${list}`, suggestions };
}

// Resolve exactly one batch from a UUID or instrument/teacher/when. Returns { batch } or
// { response } (a question for the user) so callers can return it as-is.
async function resolveOneBatch({ batch_id, instrument, teacher, when }) {
  if (!batch_id && !instrument && !teacher && !when) {
    return { response: makeResponse('text', 'Which batch? Tell me the instrument and day/time, e.g. "Guitar Tuesday 5pm".', ['List all batches']) };
  }
  let matches = await findBatches({ instrument, teacher, when });
  if (batch_id && UUID_RE.test(batch_id)) matches = matches.filter(m => m.id === batch_id);
  if (matches.length === 1) return { batch: matches[0] };
  if (!matches.length) {
    return { response: makeResponse('text', 'I couldn\'t find a batch matching that.', ['List all batches']) };
  }
  return {
    response: makeResponse('text', `Several batches match. Which one?\n${matches.slice(0, MAX_OPTIONS).map(describe).join('\n')}`,
      matches.slice(0, MAX_BUBBLES).map(b => `Use the ${batchRef(b)}`)),
  };
}

async function resolveTeacher(name) {
  const rows = (await pool.query(`SELECT id, name FROM teachers WHERE name ILIKE $1 LIMIT 5`, [`%${name}%`])).rows;
  if (rows.length === 1) return { teacher: rows[0] };
  return {
    response: makeResponse('text',
      rows.length ? `Which teacher: ${rows.map(r => r.name).join(', ')}?` : `I couldn't find a teacher named "${name}".`,
      rows.map(r => r.name)),
  };
}

async function resolveInstrument(name) {
  const rows = (await pool.query(`SELECT id, name FROM instruments WHERE name ILIKE $1 LIMIT 5`, [`%${name}%`])).rows;
  if (rows.length === 1) return { instrument: rows[0] };
  return {
    response: makeResponse('text',
      rows.length ? `Which instrument: ${rows.map(r => r.name).join(', ')}?` : `I couldn't find an instrument named "${name}".`,
      rows.map(r => r.name)),
  };
}

async function propose(user, body, doneText) {
  try {
    const { proposal } = await proposalService.create(user, { source_channel: 'chat', ...body });
    return makeResponse('text', `${doneText}: ${proposal.summary}.`, ['View approvals']);
  } catch (err) {
    if (err instanceof ServiceError) return makeResponse('error', err.message, []);
    throw err;
  }
}

// First "HH:MM-HH:MM" in a recurrence gives the class start and end.
function timesFrom(recurrence) {
  const m = String(recurrence).match(/(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})/);
  if (!m) return null;
  const pad = (h, min) => `${h.padStart(2, '0')}:${min}`;
  return { start_time: pad(m[1], m[2]), end_time: pad(m[3], m[4]) };
}

const batchSkills = {
  // Batches by any mix of day, time, instrument and teacher.
  'batch.find': async ({ params, userId, userRole }) => {
    const { instrument, teacher, when, day } = params;
    // A teacher sees their own batches only.
    let teacherName = teacher;
    if (userRole === 'teacher') {
      const own = (await pool.query(
        `SELECT t.name FROM teacher_users tu JOIN teachers t ON t.id = tu.teacher_id WHERE tu.user_id = $1 AND tu.is_active = true`,
        [userId])).rows[0];
      if (!own) return makeResponse('text', 'Your account is not linked to a teacher profile yet.', []);
      teacherName = own.name;
    }
    const rows = await findBatches({ instrument, teacher: teacherName, when: when || day });
    if (!rows.length) {
      return makeResponse('text', 'No batches match that.',
        [...(instrument && (when || day) ? [`Show ${instrument} batches`] : []), ...((when || day) ? [`Show all batches on ${when || day}`] : []), 'List all batches'].slice(0, MAX_BUBBLES));
    }
    // Few results: offer each one's roster. Many: narrow by instrument.
    const w = when || day;
    const next = rows.length <= MAX_BUBBLES
      ? rows.map(r => `Students in ${batchRef(r)}`)
      : instrument ? [...new Set(rows.map(r => dayOf(r.recurrence)))].map(d => `Show ${instrument} batches on ${d}`)
        : [...new Set(rows.map(r => r.instrument))].map(i => `Show ${i} batches${w ? ` on ${w}` : ''}`);
    return makeResponse('list', `${rows.length} batch${rows.length === 1 ? '' : 'es'} found.`, next.slice(0, MAX_BUBBLES), {
      students: rows.map(r => ({
        name: `${r.instrument} · ${r.recurrence}`,
        label: `${r.teacher || 'No teacher'} · ${r.students}/${r.capacity} students`,
      })),
    });
  },

  'batch.create': async ({ params, user }) => {
    const { instrument, teacher, recurrence, capacity } = params;
    if (!instrument || !recurrence) {
      return makeResponse('text', 'To create a batch I need the instrument and the schedule, e.g. "Guitar, TUE 17:00-18:00, THU 17:00-18:00".', []);
    }
    const times = timesFrom(recurrence);
    if (!times) return makeResponse('text', 'Please give the class time as HH:MM-HH:MM, e.g. "TUE 17:00-18:00, THU 17:00-18:00".', []);
    const inst = await resolveInstrument(instrument);
    if (inst.response) return inst.response;
    let teacherId = null;
    if (teacher) {
      const t = await resolveTeacher(teacher);
      if (t.response) return t.response;
      teacherId = t.teacher.id;
    }
    return propose(user, {
      action_type: 'batch.create',
      params: { instrument_id: inst.instrument.id, teacher_id: teacherId, recurrence, ...times, capacity: capacity ? Number(capacity) : undefined },
    }, 'Raised an approval request');
  },

  // Change a batch's teacher, schedule, capacity or WhatsApp link.
  'batch.update': async ({ params, user }) => {
    const { instrument, teacher, when, batch_id, new_teacher, new_recurrence, capacity, whatsapp_group_link } = params;
    const target = await resolveOneBatch({ batch_id, instrument, teacher, when });
    if (target.response) return target.response;

    const changes = {};
    if (new_teacher) {
      const t = await resolveTeacher(new_teacher);
      if (t.response) return t.response;
      changes.teacher_id = t.teacher.id;
    }
    if (new_recurrence) {
      const times = timesFrom(new_recurrence);
      if (!times) return makeResponse('text', 'Please give the new time as HH:MM-HH:MM, e.g. "TUE 18:00-19:00, THU 18:00-19:00".', []);
      Object.assign(changes, { recurrence: new_recurrence, ...times });
    }
    if (capacity !== undefined) changes.capacity = Number(capacity);
    if (whatsapp_group_link) changes.whatsapp_group_link = whatsapp_group_link;
    if (!Object.keys(changes).length) {
      const ref = batchRef(target.batch);
      return makeResponse('text', `What should change for ${describe(target.batch)}? I can update the teacher, schedule, capacity or WhatsApp link.`,
        [`Change the teacher of the ${ref}`, `Change the time of the ${ref}`, `Change the capacity of the ${ref}`, `Set the WhatsApp link of the ${ref}`]);
    }
    return propose(user, { action_type: 'batch.update', params: { batch_id: target.batch.id, changes } }, 'Raised an approval request');
  },

  // A student's current weekly classes, grouped by instrument. Always the first step of a change.
  'student.batches': async ({ params, userId, userRole }) => {
    const s = await resolveStudent(params.student_id ?? params.student_name, n => `Show ${n}'s batches`);
    if (s.response) return s.response;
    const teacherId = await teacherScope(userId, userRole);
    if (teacherId === false) return makeResponse('text', 'Your account is not linked to a teacher profile yet.', []);
    const classes = await studentClasses(s.student.id, params.instrument, teacherId);
    if (!classes.length) return makeResponse('text', `${s.student.name} has no current batches${params.instrument ? ` for ${params.instrument}` : ''}.`, [`Show ${s.student.name}'s profile`]);
    return makeResponse('list', currentSummary(s.student.name, classes), [`Move ${s.student.name}'s class`, `Show ${s.student.name}'s profile`], {
      students: classes.map(c => ({ name: `${c.instrument} · ${c.recurrence}`, label: c.teacher || 'No teacher' })),
    });
  },

  // Move one student's weekly class(es) to other batches of the same instrument. A student has
  // one or two classes a week per instrument, so the first step is always to show them and
  // ask whether one or both should change.
  'batch.move': async ({ params, user, userId, userRole }) => {
    const s = await resolveStudent(params.student_id ?? params.student_name, n => `Move ${n}'s class`);
    if (s.response) return s.response;
    const teacherId = await teacherScope(userId, userRole);
    if (teacherId === false) return makeResponse('text', 'Your account is not linked to a teacher profile yet.', []);
    const all = await studentClasses(s.student.id, params.instrument, teacherId);
    if (!all.length) return makeResponse('text', `${s.student.name} has no current batches${params.instrument ? ` for ${params.instrument}` : ''}.`, [`Show ${s.student.name}'s profile`]);

    const instruments = [...new Set(all.map(c => c.instrument))];
    if (instruments.length > 1) {
      return makeResponse('text', `${currentSummary(s.student.name, all)}\nWhich instrument's classes should change?`,
        instruments.map(i => `Move ${s.student.name}'s ${i} class`));
    }
    const slots = all;
    const name = s.student.name;
    const instrument = slots[0].instrument;

    if (params.to_instrument && !sameInstrument(params.to_instrument, instrument)) {
      return makeResponse('text', 'Moving a student to a different instrument can\'t be done through chat, because classes are tracked per instrument. Please ask an admin to do it from the Students screen.',
        [`Move ${name}'s ${instrument} class to another day`, `Show ${name}'s batches`]);
    }

    // Normalise to a list of { from_day, to_batch }; accept the single-move shorthand too.
    let requested = Array.isArray(params.moves) ? params.moves : [];
    if (!requested.length && (params.from_day || params.to_batch)) requested = [{ from_day: params.from_day, to_batch: params.to_batch }];

    // Which weekly classes change?
    const chosen = new Map(); // slot index -> to_batch phrase (may be undefined)
    for (const r of requested) {
      const from = String(r.from_day || '').trim();
      if (/^(both|all|2|two)\b/i.test(from)) {
        slots.forEach((_, i) => { if (!chosen.has(i)) chosen.set(i, undefined); });
      } else if (from) {
        const idx = slots.findIndex(sl => recurrenceMatches(sl.recurrence, from));
        if (idx < 0) return makeResponse('text', `${name} has no ${instrument} class matching "${from}".\n${currentSummary(name, slots)}`,
          slots.map(sl => `Change only ${name}'s ${dayOf(sl.recurrence)} ${instrument} class`));
        chosen.set(idx, r.to_batch);
      } else if (slots.length === 1) {
        chosen.set(0, r.to_batch);
      }
    }
    if (!chosen.size && slots.length === 1) chosen.set(0, undefined);
    if (!chosen.size) {
      return makeResponse('text',
        `${currentSummary(name, slots)}\nDo you want to change both classes, or only one?`,
        [`Change both of ${name}'s ${instrument} classes`, ...slots.map(sl => `Change only ${name}'s ${dayOf(sl.recurrence)} ${instrument} class`)]);
    }

    // Candidate target batches: same instrument, room available, not one the student is already in.
    const mine = new Set(slots.map(sl => sl.batch_id));
    const candidates = (await findBatches({ instrument })).filter(b => !mine.has(b.id) && b.students < b.capacity);
    const list = (bs) => bs.map(b => `${b.recurrence}${b.teacher ? ` (${b.teacher})` : ''} · ${b.students}/${b.capacity}`).join('\n');

    // Days of the classes that stay put: a moved class can't land on one of them.
    const keptDays = new Set(slots.filter((_, i) => !chosen.has(i)).map(sl => dayOf(sl.recurrence)));
    const options = candidates.filter(b => !keptDays.has(dayOf(b.recurrence)));

    const moves = [];
    const questions = [];
    let bubbles = [];
    // Bubbles answer the first open question; the rest are asked once that is settled.
    const ask = (text, slot, choices) => {
      questions.push(text);
      if (!bubbles.length) {
        bubbles = choices.slice(0, MAX_BUBBLES).map(o =>
          `Move ${name}'s ${dayOf(slot.recurrence)} ${instrument} class to ${dayOf(o.recurrence)} ${startOf(o.recurrence)}${o.teacher ? ` with ${o.teacher}` : ''}`);
      }
    };
    for (const [idx, phrase] of chosen) {
      const slot = slots[idx];
      if (!phrase) {
        ask(`Where should the ${slot.recurrence} class move to? Options:\n${list(options)}`, slot, options);
        continue;
      }
      let matches = UUID_RE.test(phrase) ? options.filter(c => c.id === phrase) : options.filter(c => recurrenceMatches(c.recurrence, phrase));
      if (matches.length > 1) {
        // A teacher's name in the phrase ("... with Shiva") narrows batches at the same time.
        const byTeacher = matches.filter(m => m.teacher && String(phrase).toLowerCase().includes(m.teacher.toLowerCase()));
        if (byTeacher.length >= 1) matches = byTeacher;
      }
      if (matches.length !== 1) {
        if (matches.length) ask(`Several batches match "${phrase}" for the ${slot.recurrence} class. Which one?\n${list(matches)}`, slot, matches);
        else ask(`No ${instrument} batch with room matches "${phrase}" for the ${slot.recurrence} class. Options:\n${list(options)}`, slot, options);
        continue;
      }
      moves.push({ slot, target: matches[0] });
    }
    if (questions.length) return makeResponse('text', `${currentSummary(name, slots)}\n\n${questions.join('\n\n')}`, bubbles);

    // The classes should still fall on different days afterwards.
    const days = slots.map(sl => dayOf((moves.find(m => m.slot === sl)?.target || sl).recurrence));
    if (new Set(days).size !== days.length) {
      return makeResponse('text', `That would put both of ${name}'s ${instrument} classes on the same day (${days.join(' and ')}). Please pick a different day for one of them.`,
        [`Change both of ${name}'s ${instrument} classes`, `Start over with ${name}'s ${instrument} classes`]);
    }
    if (new Set(moves.map(m => m.target.id)).size !== moves.length) {
      return makeResponse('text', 'Both classes can\'t move to the same batch. Please pick two different batches.',
        [`Change both of ${name}'s ${instrument} classes`]);
    }

    return propose(user, {
      action_type: 'batch.move',
      params: { moves: moves.map(m => ({ enrollment_batch_id: m.slot.enrollment_batch_id, from_batch_id: m.slot.batch_id, to_batch_id: m.target.id })) },
      source_message: params.reason || null,
    }, 'Raised an approval request');
  },
};

const WEEK = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];
const dayOf = (recurrence) => (String(recurrence).toUpperCase().match(/\b(MON|TUE|WED|THU|FRI|SAT|SUN)\b/) || [])[1] || String(recurrence);
const sameInstrument = (a, b) => {
  const x = String(a).toLowerCase();
  const y = String(b).toLowerCase();
  return x.includes(y) || y.includes(x);
};

// One student by name (or id). Returns { student } or { response } asking who is meant.
// `intent` words the bubble for each candidate so a tap repeats the original request, e.g.
// n => `Move ${n}'s class`.
async function resolveStudent(name, intent = n => n) {
  if (!name) return { response: makeResponse('text', 'Which student? Please give their name.', []) };
  const rows = UUID_RE.test(name)
    ? (await pool.query('SELECT id, name FROM students WHERE id = $1 AND is_active = true', [name])).rows
    : (await pool.query('SELECT id, name FROM students WHERE is_active = true AND name ILIKE $1 ORDER BY name LIMIT 6', [`%${name}%`])).rows;
  if (rows.length === 1) return { student: rows[0] };
  // An exact full-name match wins over partial matches ("Arav" vs "Aarav").
  const exact = rows.filter(r => r.name.toLowerCase() === String(name).trim().toLowerCase());
  if (exact.length === 1) return { student: exact[0] };
  return {
    response: makeResponse('text',
      rows.length ? `Which student: ${rows.map(r => r.name).join(', ')}?` : `No active student matches "${name}".`,
      rows.map(r => intent(r.name))),
  };
}

// A teacher only sees classes in their own batches. Returns null (no limit), a teacher id,
// or false when the teacher's account is not linked to a teacher profile.
async function teacherScope(userId, userRole) {
  if (userRole !== 'teacher') return null;
  const row = (await pool.query('SELECT teacher_id FROM teacher_users WHERE user_id = $1 AND is_active = true', [userId])).rows[0];
  return row ? row.teacher_id : false;
}

// The student's weekly classes (one row per day per instrument), ordered Mon..Sun.
async function studentClasses(studentId, instrument, teacherId) {
  const rows = (await pool.query(
    `SELECT eb.id AS enrollment_batch_id, b.id AS batch_id, i.name AS instrument, b.recurrence, t.name AS teacher
       FROM enrollment_batches eb
       JOIN enrollments e ON e.id = eb.enrollment_id AND e.status = 'active'
       JOIN batches b ON b.id = eb.batch_id AND b.is_makeup = false
       JOIN instruments i ON i.id = b.instrument_id
       LEFT JOIN teachers t ON t.id = b.teacher_id
      WHERE e.student_id = $1
        AND ($2::text IS NULL OR i.name ILIKE $2)
        AND ($3::uuid IS NULL OR b.teacher_id = $3)`,
    [studentId, instrument ? `%${instrument}%` : null, teacherId || null]
  )).rows;
  return rows.sort((a, b) => a.instrument.localeCompare(b.instrument) || WEEK.indexOf(dayOf(a.recurrence)) - WEEK.indexOf(dayOf(b.recurrence)));
}

function currentSummary(name, classes) {
  const byInstrument = new Map();
  for (const c of classes) byInstrument.set(c.instrument, [...(byInstrument.get(c.instrument) || []), c]);
  const lines = [...byInstrument].map(([inst, cs]) =>
    `${inst}: ${cs.map(c => `${c.recurrence}${c.teacher ? ` (${c.teacher})` : ''}`).join(' and ')}`);
  return `${name} is currently enrolled in:\n${lines.join('\n')}`;
}

const BATCH_TOOLS = [
  ['student.batches', 'Show the batches (weekly classes) a student is currently enrolled in. Use this FIRST for any question about a student\'s classes, and before any batch change. Names only, never ids.',
    { student_id: 'student name', instrument: 'optional instrument filter' }, ['student_id']],
  ['batch.find', 'Find batches by day, time, instrument and/or teacher (e.g. "which batches run on Saturday", "Guitar batches", "Priya\'s batches"). Names only, never ids.',
    { day: 'day name, e.g. Saturday', when: 'day and/or time phrase, e.g. "Thursday 6pm"', instrument: 'instrument name', teacher: 'teacher name' }, []],
  ['batch.create', 'Request a new batch (raises an approval request). Each batch is ONE weekday slot, e.g. "TUE 17:00-18:00".',
    { instrument: 'instrument name', teacher: 'teacher name, optional', recurrence: 'one day and time, e.g. "TUE 17:00-18:00"', capacity: 'max students, default 8' }, ['instrument', 'recurrence']],
  ['batch.update', 'Request a change to an existing batch: new teacher, new schedule, capacity or WhatsApp link (raises an approval request). Identify the batch by instrument + when (+ current teacher).',
    { instrument: 'instrument of the batch', when: 'day/time of the batch, e.g. "Tuesday 5pm"', teacher: 'current teacher of the batch', new_teacher: 'teacher to assign', new_recurrence: 'new day and time', capacity: 'new max students', whatsapp_group_link: 'new link' }, []],
  ['batch.move', 'Request moving a student\'s weekly class(es) to other batches of the SAME instrument (raises an approval request). A student attends 1 or 2 days a week per instrument. ' +
    'The tool shows the current classes and asks whether one or both change, so call it with just the student first; then pass moves. Names only, never ids. Set to_instrument only if the user asked for a different instrument.',
    {
      student_id: 'student name',
      instrument: 'instrument the student currently learns',
      moves: {
        type: 'array',
        description: 'One entry per class to change. from_day is the CURRENT class day ("Tuesday") or "both"; to_batch is the target day/time ("Thursday 6pm").',
        items: { type: 'object', properties: { from_day: { type: 'string' }, to_batch: { type: 'string' } } },
      },
      to_instrument: 'only if moving to a different instrument',
      reason: 'why, if given',
    }, ['student_id']],
];

module.exports = { batchSkills, BATCH_TOOLS, recurrenceMatches, findBatches, resolveOneBatch, batchChoices, resolveStudent };
