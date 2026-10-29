'use strict';

// Shared attendance logic used by routes/attendance.js and the Cleff chat commands.
// Functions take a `db` (pool or transaction client) so callers control transactions.

const pool = require('../db');
const wa = require('./whatsappService');

const DAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

// Formats a Date using its local calendar fields (avoids the UTC shift that
// `toISOString()` introduces whenever the server's local timezone isn't UTC).
function toLocalDateStr(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

// Today's date in IST as YYYY-MM-DD, regardless of server timezone
function todayIST() {
  return new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
}

// Check if a recurrence string (e.g. "TUE 17:00-18:00, THU 17:00-18:00") includes a
// given day-of-week (0=Sun … 6=Sat).
function batchScheduledOnDay(recurrenceStr, dayOfWeek) {
  if (!recurrenceStr) return false;
  const days = recurrenceStr.split(',').map(s => s.trim().split(' ')[0].toUpperCase());
  return days.some(d => DAY_NAMES.indexOf(d) === dayOfWeek);
}

// Returns the "HH:MM-HH:MM" slot a recurrence string lists for a given day-of-week, or null.
function slotForDay(recurrenceStr, dayOfWeek) {
  if (!recurrenceStr) return null;
  for (const part of recurrenceStr.split(',')) {
    const [day, slot] = part.trim().split(/\s+/);
    if (day && day.toUpperCase() === DAY_NAMES[dayOfWeek]) return slot || null;
  }
  return null;
}

// Every non-makeup batch that has students for `date`, with each student's status that day.
// Enrolled students plus anyone already marked in the batch that day (out-of-turn guests).
async function getAttendanceByDate(db, date) {
  const dow = new Date(date + 'T00:00:00').getDay();

  const batchesRes = await db.query(`
    SELECT b.id, b.recurrence, b.start_time, b.end_time, b.teacher_id, b.instrument_id,
           t.name AS teacher_name, i.name AS instrument_name
    FROM batches b
    JOIN instruments i ON i.id = b.instrument_id
    LEFT JOIN teachers t ON t.id = b.teacher_id
    WHERE b.is_makeup = FALSE
  `);
  const batchIds = batchesRes.rows.map(b => b.id);

  const studentsRes = await db.query(`
    SELECT * FROM (
      SELECT DISTINCT ON (eb.batch_id, s.id)
        eb.batch_id, s.id AS student_id, s.name AS student_name,
        ar.status AS attendance_status, FALSE AS is_guest
      FROM enrollment_batches eb
      JOIN enrollments e ON e.id = eb.enrollment_id AND e.status = 'active'
      JOIN students s ON s.id = e.student_id
      LEFT JOIN attendance_records ar
             ON ar.student_id = s.id AND ar.batch_id = eb.batch_id
            AND ar.session_date = $1 AND ar.is_extra = FALSE
      WHERE eb.batch_id = ANY($2)
      ORDER BY eb.batch_id, s.id, ar.finalized_at DESC NULLS LAST
    ) enrolled
    UNION ALL
    SELECT * FROM (
      SELECT DISTINCT ON (ar.batch_id, s.id)
        ar.batch_id, s.id AS student_id, s.name AS student_name,
        ar.status AS attendance_status, TRUE AS is_guest
      FROM attendance_records ar
      JOIN students s ON s.id = ar.student_id
      WHERE ar.session_date = $1 AND ar.is_extra = FALSE AND ar.batch_id = ANY($2)
        AND NOT EXISTS (
          SELECT 1 FROM enrollment_batches eb
          JOIN enrollments e ON e.id = eb.enrollment_id AND e.status = 'active'
          WHERE eb.batch_id = ar.batch_id AND e.student_id = ar.student_id
        )
      ORDER BY ar.batch_id, s.id, ar.finalized_at DESC NULLS LAST
    ) guests
  `, [date, batchIds]);

  const studentsByBatch = {};
  for (const row of studentsRes.rows) {
    (studentsByBatch[row.batch_id] ||= []).push({
      student_id: row.student_id,
      student_name: row.student_name,
      status: row.attendance_status || null,
      is_guest: row.is_guest,
    });
  }

  return batchesRes.rows
    .map(b => {
      const slot = slotForDay(b.recurrence, dow);
      const students = (studentsByBatch[b.id] || []).sort((x, y) => x.student_name.localeCompare(y.student_name));
      return {
        batch_id: b.id,
        instrument_id: b.instrument_id,
        instrument_name: b.instrument_name,
        teacher_id: b.teacher_id,
        teacher_name: b.teacher_name,
        recurrence: b.recurrence,
        time_slot: slot || (b.start_time && b.end_time ? `${String(b.start_time).slice(0, 5)}-${String(b.end_time).slice(0, 5)}` : null),
        scheduled: slot !== null || batchScheduledOnDay(b.recurrence, dow),
        students,
      };
    })
    .filter(b => b.students.length > 0)
    .sort((a, b) =>
      (a.time_slot || '99').localeCompare(b.time_slot || '99') ||
      a.instrument_name.localeCompare(b.instrument_name)
    );
}

// Teacher profile linked to a user account, or null
async function getLinkedTeacherId(db, userId) {
  const res = await db.query(
    'SELECT teacher_id FROM teacher_users WHERE user_id = $1 AND is_active = true',
    [userId]
  );
  return res.rows[0]?.teacher_id || null;
}

// Map of batch_id -> note explaining who marked the record.
// `teacherId` is the marking teacher (null for admins); `via` names the channel (e.g. "Cleff").
// Returns null if any batch doesn't exist.
async function buildAttendanceNotes(db, { batchIds, teacherId, markerName, via }) {
  const batchRes = await db.query(
    `SELECT b.id, b.teacher_id, t.name AS teacher_name
     FROM batches b LEFT JOIN teachers t ON t.id = b.teacher_id
     WHERE b.id = ANY($1)`,
    [batchIds]
  );
  if (batchRes.rows.length !== batchIds.length) return null;

  let name = markerName;
  if (teacherId) {
    const markerRes = await db.query('SELECT name FROM teachers WHERE id = $1', [teacherId]);
    name = markerRes.rows[0]?.name || markerName;
  }

  const notes = new Map();
  for (const b of batchRes.rows) {
    const proxy = teacherId && b.teacher_id !== teacherId;
    if (!proxy && !via) continue;
    let note = via ? `Marked via ${via} by ${name}` : `Marked by ${name}`;
    if (proxy) note += ` on behalf of ${b.teacher_name || 'batch teacher'}`;
    notes.set(b.id, note);
  }
  return notes;
}

// Upserts attendance records. Caller owns the transaction.
// records: [{ batch_id, student_id, date, status, is_extra }]
async function saveAttendanceRecords(client, records, notes = new Map()) {
  for (const record of records) {
    const { batch_id, student_id, date, status, is_extra } = record;
    const note = notes.get(batch_id) || null;

    if (is_extra) {
      await client.query(
        'INSERT INTO attendance_records (batch_id, student_id, session_date, status, source, is_extra, finalized_at, notes) VALUES ($1, $2, $3, $4, $5, TRUE, NOW(), $6)',
        [batch_id, student_id, date, status, 'manual', note]
      );
      continue;
    }

    const checkRes = await client.query(
      'SELECT id FROM attendance_records WHERE batch_id = $1 AND student_id = $2 AND session_date = $3 AND is_extra = FALSE',
      [batch_id, student_id, date]
    );

    if (checkRes.rows.length > 0) {
      await client.query(
        'UPDATE attendance_records SET status = $1, source = $2, finalized_at = NOW(), notes = COALESCE($4, notes) WHERE id = $3',
        [status, 'manual', checkRes.rows[0].id, note]
      );
    } else {
      await client.query(
        'INSERT INTO attendance_records (batch_id, student_id, session_date, status, source, is_extra, finalized_at, notes) VALUES ($1, $2, $3, $4, $5, FALSE, NOW(), $6)',
        [batch_id, student_id, date, status, 'manual', note]
      );
    }
  }
}

// Saves records in one transaction, then fires WhatsApp notifications
async function saveAttendanceTransaction(records, notes) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await saveAttendanceRecords(client, records, notes);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
  notifyPresent(records);
}

// Fire-and-forget WhatsApp notifications — must not block or throw
function notifyPresent(records) {
  if (!wa.isEnabled()) return;
  const presentRecords = records.filter(r => r.status === 'present');
  for (const record of presentRecords) {
    pool.query(
      `SELECT s.id, s.name, i.name AS instrument, eb.classes_remaining
       FROM students s
       JOIN enrollment_batches eb ON eb.enrollment_id = (
         SELECT id FROM enrollments WHERE student_id = s.id LIMIT 1
       ) AND eb.batch_id = $2
       JOIN batches b ON b.id = eb.batch_id
       JOIN instruments i ON i.id = b.instrument_id
       WHERE s.id = $1`,
      [record.student_id, record.batch_id]
    ).then(({ rows }) => {
      if (!rows[0]) return;
      const { id, name, instrument, classes_remaining } = rows[0];
      wa.notifyAttendancePresent(id, name, instrument).catch(() => {});
      if (classes_remaining <= 2) {
        wa.notifyClassesLow(id, name, classes_remaining, instrument).catch(() => {});
      }
    }).catch(() => {});
  }
}

module.exports = {
  toLocalDateStr,
  todayIST,
  batchScheduledOnDay,
  slotForDay,
  getAttendanceByDate,
  getLinkedTeacherId,
  buildAttendanceNotes,
  saveAttendanceRecords,
  saveAttendanceTransaction,
  notifyPresent,
};
