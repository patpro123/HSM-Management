'use strict';

// Composing WhatsApp messages and preparing them for sending, shared by every chat skill (and
// route) that messages a family. The message is sent by the staff member tapping the click-to-chat
// link on their own phone, so no Meta-approved template is needed. Each prepared message is
// logged in whatsapp_messages as 'initiated'.

const pool = require('../db');
const { normalizePhone } = require('./whatsappService');
const { fmtDate, money } = require('../llm/dues');

const SIGN_OFF = '- HSM Team';
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 'es'}`;

const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_CODES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

// "Tuesday", "Tuesday and Thursday", "Tuesday, Thursday and Saturday"
const joinList = (items) => items.length > 1 ? `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}` : items[0] || '';

// 'YYYY-MM-DD' -> 'Tue, 11 Nov'
function longDay(iso) {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || '');
  if (!m) return '';
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return `${WEEKDAYS[d.getUTCDay()].slice(0, 3)}, ${fmtDate(iso).replace(/ \d{4}$/, '')}`;
}

// Short weekday names (Tue, Thu), Monday first, from recurrence strings like "TUE 17:00-18:00, THU 17:00-18:00"
function weekdaysFrom(recurrences) {
  const found = new Set();
  for (const r of recurrences) {
    for (const part of String(r || '').split(',')) {
      const i = DAY_CODES.indexOf(part.trim().split(/\s+/)[0].toUpperCase());
      if (i >= 0) found.add(i);
    }
  }
  return [...found].sort((a, b) => ((a + 6) % 7) - ((b + 6) % 7)).map(i => WEEKDAYS[i].slice(0, 3));
}

// One entry per message kind: data in, text out. Add new kinds here.
const COMPOSERS = {
  // data: { studentName, dues: rows from fetchDues }
  payment_followup({ studentName, dues }) {
    const lines = dues.map(d => {
      const head = dues.length > 1 ? `${d.instrument}: ` : '';
      const due = d.pending_amount ? `the next payment of ${money(d.pending_amount)}` : 'the next payment';
      if (!d.last_paid_on) return `${head}we have no payment on record yet for the ${plural(d.used, 'class')} attended, so ${due} is due.`;
      const paid = `since the last payment on ${fmtDate(d.last_paid_on)}`;
      if (d.overdue_classes > 0) return `${head}${plural(d.used, 'class')} attended ${paid} (package of ${d.allowance}), so ${due} is now due.`;
      return `${head}${d.used} of ${d.allowance} classes used ${paid}, ${d.classes_remaining} left. ${due[0].toUpperCase()}${due.slice(1)} will be due shortly.`;
    }).map(l => l.replace(/^(.*?: )?([a-z])/, (m, h, c) => (h || '') + c.toUpperCase()));
    const instruments = dues.map(d => d.instrument).join(' & ');
    return [
      `Hi! A gentle reminder from Hyderabad School of Music about ${studentName}'s ${instruments} classes.`,
      '',
      ...lines,
      '',
      'Kindly arrange the payment before the classes run out. Please ignore this message if you have already paid.',
      '',
      SIGN_OFF,
    ].join('\n');
  },

  // data: { date: 'YYYY-MM-DD', classes: [{ instrument, teacher, days: ['Tue', ...] }] }
  // A warm nudge to attend regularly and catch up in the teacher's other sessions. It says,
  // without dwelling on it, that no separate compensation class is arranged.
  absence_nudge({ studentName, date, classes }) {
    const first = studentName.split(/\s+/)[0];
    const orList = (days) => days.length > 1 ? `${days.slice(0, -1).join(', ')} or ${days[days.length - 1]}` : days[0];
    const missed = joinList(classes.map(c => c.instrument));
    const when = date ? ` on ${longDay(date)}` : '';
    const withDays = classes.filter(c => c.days.length);
    const single = classes.length === 1;
    const catchUp = !withDays.length
      ? `To catch up, ${first} can join an extra session on any day the teacher is available. Do let us know.`
      : single
        ? `To catch up, ${first} can join an extra session${classes[0].teacher ? ` with ${classes[0].teacher}` : ''} on ${orList(classes[0].days)}. Do let us know.`
        : [`To catch up, ${first} can join extra sessions:`,
            ...withDays.map(c => `• ${c.instrument}${c.teacher ? ` (${c.teacher})` : ''}: ${orList(c.days)}`),
            'Do let us know.'].join('\n');
    return [
      `Hi! We missed ${first} at ${missed} class${single ? '' : 'es'}${when}. Hope all is well! 🙂`,
      `Regular attendance helps ${first} progress, so we hope to see them at every class.`,
      catchUp,
      "We can't arrange separate compensation classes, so a regular session is the best way to make up.",
      SIGN_OFF,
    ].join('\n\n');
  },
};

function composeMessage(kind, data) {
  const compose = COMPOSERS[kind];
  if (!compose) throw new Error(`Unknown WhatsApp message kind: ${kind}`);
  return compose(data);
}

// https://wa.me/<number>?text=…  (without a number WhatsApp lets the sender pick the contact)
function waLink(phone, text) {
  const to = phone ? normalizePhone(phone) : '';
  return `https://wa.me/${to}?text=${encodeURIComponent(text)}`;
}

// The family's number: the guardian's when recorded, else the student's own
async function recipientFor(studentId) {
  const { rows } = await pool.query(
    `SELECT NULLIF(TRIM(guardian_contact), '') AS guardian, NULLIF(TRIM(phone), '') AS phone FROM students WHERE id = $1`,
    [studentId]
  );
  // A valid number is 10-15 digits; skip malformed ones (e.g. two numbers run together)
  for (const candidate of [rows[0]?.guardian, rows[0]?.phone]) {
    const n = candidate ? normalizePhone(candidate) : '';
    if (n.length >= 10 && n.length <= 15) return n;
  }
  return null;
}

// Compose a message for a student and build what the UI needs to send it. Does not log; the
// log is written when the staff member actually taps send (see logInitiated).
async function prepareMessage({ studentId, studentName, kind, data }) {
  const text = composeMessage(kind, { studentName, ...data });
  const to = await recipientFor(studentId);
  return { student_id: studentId, student_name: studentName, kind, to, text, link: waLink(to, text) };
}

// The nudge for a student marked absent on `date`: one class when `batchId` is given, else every
// class they were absent from that day. Returns null when they were not marked absent.
async function prepareAbsenceMessage({ studentId, batchId = null, date }) {
  // Latest record per batch, as the attendance views show it
  const { rows } = await pool.query(
    `SELECT * FROM (
       SELECT DISTINCT ON (ar.batch_id) ar.status, s.name AS student_name, i.name AS instrument,
              b.instrument_id, b.teacher_id, t.name AS teacher_name
         FROM attendance_records ar
         JOIN students s ON s.id = ar.student_id
         JOIN batches b ON b.id = ar.batch_id
         JOIN instruments i ON i.id = b.instrument_id
         LEFT JOIN teachers t ON t.id = b.teacher_id
        WHERE ar.student_id = $1 AND ar.session_date = $2 AND ar.is_extra = FALSE
          AND ($3::uuid IS NULL OR ar.batch_id = $3::uuid)
        ORDER BY ar.batch_id, ar.finalized_at DESC NULLS LAST
     ) latest WHERE status = 'absent' ORDER BY instrument`,
    [studentId, date, batchId]
  );
  if (!rows.length) return null;

  // The days the same teacher runs that instrument: where the student can join in to catch up
  const sessions = await pool.query(
    `SELECT teacher_id, instrument_id, recurrence FROM batches
      WHERE is_makeup = FALSE AND teacher_id = ANY($1::uuid[]) AND instrument_id = ANY($2::uuid[])`,
    [rows.map(r => r.teacher_id).filter(Boolean), rows.map(r => r.instrument_id)]
  );
  const classes = rows.map(r => ({
    instrument: r.instrument,
    teacher: r.teacher_name || null,
    days: weekdaysFrom(sessions.rows
      .filter(x => x.teacher_id === r.teacher_id && x.instrument_id === r.instrument_id)
      .map(x => x.recurrence)),
  }));
  return prepareMessage({ studentId, studentName: rows[0].student_name, kind: 'absence_nudge', data: { date, classes } });
}

async function logInitiated({ studentId, phone, kind, text, userId }) {
  await pool.query(
    `INSERT INTO whatsapp_messages (direction, phone, template_name, body, status, student_id, metadata)
     VALUES ('outbound', $1, $2, $3, 'initiated', $4, $5)`,
    [phone || '', `manual:${kind}`, text, studentId || null, JSON.stringify({ via: 'cleff', user_id: userId || null })]
  );
}

module.exports = { composeMessage, waLink, recipientFor, prepareMessage, prepareAbsenceMessage, logInitiated, COMPOSERS };
