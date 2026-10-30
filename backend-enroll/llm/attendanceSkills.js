'use strict';

// Cleff's interactive attendance skills. They only read: the roll-call and history cards are
// edited on the phone and saved through POST /api/chat/attendance, which re-checks who may
// mark what. Bubbles are sent back verbatim as the next message, so each is a full request.

const pool = require('../db');
const svc = require('../services/attendanceService');
const { canMarkAttendanceOn } = require('../auth/actionPermissions');
const {
  parseDate, parseTime, buildRollResponse, resolveInstrument, norm, formatDate,
} = require('./attendanceCommands');
const { resolveStudent } = require('./batchSkills');

const makeResponse = (type, text, suggestions = [], card = null) => ({ type, text, suggestions, card });

const MAX_HISTORY_DAYS = 31;
const DEFAULT_HISTORY_DAYS = 7;
const MAX_BUBBLES = 6;
const SELF_RE = /^(me|my|mine|myself|own|my own)$/i;

const addDays = (iso, n) => {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};
const startOf = (slot) => String(slot || '').split('-')[0];
const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const dayLabel = (iso) => `${DAY_ABBR[new Date(`${iso}T00:00:00Z`).getUTCDay()]} ${Number(iso.slice(8))}`;

async function linkedTeacher(userId) {
  const row = (await pool.query(
    `SELECT t.id, t.name FROM teacher_users tu JOIN teachers t ON t.id = tu.teacher_id
      WHERE tu.user_id = $1 AND tu.is_active = true`, [userId])).rows[0];
  return row || null;
}

const attendanceSkills = {
  // Roll-call for a date: every class, an instrument, a time, one teacher's students ("my"
  // or by name). A teacher with no teacher given sees their own classes.
  'attendance.rollcall': async ({ params, user, userId, userRole }) => {
    const today = svc.todayIST();
    const date = params.date ? parseDate(params.date) : today;
    if (!date) {
      return makeResponse('text', `I couldn't read the date "${params.date}".`, ['Attendance today', 'Attendance yesterday']);
    }

    let batches = (await svc.getAttendanceByDate(pool, date)).filter(b => b.scheduled || b.students.some(s => s.status));

    let instrumentName = null;
    if (params.instrument) {
      const r = await resolveInstrument(pool, params.instrument);
      if (r.error) return makeResponse('text', r.error, []);
      batches = batches.filter(b => b.instrument_id === r.instrument.id);
      instrumentName = r.instrument.name;
    }

    if (params.time) {
      const t = parseTime(params.time);
      if (!t) return makeResponse('text', `I couldn't read the time "${params.time}". Try "5pm" or "17:00".`, []);
      const hh = String(t.hour).padStart(2, '0');
      const prefix = t.minute != null ? `${hh}:${String(t.minute).padStart(2, '0')}` : `${hh}:`;
      batches = batches.filter(b => (b.time_slot || '').startsWith(prefix));
    }

    // Whose students: me, a named teacher, or (for admin/HOS) everyone.
    let heading = instrumentName;
    const wantsSelf = params.teacher && SELF_RE.test(String(params.teacher).trim());
    if (wantsSelf || (!params.teacher && userRole === 'teacher')) {
      const me = await linkedTeacher(userId);
      if (!me) return makeResponse('text', 'Your account isn\'t linked to a teacher profile yet, so I can\'t tell which classes are yours. Please ask an admin.', []);
      batches = batches.filter(b => b.teacher_id === me.id);
      heading = [instrumentName, 'Mine'].filter(Boolean).join(' · ');
    } else if (params.teacher) {
      const q = norm(params.teacher);
      const named = batches.filter(b => norm(b.teacher_name || '').includes(q));
      const names = [...new Set(named.map(b => b.teacher_name))];
      if (names.length > 1) {
        return makeResponse('text', `Which teacher: ${names.join(', ')}?`,
          names.slice(0, MAX_BUBBLES).map(n => `Attendance for ${n}'s students on ${date}`));
      }
      batches = named;
      heading = [instrumentName, names[0]].filter(Boolean).join(' · ');
    }

    if (!batches.length) {
      return makeResponse('text', `No classes found for ${formatDate(date)}${heading ? ` (${heading})` : ''}.`,
        [`Attendance for ${addDays(date, -1)}`, `Attendance for ${addDays(date, 1)}`]);
    }
    return buildRollResponse({ date, batches, user, heading });
  },

  // One student's classes over a date range, editable.
  'attendance.student_history': async ({ params, user }) => {
    const s = await resolveStudent(params.student_id ?? params.student_name, n => `Attendance for ${n}${params.days ? ` last ${params.days} days` : ''}`);
    if (s.response) return s.response;
    const student = s.student;

    const today = svc.todayIST();
    const to = params.to_date ? parseDate(params.to_date) : today;
    const days = Math.min(Math.max(parseInt(params.days, 10) || DEFAULT_HISTORY_DAYS, 1), MAX_HISTORY_DAYS);
    let from = params.from_date ? parseDate(params.from_date) : addDays(to || today, -(days - 1));
    if (!to || !from) return makeResponse('text', 'I couldn\'t read that date range. Try "last 7 days" or "from 1 Oct to 15 Oct".', []);
    if (from > to) from = to;
    if (addDays(from, MAX_HISTORY_DAYS) <= to) from = addDays(to, -(MAX_HISTORY_DAYS - 1));

    const enrolled = (await pool.query(
      `SELECT b.id AS batch_id, b.recurrence, i.name AS instrument
         FROM enrollment_batches eb
         JOIN enrollments e ON e.id = eb.enrollment_id AND e.status = 'active'
         JOIN batches b ON b.id = eb.batch_id AND b.is_makeup = false
         JOIN instruments i ON i.id = b.instrument_id
        WHERE e.student_id = $1`, [student.id])).rows;
    const records = (await pool.query(
      `SELECT DISTINCT ON (ar.batch_id, ar.session_date) ar.batch_id, ar.session_date::text AS date, ar.status,
              b.recurrence, i.name AS instrument
         FROM attendance_records ar
         JOIN batches b ON b.id = ar.batch_id
         JOIN instruments i ON i.id = b.instrument_id
        WHERE ar.student_id = $1 AND ar.is_extra = FALSE AND ar.session_date BETWEEN $2 AND $3
        ORDER BY ar.batch_id, ar.session_date, ar.finalized_at DESC NULLS LAST`, [student.id, from, to])).rows;

    const byKey = new Map(records.map(r => [`${r.batch_id}|${r.date}`, r]));
    const rows = [];
    const seen = new Set();
    for (let d = from; d <= to; d = addDays(d, 1)) {
      const dow = new Date(`${d}T00:00:00Z`).getUTCDay();
      for (const b of enrolled) {
        if (!svc.batchScheduledOnDay(b.recurrence, dow)) continue;
        const key = `${b.batch_id}|${d}`;
        seen.add(key);
        rows.push({ batch_id: b.batch_id, date: d, status: byKey.get(key)?.status || null, slot: svc.slotForDay(b.recurrence, dow), instrument: b.instrument });
      }
    }
    // Marked on a day the batch isn't scheduled (makeup / out of turn)
    for (const r of records) {
      if (seen.has(`${r.batch_id}|${r.date}`)) continue;
      const dow = new Date(`${r.date}T00:00:00Z`).getUTCDay();
      rows.push({ batch_id: r.batch_id, date: r.date, status: r.status, slot: svc.slotForDay(r.recurrence, dow), instrument: r.instrument });
    }
    rows.sort((a, b) => a.date.localeCompare(b.date) || String(a.slot).localeCompare(String(b.slot)));

    const roles = user.roles || [];
    const out = rows.map(r => ({
      batch_id: r.batch_id,
      date: r.date,
      day: dayLabel(r.date),
      label: [r.instrument, startOf(r.slot)].filter(Boolean).join(' '),
      status: r.status,
      editable: canMarkAttendanceOn(roles, r.date, today) && r.date <= today,
    }));

    if (!out.length) {
      return makeResponse('text', `${student.name} has no classes between ${formatDate(from)} and ${formatDate(to)}.`,
        [`Attendance for ${student.name} last 30 days`]);
    }
    const counts = { present: 0, absent: 0, excused: 0 };
    out.forEach(r => { if (r.status) counts[r.status]++; });
    const range = from === to ? formatDate(from) : `${formatDate(from)} – ${formatDate(to)}`;
    return makeResponse('attendance_history', `${student.name} · ${range}`,
      [`${student.name}'s batches`], { student: { id: student.id, name: student.name }, from, to, counts, rows: out });
  },
};

const ATTENDANCE_TOOLS = [
  ['attendance.rollcall',
    'Show the attendance roll-call so the user can tap each student Present / Absent / Excused and submit. ' +
    'Use this for ANY request to see, take or mark attendance for a date, an instrument, a time, "my students" (teacher="me") or a named teacher\'s students. ' +
    'Defaults: date=today; a teacher with no teacher given sees their own classes; admin sees all. Names only, never ids.',
    { date: 'YYYY-MM-DD, "today", "yesterday" or "28 Oct"; default today', instrument: 'instrument name', time: 'class time, e.g. 5pm', teacher: '"me" for the user\'s own students, or a teacher name' }, []],
  ['attendance.student_history',
    'One student\'s attendance across several days (one row per class, editable). Use for "attendance of <student> last week / this month / from X to Y".',
    { student_id: 'student name', days: 'number of days back from today, default 7, max 31', from_date: 'YYYY-MM-DD', to_date: 'YYYY-MM-DD' }, ['student_id']],
];

module.exports = { attendanceSkills, ATTENDANCE_TOOLS };
