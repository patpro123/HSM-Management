'use strict';

const pool = require('../db');
const emailService = require('../services/emailService');

const makeResponse = (type, text, suggestions = [], card = null) =>
  ({ type, text, suggestions, card });

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const isUUID = (v) => typeof v === 'string' && UUID_RE.test(v);

// Resolve a student_id from params: accepts UUID, falls back to name search.
// Returns null if not resolvable (caller should return a lookup-required response).
async function resolveStudentId(params, userId, userRole) {
  if (userRole === 'student' || userRole === 'parent') {
    const res = await pool.query(
      `SELECT student_id FROM student_guardians WHERE user_id = $1 LIMIT 1`,
      [userId]
    );
    if (res.rows.length) return res.rows[0].student_id;
    const res2 = await pool.query(
      `SELECT s.id FROM students s
       JOIN users u ON (s.metadata->>'email') = u.email
       WHERE u.id = $1 LIMIT 1`,
      [userId]
    );
    return res2.rows[0]?.id ?? null;
  }

  const raw = params.student_id ?? params.student_name ?? params.name;
  if (!raw) return null;

  // Already a valid UUID — use directly
  if (isUUID(raw)) return raw;

  // Try to resolve by name
  const res = await pool.query(
    `SELECT id FROM students WHERE is_active = true AND name ILIKE $1 LIMIT 1`,
    [`%${raw}%`]
  );
  return res.rows[0]?.id ?? null;
}

// Resolve batch_id — accepts UUID or partial name match via instruments/recurrence
async function resolveBatchId(params) {
  const raw = params.batch_id ?? params.batch_name;
  if (!raw) return null;
  if (isUUID(raw)) return raw;
  const res = await pool.query(
    `SELECT b.id FROM batches b
     JOIN instruments i ON b.instrument_id = i.id
     WHERE i.name ILIKE $1 OR b.recurrence ILIKE $1
     LIMIT 1`,
    [`%${raw}%`]
  );
  return res.rows[0]?.id ?? null;
}

const skills = {

  'student.lookup': async ({ params }) => {
    const { query } = params;
    const rows = (await pool.query(
      `SELECT id, name, phone, metadata->>'email' AS email
       FROM students
       WHERE is_active = true
         AND (name ILIKE $1 OR phone ILIKE $1)
       LIMIT 5`,
      [`%${query}%`]
    )).rows;
    if (!rows.length) return makeResponse('text', `No students found matching "${query}".`, ['Try another name', 'Search by phone']);
    return makeResponse('list', `Found ${rows.length} student(s).`, ['View profile', 'Check credits'], { students: rows });
  },

  'student.credits': async ({ params, userId, userRole }) => {
    const studentId = await resolveStudentId(params, userId, userRole);
    if (!studentId) return makeResponse('text', 'Which student? Please provide their name.', ['Search for a student']);
    const [creditsRes, nameRes] = await Promise.all([
      pool.query(
        `SELECT i.name AS instrument, eb.classes_remaining, b.recurrence
         FROM enrollment_batches eb
         JOIN batches b ON eb.batch_id = b.id
         JOIN instruments i ON b.instrument_id = i.id
         JOIN enrollments e ON eb.enrollment_id = e.id
         WHERE e.student_id = $1 AND e.status = 'active'`,
        [studentId]
      ),
      pool.query(`SELECT name FROM students WHERE id = $1`, [studentId]),
    ]);
    const rows = creditsRes.rows;
    if (!rows.length) return makeResponse('text', 'No active enrollment found.', ['Enroll in a course']);
    const studentName = nameRes.rows[0]?.name ?? 'Student';
    return makeResponse('card', `Classes remaining — ${studentName}`, ['Add classes', 'View schedule'], { credits: rows });
  },

  'student.profile': async ({ params, userId, userRole }) => {
    const studentId = await resolveStudentId(params, userId, userRole);
    if (!studentId) return makeResponse('text', 'Which student? Please provide their name.', ['Search for a student']);
    const row = (await pool.query(
      `SELECT s.name, s.phone, s.dob,
              s.metadata->>'email'   AS email,
              s.metadata->>'address' AS address,
              e.status               AS enrollment_status
       FROM students s
       LEFT JOIN enrollments e ON e.student_id = s.id AND e.status = 'active'
       WHERE s.id = $1 AND s.is_active = true`,
      [studentId]
    )).rows[0];
    if (!row) return makeResponse('error', 'Student not found.', []);
    return makeResponse('card', `Profile — ${row.name}`, ['View attendance', 'Check payments'], { student: row });
  },

  'batch.roster': async ({ params }) => {
    const batch_id = await resolveBatchId(params);
    if (!batch_id) return makeResponse('text', 'Which batch? Please specify the instrument and time, e.g. "Guitar Tuesday 5pm".', ['List all batches']);
    const rows = (await pool.query(
      `SELECT s.id, s.name, s.phone, eb.classes_remaining
       FROM enrollment_batches eb
       JOIN enrollments e ON eb.enrollment_id = e.id
       JOIN students    s ON e.student_id = s.id
       WHERE eb.batch_id = $1 AND e.status = 'active'
       ORDER BY s.name`,
      [batch_id]
    )).rows;
    return makeResponse('list', `${rows.length} active student(s) in this batch.`,
      ['Mark attendance', 'Send reminder'], { roster: rows });
  },

  'batch.schedule': async ({ params }) => {
    const batch_id = await resolveBatchId(params);
    const row = (await pool.query(
      `SELECT b.recurrence, b.capacity,
              i.name AS instrument,
              t.name AS teacher
       FROM batches b
       JOIN instruments i ON b.instrument_id = i.id
       JOIN teachers   t ON b.teacher_id    = t.id
       WHERE b.id = $1`,
      [batch_id]
    )).rows[0];
    if (!row) return makeResponse('error', 'Batch not found.', []);
    return makeResponse('card', `${row.instrument} with ${row.teacher}`,
      ['View roster', 'Mark attendance'], { batch: row });
  },

  'student.list': async () => {
    const rows = (await pool.query(
      `SELECT s.name, s.phone, i.name AS instrument
       FROM students s
       JOIN enrollments e ON e.student_id = s.id AND e.status = 'active'
       JOIN enrollment_batches eb ON eb.enrollment_id = e.id
       JOIN batches b ON eb.batch_id = b.id
       JOIN instruments i ON b.instrument_id = i.id
       WHERE s.is_active = true
       GROUP BY s.id, s.name, s.phone, i.name
       ORDER BY s.name
       LIMIT 50`
    )).rows;
    if (!rows.length) return makeResponse('text', 'No active students found.', []);
    return makeResponse('list', `${rows.length} active student(s).`, ['View profile', 'Check credits'], { students: rows });
  },

  'teacher.list': async () => {
    const rows = (await pool.query(
      `SELECT t.name, t.phone, t.payout_type,
              COUNT(DISTINCT b.id) AS batch_count,
              COUNT(DISTINCT eb.enrollment_id) AS active_students
       FROM teachers t
       LEFT JOIN batches b ON b.teacher_id = t.id AND b.is_makeup = false
       LEFT JOIN enrollment_batches eb ON eb.batch_id = b.id
       LEFT JOIN enrollments e ON eb.enrollment_id = e.id AND e.status = 'active'
       GROUP BY t.id, t.name, t.phone, t.payout_type
       ORDER BY t.name`
    )).rows;
    if (!rows.length) return makeResponse('text', 'No teachers found.', []);
    return makeResponse('list', `${rows.length} teacher(s) at HSM.`, ['View teacher profile', 'View batches'], { students: rows.map(r => ({ name: r.name, phone: r.phone, label: `${r.batch_count} batches · ${r.active_students} students` })) });
  },

  'teacher.profile': async ({ params }) => {
    let { teacher_id } = params;
    if (teacher_id && !isUUID(teacher_id)) {
      const res = await pool.query(
        `SELECT id FROM teachers WHERE name ILIKE $1 LIMIT 1`,
        [`%${teacher_id}%`]
      );
      teacher_id = res.rows[0]?.id;
    }
    if (!teacher_id) return makeResponse('text', 'Which teacher? Please provide their name.', []);
    const row = (await pool.query(
      `SELECT t.name, t.phone, t.payout_type, t.rate,
              t.metadata->>'email' AS email,
              COUNT(DISTINCT eb.enrollment_id) AS active_students
       FROM teachers t
       LEFT JOIN batches b ON b.teacher_id = t.id
       LEFT JOIN enrollment_batches eb ON eb.batch_id = b.id
       LEFT JOIN enrollments e ON eb.enrollment_id = e.id AND e.status = 'active'
       WHERE t.id = $1
       GROUP BY t.id, t.name, t.phone, t.payout_type, t.rate, t.metadata`,
      [teacher_id]
    )).rows[0];
    if (!row) return makeResponse('error', 'Teacher not found.', []);
    return makeResponse('card', `${row.name} — ${row.active_students} active students`, ['View batches', 'View payout'], { teacher: row });
  },

  'payment.status': async ({ params, userId, userRole }) => {
    const studentId = await resolveStudentId(params, userId, userRole);
    if (!studentId) return makeResponse('text', 'Which student? Please provide their name.', ['Search for a student']);
    const rows = (await pool.query(
      `SELECT p.amount, p.method, p.created_at, pkg.name AS package
       FROM payments p
       JOIN packages pkg ON p.package_id = pkg.id
       WHERE p.student_id = $1
       ORDER BY p.created_at DESC LIMIT 10`,
      [studentId]
    )).rows;
    return makeResponse('list', `Last ${rows.length} payment(s).`, ['Record payment', 'Check credits'], { payments: rows });
  },

  'fee.query': async ({ params }) => {
    const { instrument } = params;
    const rows = (await pool.query(
      `SELECT pkg.name, pkg.classes_count, pkg.price, pkg.payment_frequency
       FROM packages pkg
       JOIN instruments i ON pkg.instrument_id = i.id
       WHERE i.name ILIKE $1
       ORDER BY pkg.payment_frequency, pkg.price`,
      [`%${instrument}%`]
    )).rows;
    if (!rows.length) return makeResponse('text', `No packages found for "${instrument}".`, ['List all instruments']);
    const lines = rows.map(r => `${r.name}: ₹${r.price} for ${r.classes_count} classes (${r.payment_frequency})`).join('; ');
    return makeResponse('card', lines, ['Enroll now', 'Compare packages'], { packages: rows });
  },

  'attendance.mark': async ({ params }) => {
    let { batch_id, student_id, status, session_date } = params;
    if (!isUUID(batch_id))   batch_id   = (await resolveBatchId(params));
    if (!isUUID(student_id)) student_id = null; // must be explicit for writes
    if (!batch_id)   return makeResponse('text', 'Which batch? Please specify the instrument and time.', []);
    if (!student_id) return makeResponse('text', 'Which student? Please provide their name to mark attendance.', []);
    const date = session_date || new Date().toISOString().split('T')[0];
    await pool.query(
      `INSERT INTO attendance_records (batch_id, student_id, session_date, status, source)
       VALUES ($1, $2, $3, $4, 'chatbot')
       ON CONFLICT (batch_id, student_id, session_date)
       DO UPDATE SET status = EXCLUDED.status`,
      [batch_id, student_id, date, status]
    );
    if (status === 'present') {
      await pool.query(
        `UPDATE enrollment_batches eb
         SET classes_remaining = classes_remaining - 1
         FROM enrollments e
         WHERE eb.enrollment_id = e.id
           AND eb.batch_id = $1 AND e.student_id = $2
           AND eb.classes_remaining > 0`,
        [batch_id, student_id]
      );
    }
    return makeResponse('text', `Attendance marked: ${status} for ${date}.`, ['Mark another student', 'View roster']);
  },

  'payment.record': async ({ params, userId, userRole }) => {
    let { student_id, package_id, amount, method } = params;
    if (!isUUID(student_id)) student_id = await resolveStudentId(params, userId, userRole);
    if (!student_id) return makeResponse('text', 'Which student? Please provide their name.', []);
    if (!package_id || !isUUID(package_id)) return makeResponse('text', 'Which payment package? Please specify the plan (e.g. Monthly Guitar).', []);
    await pool.query(
      `INSERT INTO payments (student_id, package_id, amount, method) VALUES ($1, $2, $3, $4)`,
      [student_id, package_id, amount, method]
    );
    return makeResponse('text', `Payment of ₹${amount} recorded via ${method}.`, ['View payment history', 'Update classes']);
  },

  'enroll.student': async ({ params }) => {
    return makeResponse('text',
      'Starting enrollment. I will guide you through the student details.',
      ['Continue enrollment'],
      { action: 'START_ENROLLMENT_FLOW', prefill: params }
    );
  },

  'student.update': async ({ params }) => {
    const { student_id, phone, guardian_contact, email } = params;
    const updates = [];
    const values  = [];
    let idx = 1;
    if (phone)            { updates.push(`phone = $${idx++}`); values.push(phone); }
    if (guardian_contact) { updates.push(`guardian_contact = $${idx++}`); values.push(guardian_contact); }
    if (email)            { updates.push(`metadata = jsonb_set(metadata, '{email}', to_jsonb($${idx++}::text))`); values.push(email); }
    if (!updates.length)  return makeResponse('error', 'No fields provided to update.', []);
    values.push(student_id);
    await pool.query(`UPDATE students SET ${updates.join(', ')} WHERE id = $${idx}`, values);
    return makeResponse('text', 'Student details updated.', ['View profile']);
  },

  'batch.move': async ({ params }) => {
    const { enrollment_id, from_batch_id, to_batch_id } = params;
    await pool.query(
      `UPDATE enrollment_batches SET batch_id = $1 WHERE enrollment_id = $2 AND batch_id = $3`,
      [to_batch_id, enrollment_id, from_batch_id]
    );
    return makeResponse('text', 'Student moved to new batch.', ['View new batch roster']);
  },

  'payout.record': async ({ params }) => {
    const { teacher_id, amount, method, period_start, period_end } = params;
    await pool.query(
      `INSERT INTO teacher_payouts (teacher_id, amount, method, period_start, period_end)
       VALUES ($1, $2, $3, $4, $5)`,
      [teacher_id, amount, method, period_start, period_end]
    );
    return makeResponse('text', `Payout of ₹${amount} recorded for period ${period_start} to ${period_end}.`, ['View payout history']);
  },

  'notify.parent': async ({ params, userId, userRole }) => {
    let { student_id, session_date, batch_name } = params;
    if (!isUUID(student_id)) student_id = await resolveStudentId(params, userId, userRole);
    if (!student_id) return makeResponse('text', 'Which student? Please provide their name.', []);
    const student = (await pool.query(
      `SELECT name, guardian_contact, metadata->>'email' AS email FROM students WHERE id = $1`,
      [student_id]
    )).rows[0];
    if (!student) return makeResponse('error', 'Student not found.', []);
    const guardianEmail = student.email;
    if (!guardianEmail) return makeResponse('error', 'No email on file for this student.', ['Update student profile']);

    await emailService.sendAbsenceNotification({
      guardianEmail,
      studentName: student.name,
      sessionDate: session_date,
      batchName:   batch_name,
    });

    return makeResponse('text', `Absence notification sent to guardian of ${student.name}.`, ['View attendance record']);
  },

  'notify.batch': async ({ params }) => {
    const { batch_id } = params;
    const row = (await pool.query(
      `SELECT whatsapp_group_link, recurrence FROM batches WHERE id = $1`,
      [batch_id]
    )).rows[0];
    if (!row || !row.whatsapp_group_link)
      return makeResponse('text', 'No WhatsApp group link set for this batch.', ['Update batch details']);
    return makeResponse('card', 'WhatsApp group link:', ['Open group'], { link: row.whatsapp_group_link });
  },

  'reminder.payment': async ({ params }) => {
    const threshold = params.threshold || 2;
    const rows = (await pool.query(
      `SELECT DISTINCT ON (s.id, i.id) s.name, s.phone, i.name AS instrument, eb.classes_remaining
       FROM enrollment_batches eb
       JOIN enrollments e ON eb.enrollment_id = e.id
       JOIN students    s ON e.student_id = s.id
       JOIN batches     b ON eb.batch_id = b.id
       JOIN instruments i ON b.instrument_id = i.id
       WHERE e.status = 'active' AND eb.classes_remaining <= $1
       ORDER BY s.id, i.id, eb.classes_remaining ASC
       LIMIT 20`,
      [threshold]
    )).rows;
    if (!rows.length) return makeResponse('text', 'No students with overdue or low classes right now.', ['Check all students', 'View batches']);
    return makeResponse('list', `${rows.length} student(s) with ${threshold} or fewer classes remaining.`,
      ['Send reminder email', 'Export list'], { students: rows });
  },

  'report.attendance': async ({ params }) => {
    const { from_date, to_date } = params;
    const batch_id = isUUID(params.batch_id) ? params.batch_id : null;
    const whereClause = batch_id
      ? `WHERE ar.batch_id = $3 AND ar.session_date BETWEEN $1 AND $2`
      : `WHERE ar.session_date BETWEEN $1 AND $2`;
    const queryParams = batch_id ? [from_date, to_date, batch_id] : [from_date, to_date];
    const rows = (await pool.query(
      `SELECT s.name,
              COUNT(*) FILTER (WHERE ar.status = 'present') AS present,
              COUNT(*) AS total
       FROM attendance_records ar
       JOIN students s ON ar.student_id = s.id
       ${whereClause}
       GROUP BY s.id, s.name ORDER BY s.name`,
      queryParams
    )).rows;
    if (!rows.length) return makeResponse('text', `No attendance records found for ${from_date} to ${to_date}.`, []);
    return makeResponse('list', `Attendance report: ${from_date} to ${to_date}.`, ['Export', 'View chart'], { report: rows });
  },

  'report.revenue': async ({ params }) => {
    const { from_date, to_date } = params;
    const row = (await pool.query(
      `SELECT SUM(amount) AS total, COUNT(*) AS count FROM payments
       WHERE created_at::date BETWEEN $1 AND $2`,
      [from_date, to_date]
    )).rows[0];
    return makeResponse('card', `Revenue ${from_date} to ${to_date}: ₹${row.total || 0} from ${row.count} payment(s).`,
      ['Break down by instrument', 'Export'], { revenue: row });
  },

  'report.lowcredits': async ({ params, userId, userRole }) => {
    return skills['reminder.payment']({ params, userId, userRole });
  },

  // ── Student analytics ────────────────────────────────────────────────────

  'stats.students': async () => {
    const row = (await pool.query(
      `SELECT
         COUNT(DISTINCT s.id)                                       AS total_active,
         COUNT(DISTINCT CASE WHEN e.status = 'active' THEN s.id END) AS enrolled,
         COUNT(DISTINCT CASE WHEN eb.classes_remaining <= 0 THEN s.id END) AS zero_credits,
         COUNT(DISTINCT CASE WHEN eb.classes_remaining <= 2
                              AND eb.classes_remaining > 0 THEN s.id END) AS low_credits
       FROM students s
       LEFT JOIN enrollments e ON e.student_id = s.id AND e.status = 'active'
       LEFT JOIN enrollment_batches eb ON eb.enrollment_id = e.id
       WHERE s.is_active = true`
    )).rows[0];
    const text = `Active students: ${row.total_active} | Enrolled: ${row.enrolled} | Zero credits: ${row.zero_credits} | Low credits (≤2): ${row.low_credits}`;
    return makeResponse('card', text, ['View unpaid list', 'View low credits'], {
      student: {
        total_active:  row.total_active,
        enrolled:      row.enrolled,
        zero_credits:  row.zero_credits,
        low_credits:   row.low_credits,
      },
    });
  },

  'stats.unpaid': async () => {
    const rows = (await pool.query(
      `SELECT DISTINCT ON (s.id) s.name, s.phone,
              i.name AS instrument, eb.classes_remaining
       FROM students s
       JOIN enrollments e ON e.student_id = s.id AND e.status = 'active'
       JOIN enrollment_batches eb ON eb.enrollment_id = e.id
       JOIN batches b ON eb.batch_id = b.id
       JOIN instruments i ON b.instrument_id = i.id
       WHERE s.is_active = true AND eb.classes_remaining <= 0
       ORDER BY s.id, s.name`
    )).rows;
    if (!rows.length) return makeResponse('text', 'No students with zero classes — everyone is paid up.', ['Check low credits']);
    return makeResponse('list', `${rows.length} student(s) with zero classes remaining (need to pay).`,
      ['Send reminders', 'Record payment'], { students: rows });
  },

  'stats.attendance': async ({ params }) => {
    const period = (params.period || 'today').toLowerCase();
    let dateFilter, label;
    if (period === 'week') {
      dateFilter = `ar.session_date >= date_trunc('week', CURRENT_DATE)`;
      label = 'this week';
    } else if (period === 'month') {
      dateFilter = `ar.session_date >= date_trunc('month', CURRENT_DATE)`;
      label = 'this month';
    } else {
      dateFilter = `ar.session_date = CURRENT_DATE`;
      label = 'today';
    }
    const row = (await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE ar.status = 'present') AS present,
         COUNT(*) FILTER (WHERE ar.status = 'absent')  AS absent,
         COUNT(*) FILTER (WHERE ar.status = 'excused') AS excused,
         COUNT(DISTINCT ar.student_id)                 AS unique_students
       FROM attendance_records ar
       WHERE ${dateFilter}`
    )).rows[0];
    const text = `Attendance ${label}: ${row.present} present, ${row.absent} absent, ${row.excused} excused (${row.unique_students} unique students).`;
    return makeResponse('card', text, ['View by batch', 'Mark attendance'], {
      student: {
        period:          label,
        present:         row.present,
        absent:          row.absent,
        excused:         row.excused,
        unique_students: row.unique_students,
      },
    });
  },

  // ── Teacher analytics ────────────────────────────────────────────────────

  'teacher.students': async ({ params }) => {
    let { teacher_id } = params;
    if (teacher_id && !isUUID(teacher_id)) {
      const res = await pool.query(`SELECT id FROM teachers WHERE name ILIKE $1 LIMIT 1`, [`%${teacher_id}%`]);
      teacher_id = res.rows[0]?.id;
    }
    if (!teacher_id) return makeResponse('text', 'Which teacher? Please provide the name.', []);
    const rows = (await pool.query(
      `SELECT DISTINCT ON (s.id) s.name, s.phone,
              i.name AS instrument, eb.classes_remaining
       FROM batches b
       JOIN enrollment_batches eb ON eb.batch_id = b.id
       JOIN enrollments e ON eb.enrollment_id = e.id AND e.status = 'active'
       JOIN students s ON e.student_id = s.id AND s.is_active = true
       JOIN instruments i ON b.instrument_id = i.id
       WHERE b.teacher_id = $1
       ORDER BY s.id, s.name`,
      [teacher_id]
    )).rows;
    if (!rows.length) return makeResponse('text', 'No active students found for this teacher.', []);
    return makeResponse('list', `${rows.length} active student(s) under this teacher.`,
      ['View profile', 'Check credits'], { students: rows });
  },

  // ── Charts ────────────────────────────────────────────────────────────────

  'chart.attendance': async ({ params }) => {
    const period = (params.period || 'month').toLowerCase();
    let dateFilter, label;
    if (period === 'week') {
      dateFilter = `session_date >= date_trunc('week', CURRENT_DATE)`;
      label = 'this week';
    } else {
      dateFilter = `session_date >= date_trunc('month', CURRENT_DATE)`;
      label = 'this month';
    }
    const rows = (await pool.query(
      `SELECT session_date::text AS label,
              COUNT(*) FILTER (WHERE status = 'present') AS present,
              COUNT(*) FILTER (WHERE status = 'absent')  AS absent
       FROM attendance_records
       WHERE ${dateFilter}
       GROUP BY session_date
       ORDER BY session_date`
    )).rows;
    if (!rows.length) return makeResponse('text', `No attendance data for ${label}.`, []);
    return makeResponse('chart', `Daily attendance — ${label}`, ['View by batch', 'Mark attendance'], {
      chart: {
        type: 'bar',
        data: rows,
        xKey: 'label',
        series: [
          { key: 'present', color: '#4caf50', label: 'Present' },
          { key: 'absent',  color: '#f44336', label: 'Absent' },
        ],
      },
    });
  },

  'chart.students': async () => {
    const rows = (await pool.query(
      `SELECT i.name AS label, COUNT(DISTINCT s.id) AS value
       FROM students s
       JOIN enrollments e ON e.student_id = s.id AND e.status = 'active'
       JOIN enrollment_batches eb ON eb.enrollment_id = e.id
       JOIN batches b ON eb.batch_id = b.id
       JOIN instruments i ON b.instrument_id = i.id
       WHERE s.is_active = true
       GROUP BY i.name ORDER BY value DESC`
    )).rows;
    return makeResponse('chart', 'Active students by instrument', ['View list', 'Check attendance'], {
      chart: {
        type: 'bar',
        data: rows,
        xKey: 'label',
        series: [{ key: 'value', color: '#f3c13a', label: 'Students' }],
      },
    });
  },

  'chart.revenue': async () => {
    const rows = (await pool.query(
      `SELECT TO_CHAR(timestamp, 'Mon YY') AS label,
              SUM(amount)::int             AS value
       FROM payments
       WHERE timestamp >= NOW() - INTERVAL '6 months'
       GROUP BY DATE_TRUNC('month', timestamp), TO_CHAR(timestamp, 'Mon YY')
       ORDER BY DATE_TRUNC('month', timestamp)`
    )).rows;
    if (!rows.length) return makeResponse('text', 'No revenue data in the last 6 months.', []);
    return makeResponse('chart', 'Monthly revenue — last 6 months', ['View breakdown', 'Export'], {
      chart: {
        type: 'bar',
        data: rows,
        xKey: 'label',
        series: [{ key: 'value', color: '#ff904e', label: '₹ Revenue' }],
      },
    });
  },

  'teacher.payout': async ({ params }) => {
    let { teacher_id } = params;
    if (teacher_id && !isUUID(teacher_id)) {
      const res = await pool.query(`SELECT id FROM teachers WHERE name ILIKE $1 LIMIT 1`, [`%${teacher_id}%`]);
      teacher_id = res.rows[0]?.id;
    }
    if (!teacher_id) return makeResponse('text', 'Which teacher? Please provide the name.', []);
    const row = (await pool.query(
      `SELECT t.name, t.payout_type, t.rate,
              COUNT(DISTINCT s.id) AS active_students
       FROM teachers t
       LEFT JOIN batches b ON b.teacher_id = t.id AND b.is_makeup = false
       LEFT JOIN enrollment_batches eb ON eb.batch_id = b.id
       LEFT JOIN enrollments e ON eb.enrollment_id = e.id AND e.status = 'active'
       LEFT JOIN students s ON e.student_id = s.id AND s.is_active = true
       WHERE t.id = $1
       GROUP BY t.id, t.name, t.payout_type, t.rate`,
      [teacher_id]
    )).rows[0];
    if (!row) return makeResponse('error', 'Teacher not found.', []);
    const estimated = row.payout_type === 'per_student_monthly'
      ? Number(row.rate) * Number(row.active_students)
      : Number(row.rate);
    const breakdown = row.payout_type === 'per_student_monthly'
      ? `₹${row.rate}/student × ${row.active_students} students`
      : `Fixed salary`;
    return makeResponse('card',
      `Estimated payout for ${row.name}: ₹${estimated} (${breakdown})`,
      ['Record payout', 'View payout history'],
      {
        student: {
          teacher:         row.name,
          payout_type:     row.payout_type,
          rate:            `₹${row.rate}`,
          active_students: row.active_students,
          estimated_payout: `₹${estimated}`,
        },
      }
    );
  },
};

const T = (name, desc, props = {}, req = []) => ({
  type: 'function',
  function: {
    name,
    description: desc,
    parameters: { type: 'object', properties: props, required: req },
  },
});
const S = (desc) => ({ type: 'string', description: desc });
const I = (desc) => ({ type: 'integer', description: desc });

const TOOL_DEFINITIONS = [
  // Lookups
  T('student.lookup',    'Search students by name or phone',                 { query: S('name or phone') }, ['query']),
  T('student.credits',   'Classes remaining per instrument for a student',   { student_id: S('name or UUID') }),
  T('student.profile',   'Full profile for a student',                       { student_id: S('name or UUID') }),
  T('student.list',      'List all active students',                         {}),
  T('teacher.list',      'List all teachers with batch and student counts',  {}),
  T('teacher.profile',   'Profile and student count for a teacher',          { teacher_id: S('name or UUID') }),
  T('batch.roster',      'Students enrolled in a batch',                     { batch_id: S('instrument name or UUID') }),
  T('batch.schedule',    'Schedule and timings for a batch',                 { batch_id: S('instrument name or UUID') }),
  T('payment.status',    'Recent payment history for a specific student',    { student_id: S('name or UUID') }),
  T('fee.query',         'Fee packages and prices for an instrument',        { instrument: S('instrument name') }, ['instrument']),
  T('reminder.payment',  'All students with low/zero classes (overdue/renewal list)', { threshold: I('max classes remaining, default 2') }),
  T('report.attendance', 'Attendance report for a batch over a date range',  { batch_id: S('UUID'), from_date: S('YYYY-MM-DD'), to_date: S('YYYY-MM-DD') }, ['from_date', 'to_date']),
  T('report.revenue',    'Total fee revenue in a date range',                { from_date: S('YYYY-MM-DD'), to_date: S('YYYY-MM-DD') }, ['from_date', 'to_date']),
  T('report.lowcredits', 'Students near zero classes needing renewal',       { threshold: I('default 2') }),
  // Student analytics
  T('stats.students',    'Count of active/enrolled/low-credit students',     {}),
  T('stats.unpaid',      'List of students with zero classes remaining (need to pay)', {}),
  T('stats.attendance',  'Present/absent counts for today, this week, or this month', { period: S('today | week | month') }),
  // Teacher analytics
  T('teacher.students',  'List and count of students under a specific teacher', { teacher_id: S('name or UUID') }),
  T('teacher.payout',    'Estimated monthly payout for a teacher based on their rate and student count', { teacher_id: S('name or UUID') }),
  // Charts
  T('chart.attendance',  'Bar chart of daily present/absent counts for this week or month', { period: S('week | month') }),
  T('chart.students',    'Bar chart of active students per instrument',  {}),
  T('chart.revenue',     'Bar chart of monthly revenue for the last 6 months', {}),
  // Actions
  T('attendance.mark',   'Mark a student present/absent for a session',      { batch_id: S('UUID'), student_id: S('name or UUID'), status: { type: 'string', enum: ['present', 'absent', 'excused'] }, session_date: S('YYYY-MM-DD') }, ['status']),
  T('payment.record',    'Record a fee payment from a student',              { student_id: S('name or UUID'), package_id: S('UUID'), amount: { type: 'number' }, method: S('cash/UPI/bank') }, ['amount', 'method']),
  T('enroll.student',    'Start new student enrollment',                     { name: S('student name'), instrument: S('instrument name') }),
  T('student.update',    'Update student contact details',                   { student_id: S('name or UUID'), phone: S(''), guardian_contact: S(''), email: S('') }),
  T('batch.move',        'Move student from one batch to another',           { enrollment_id: S('UUID'), from_batch_id: S('UUID'), to_batch_id: S('UUID') }, ['enrollment_id', 'from_batch_id', 'to_batch_id']),
  T('payout.record',     'Record teacher salary payout',                     { teacher_id: S('name or UUID'), amount: { type: 'number' }, method: S(''), period_start: S('YYYY-MM-DD'), period_end: S('YYYY-MM-DD') }, ['amount', 'method', 'period_start', 'period_end']),
  T('notify.parent',     'Send absence notification to student guardian',    { student_id: S('name or UUID'), session_date: S('YYYY-MM-DD'), batch_name: S('') }, ['session_date', 'batch_name']),
  T('notify.batch',      'Get WhatsApp group link for a batch',              { batch_id: S('UUID') }),
];

const ACTION_SKILLS = new Set(['attendance.mark', 'payment.record', 'enroll.student', 'student.update', 'batch.move', 'payout.record']);
const LOOKUP_SKILLS = new Set(['student.lookup', 'student.credits', 'student.profile', 'student.list', 'teacher.list', 'teacher.profile', 'teacher.students', 'teacher.payout', 'batch.roster', 'batch.schedule', 'payment.status', 'fee.query', 'stats.students', 'stats.unpaid', 'stats.attendance', 'report.lowcredits', 'reminder.payment', 'chart.attendance', 'chart.students', 'chart.revenue']);

module.exports = { skills, TOOL_DEFINITIONS, ACTION_SKILLS, LOOKUP_SKILLS };
