'use strict';

const pool = require('../db');
const emailService = require('../services/emailService');
const { computeClassesRemaining } = require('../utils/credits');

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
    const [{ byInstrument }, nameRes] = await Promise.all([
      computeClassesRemaining(pool, studentId),
      pool.query(`SELECT name FROM students WHERE id = $1`, [studentId]),
    ]);
    const studentName = nameRes.rows[0]?.name ?? 'Student';
    const credits = Object.entries(byInstrument).map(([instrument, classes_remaining]) => ({
      instrument, classes_remaining,
    }));
    if (!credits.length) return makeResponse('text', 'No active enrollment found.', ['Enroll in a course']);
    return makeResponse('card', `Classes remaining — ${studentName}`, ['Add classes', 'View schedule'], { credits });
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
      `WITH batch_instrument AS (
         SELECT instrument_id FROM batches WHERE id = $1
       ),
       raw_credits AS (
         SELECT p.student_id,
           CASE
             WHEN (p.metadata->>'credits_bought') IS NOT NULL AND (p.metadata->>'credits_bought')::int > 0
               THEN (p.metadata->>'credits_bought')::int
             WHEN pkg.classes_count IS NOT NULL THEN pkg.classes_count
             ELSE 0 END AS credits
         FROM payments p
         JOIN packages pkg ON p.package_id = pkg.id
         WHERE pkg.instrument_id = (SELECT instrument_id FROM batch_instrument)
         UNION ALL
         SELECT p.student_id, (p.metadata->>'credits_bought')::int AS credits
         FROM payments p
         WHERE p.package_id IS NULL
           AND (p.metadata->>'instrument_id')::uuid = (SELECT instrument_id FROM batch_instrument)
           AND (p.metadata->>'credits_bought') IS NOT NULL
           AND (p.metadata->>'credits_bought')::int > 0
       ),
       instr_credits AS (
         SELECT student_id, SUM(credits) AS credits FROM raw_credits GROUP BY student_id
       ),
       instr_attended AS (
         SELECT ar.student_id, COUNT(*) AS attended
         FROM attendance_records ar
         JOIN batches b ON ar.batch_id = b.id
         WHERE b.instrument_id = (SELECT instrument_id FROM batch_instrument)
           AND ar.status = 'present'
         GROUP BY ar.student_id
       )
       SELECT s.id, s.name, s.phone,
         GREATEST(0, COALESCE(ic.credits, 0) - COALESCE(ia.attended, 0)) AS classes_remaining
       FROM enrollment_batches eb
       JOIN enrollments e ON eb.enrollment_id = e.id
       JOIN students s ON e.student_id = s.id
       LEFT JOIN instr_credits ic ON ic.student_id = s.id
       LEFT JOIN instr_attended ia ON ia.student_id = s.id
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
      `SELECT DISTINCT s.name, s.phone, i.name AS instrument
       FROM students s
       JOIN enrollments e ON s.id = e.student_id
       JOIN enrollment_batches eb ON e.id = eb.enrollment_id
       JOIN batches b ON eb.batch_id = b.id
       JOIN instruments i ON b.instrument_id = i.id
       WHERE (s.student_type = 'permanent' OR s.student_type IS NULL)
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

  'attendance.mark_batch': async ({ params }) => {
    let { batch_id, default_status, exceptions, session_date } = params;

    // Resolve batch — accepts name, instrument, or UUID
    const resolvedBatchId = await resolveBatchId({ batch_id });
    if (!resolvedBatchId) {
      return makeResponse('text', 'Which batch? Please specify the instrument or batch time, e.g. "Guitar Tuesday 5pm".', ['List my batches']);
    }

    // Batch metadata
    const batchRow = (await pool.query(
      `SELECT b.id, b.recurrence, i.name AS instrument, t.name AS teacher
       FROM batches b
       JOIN instruments i ON b.instrument_id = i.id
       JOIN teachers   t ON b.teacher_id    = t.id
       WHERE b.id = $1`,
      [resolvedBatchId]
    )).rows[0];
    if (!batchRow) return makeResponse('error', 'Batch not found.', []);

    // All active students in the batch
    const students = (await pool.query(
      `SELECT s.id, s.name
       FROM enrollment_batches eb
       JOIN enrollments e ON eb.enrollment_id = e.id
       JOIN students   s ON e.student_id      = s.id
       WHERE eb.batch_id = $1 AND e.status = 'active'
       ORDER BY s.name`,
      [resolvedBatchId]
    )).rows;

    if (!students.length) {
      return makeResponse('text', `No active students in the ${batchRow.instrument} batch.`, ['View batch schedule']);
    }

    // Normalize default status
    const defStatus = ['absent', 'excused'].includes((default_status || '').toLowerCase())
      ? default_status.toLowerCase()
      : 'present';
    const oppStatus = defStatus === 'present' ? 'absent' : 'present';

    // Normalize exceptions — accept array or comma-separated string
    let exceptionNames = [];
    if (Array.isArray(exceptions) && exceptions.length) {
      exceptionNames = exceptions.map(n => String(n).toLowerCase().trim()).filter(Boolean);
    } else if (typeof exceptions === 'string' && exceptions.trim()) {
      exceptionNames = exceptions.split(/[,;]+/).map(n => n.toLowerCase().trim()).filter(Boolean);
    }

    // Fuzzy-match exception names → student IDs
    const exceptionIds = new Set();
    const unmatched    = [];
    for (const exName of exceptionNames) {
      const match = students.find(s => {
        const sn = s.name.toLowerCase();
        return sn.includes(exName) || exName.includes(sn.split(' ')[0]);
      });
      if (match) exceptionIds.add(match.id);
      else unmatched.push(exName);
    }

    // Build per-student attendance map
    const attendanceMap = students.map(s => ({
      id:     s.id,
      name:   s.name,
      status: exceptionIds.has(s.id) ? oppStatus : defStatus,
    }));

    // Session date — default to today IST
    const date = session_date || new Date(
      new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })
    ).toISOString().split('T')[0];

    // Execute in a single transaction with proper credit deduction / refund
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      for (const { id: studentId, status } of attendanceMap) {
        const existing = (await client.query(
          `SELECT id, status FROM attendance_records
           WHERE batch_id = $1 AND student_id = $2 AND session_date = $3 AND is_extra = FALSE`,
          [resolvedBatchId, studentId, date]
        )).rows[0];

        if (existing) {
          const oldStatus = existing.status;
          await client.query(
            `UPDATE attendance_records SET status = $1, source = 'chatbot', finalized_at = NOW() WHERE id = $2`,
            [status, existing.id]
          );
          // Credit transitions
          if (oldStatus !== 'present' && status === 'present') {
            await client.query(
              `UPDATE enrollment_batches eb
               SET classes_remaining = classes_remaining - 1
               FROM enrollments e
               WHERE eb.enrollment_id = e.id AND e.student_id = $1
                 AND eb.batch_id = $2 AND eb.classes_remaining > 0`,
              [studentId, resolvedBatchId]
            );
          } else if (oldStatus === 'present' && status !== 'present') {
            await client.query(
              `UPDATE enrollment_batches eb
               SET classes_remaining = classes_remaining + 1
               FROM enrollments e
               WHERE eb.enrollment_id = e.id AND e.student_id = $1 AND eb.batch_id = $2`,
              [studentId, resolvedBatchId]
            );
          }
        } else {
          await client.query(
            `INSERT INTO attendance_records
               (batch_id, student_id, session_date, status, source, is_extra, finalized_at)
             VALUES ($1, $2, $3, $4, 'chatbot', FALSE, NOW())`,
            [resolvedBatchId, studentId, date, status]
          );
          if (status === 'present') {
            await client.query(
              `UPDATE enrollment_batches eb
               SET classes_remaining = classes_remaining - 1
               FROM enrollments e
               WHERE eb.enrollment_id = e.id AND e.student_id = $1
                 AND eb.batch_id = $2 AND eb.classes_remaining > 0`,
              [studentId, resolvedBatchId]
            );
          }
        }
      }

      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    const presentCount = attendanceMap.filter(s => s.status === 'present').length;
    const absentCount  = attendanceMap.filter(s => s.status === 'absent').length;

    let summaryText = `Attendance saved — ${batchRow.instrument} (${date}): ${presentCount} present, ${absentCount} absent.`;
    if (unmatched.length) {
      summaryText += ` Could not find: ${unmatched.join(', ')} — please check spelling.`;
    }

    return makeResponse('list', summaryText,
      ['Send absence notifications', 'View batch roster', 'Mark another batch'],
      {
        students: attendanceMap.map(s => ({
          name:  s.name,
          label: s.status.charAt(0).toUpperCase() + s.status.slice(1),
          value: s.name,
        })),
      }
    );
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
      `WITH raw_credits AS (
         SELECT p.student_id, pkg.instrument_id,
           CASE
             WHEN (p.metadata->>'credits_bought') IS NOT NULL AND (p.metadata->>'credits_bought')::int > 0
               THEN (p.metadata->>'credits_bought')::int
             WHEN pkg.classes_count IS NOT NULL THEN pkg.classes_count
             ELSE 0 END AS credits
         FROM payments p
         JOIN packages pkg ON p.package_id = pkg.id
         UNION ALL
         SELECT p.student_id,
           (p.metadata->>'instrument_id')::uuid AS instrument_id,
           (p.metadata->>'credits_bought')::int AS credits
         FROM payments p
         WHERE p.package_id IS NULL
           AND (p.metadata->>'instrument_id') IS NOT NULL
           AND (p.metadata->>'credits_bought') IS NOT NULL
           AND (p.metadata->>'credits_bought')::int > 0
       ),
       instr_credits AS (
         SELECT student_id, instrument_id, SUM(credits) AS credits
         FROM raw_credits GROUP BY student_id, instrument_id
       ),
       instr_attended AS (
         SELECT ar.student_id, b.instrument_id, COUNT(*) AS attended
         FROM attendance_records ar
         JOIN batches b ON ar.batch_id = b.id
         WHERE ar.status = 'present'
         GROUP BY ar.student_id, b.instrument_id
       ),
       student_instr_remaining AS (
         SELECT DISTINCT s.id, s.name, s.phone, i.name AS instrument,
           GREATEST(0, COALESCE(ic.credits, 0) - COALESCE(ia.attended, 0)) AS classes_remaining
         FROM students s
         JOIN enrollments e ON s.id = e.student_id AND e.status = 'active'
         JOIN enrollment_batches eb ON e.id = eb.enrollment_id
         JOIN batches b ON eb.batch_id = b.id
         JOIN instruments i ON b.instrument_id = i.id
         LEFT JOIN instr_credits ic ON ic.student_id = s.id AND ic.instrument_id = i.id
         LEFT JOIN instr_attended ia ON ia.student_id = s.id AND ia.instrument_id = i.id
       )
       SELECT name, phone, instrument, classes_remaining
       FROM student_instr_remaining
       WHERE classes_remaining <= $1
       ORDER BY classes_remaining ASC, name
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
      `WITH student_credits AS (
         SELECT p.student_id,
           SUM(CASE
             WHEN (p.metadata->>'credits_bought') IS NOT NULL AND (p.metadata->>'credits_bought')::int > 0
               THEN (p.metadata->>'credits_bought')::int
             WHEN pkg.classes_count IS NOT NULL THEN pkg.classes_count
             ELSE 0 END) AS total
         FROM payments p
         LEFT JOIN packages pkg ON p.package_id = pkg.id
         GROUP BY p.student_id
       ),
       student_attended AS (
         SELECT student_id, COUNT(*) AS total
         FROM attendance_records WHERE status = 'present'
         GROUP BY student_id
       ),
       student_remaining AS (
         SELECT s.id,
           GREATEST(0, COALESCE(sc.total, 0) - COALESCE(sa.total, 0)) AS classes_remaining
         FROM students s
         LEFT JOIN student_credits sc ON sc.student_id = s.id
         LEFT JOIN student_attended sa ON sa.student_id = s.id
         WHERE (s.student_type = 'permanent' OR s.student_type IS NULL)
       )
       SELECT
         COUNT(DISTINCT s.id)                                                    AS total_active,
         COUNT(DISTINCT CASE WHEN e.status = 'active' THEN s.id END)            AS enrolled,
         COUNT(DISTINCT CASE WHEN sr.classes_remaining <= 0 THEN s.id END)      AS zero_credits,
         COUNT(DISTINCT CASE WHEN sr.classes_remaining <= 2
                              AND sr.classes_remaining > 0 THEN s.id END)       AS low_credits
       FROM students s
       LEFT JOIN enrollments e ON s.id = e.student_id
       LEFT JOIN student_remaining sr ON sr.id = s.id
       WHERE (s.student_type = 'permanent' OR s.student_type IS NULL)`
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
      `WITH raw_credits AS (
         SELECT p.student_id, pkg.instrument_id,
           CASE
             WHEN (p.metadata->>'credits_bought') IS NOT NULL AND (p.metadata->>'credits_bought')::int > 0
               THEN (p.metadata->>'credits_bought')::int
             WHEN pkg.classes_count IS NOT NULL THEN pkg.classes_count
             ELSE 0 END AS credits
         FROM payments p
         JOIN packages pkg ON p.package_id = pkg.id
         UNION ALL
         SELECT p.student_id,
           (p.metadata->>'instrument_id')::uuid AS instrument_id,
           (p.metadata->>'credits_bought')::int AS credits
         FROM payments p
         WHERE p.package_id IS NULL
           AND (p.metadata->>'instrument_id') IS NOT NULL
           AND (p.metadata->>'credits_bought') IS NOT NULL
           AND (p.metadata->>'credits_bought')::int > 0
       ),
       instr_credits AS (
         SELECT student_id, instrument_id, SUM(credits) AS credits
         FROM raw_credits GROUP BY student_id, instrument_id
       ),
       instr_attended AS (
         SELECT ar.student_id, b.instrument_id, COUNT(*) AS attended
         FROM attendance_records ar
         JOIN batches b ON ar.batch_id = b.id
         WHERE ar.status = 'present'
         GROUP BY ar.student_id, b.instrument_id
       )
       SELECT DISTINCT ON (s.id) s.name, s.phone,
         i.name AS instrument,
         GREATEST(0, COALESCE(ic.credits, 0) - COALESCE(ia.attended, 0)) AS classes_remaining
       FROM students s
       JOIN enrollments e ON e.student_id = s.id AND e.status = 'active'
       JOIN enrollment_batches eb ON eb.enrollment_id = e.id
       JOIN batches b ON eb.batch_id = b.id
       JOIN instruments i ON b.instrument_id = i.id
       LEFT JOIN instr_credits ic ON ic.student_id = s.id AND ic.instrument_id = i.id
       LEFT JOIN instr_attended ia ON ia.student_id = s.id AND ia.instrument_id = i.id
       WHERE s.is_active = true
         AND GREATEST(0, COALESCE(ic.credits, 0) - COALESCE(ia.attended, 0)) <= 0
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
      `WITH raw_credits AS (
         SELECT p.student_id, pkg.instrument_id,
           CASE
             WHEN (p.metadata->>'credits_bought') IS NOT NULL AND (p.metadata->>'credits_bought')::int > 0
               THEN (p.metadata->>'credits_bought')::int
             WHEN pkg.classes_count IS NOT NULL THEN pkg.classes_count
             ELSE 0 END AS credits
         FROM payments p
         JOIN packages pkg ON p.package_id = pkg.id
         UNION ALL
         SELECT p.student_id,
           (p.metadata->>'instrument_id')::uuid AS instrument_id,
           (p.metadata->>'credits_bought')::int AS credits
         FROM payments p
         WHERE p.package_id IS NULL
           AND (p.metadata->>'instrument_id') IS NOT NULL
           AND (p.metadata->>'credits_bought') IS NOT NULL
           AND (p.metadata->>'credits_bought')::int > 0
       ),
       instr_credits AS (
         SELECT student_id, instrument_id, SUM(credits) AS credits
         FROM raw_credits GROUP BY student_id, instrument_id
       ),
       instr_attended AS (
         SELECT ar.student_id, b2.instrument_id, COUNT(*) AS attended
         FROM attendance_records ar
         JOIN batches b2 ON ar.batch_id = b2.id
         WHERE ar.status = 'present'
         GROUP BY ar.student_id, b2.instrument_id
       )
       SELECT DISTINCT ON (s.id) s.name, s.phone,
         i.name AS instrument,
         GREATEST(0, COALESCE(ic.credits, 0) - COALESCE(ia.attended, 0)) AS classes_remaining
       FROM batches b
       JOIN enrollment_batches eb ON eb.batch_id = b.id
       JOIN enrollments e ON eb.enrollment_id = e.id AND e.status = 'active'
       JOIN students s ON e.student_id = s.id
       JOIN instruments i ON b.instrument_id = i.id
       LEFT JOIN instr_credits ic ON ic.student_id = s.id AND ic.instrument_id = i.id
       LEFT JOIN instr_attended ia ON ia.student_id = s.id AND ia.instrument_id = i.id
       WHERE b.teacher_id = $1
         AND (s.student_type = 'permanent' OR s.student_type IS NULL)
       ORDER BY s.id, s.name`,
      [teacher_id]
    )).rows;
    if (!rows.length) return makeResponse('text', 'No active students found for this teacher.', []);
    return makeResponse('list', `${rows.length} active student(s) under this teacher.`,
      ['View profile', 'Check credits'], { students: rows });
  },

  // ── Charts ────────────────────────────────────────────────────────────────

  'chart.attendance': async ({ params }) => {
    const period    = (params.period     || 'month').toLowerCase();
    const chartType = (params.chart_type || 'bar').toLowerCase();
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
        type: chartType,
        data: rows,
        xKey: 'label',
        series: [
          { key: 'present', color: '#4caf50', label: 'Present' },
          { key: 'absent',  color: '#f44336', label: 'Absent'  },
        ],
      },
    });
  },

  'chart.students': async ({ params }) => {
    const chartType = (params.chart_type || 'pie').toLowerCase();
    const rows = (await pool.query(
      `SELECT i.name AS label, COUNT(DISTINCT s.id)::int AS value
       FROM students s
       JOIN enrollments e ON s.id = e.student_id
       JOIN enrollment_batches eb ON e.id = eb.enrollment_id
       JOIN batches b ON eb.batch_id = b.id
       JOIN instruments i ON b.instrument_id = i.id
       WHERE (s.student_type = 'permanent' OR s.student_type IS NULL)
       GROUP BY i.name ORDER BY value DESC`
    )).rows;
    return makeResponse('chart', 'Students by instrument', ['View list', 'Check attendance'], {
      chart: {
        type: chartType,
        data: rows,
        xKey: 'label',
        series: [{ key: 'value', label: 'Students' }],
      },
    });
  },

  'chart.revenue': async ({ params }) => {
    const chartType = (params.chart_type || 'bar').toLowerCase();
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
        type: chartType,
        data: rows,
        xKey: 'label',
        series: [{ key: 'value', label: '₹ Revenue' }],
      },
    });
  },

  // ── Prospect analytics ───────────────────────────────────────────────────

  'prospect.summary': async () => {
    const [summaryRes, noteRes] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*)                                                          AS total,
          COUNT(*) FILTER (WHERE is_active = true)                         AS active,
          COUNT(*) FILTER (WHERE metadata->>'status' = 'new')              AS status_new,
          COUNT(*) FILTER (WHERE metadata->>'status' = 'contacted')        AS status_contacted,
          COUNT(*) FILTER (WHERE metadata->>'status' = 'enrolled')         AS status_enrolled,
          COUNT(*) FILTER (WHERE metadata->>'status' NOT IN ('new','contacted','enrolled')
                                 AND metadata->>'status' IS NOT NULL)      AS status_other
        FROM students
        WHERE student_type = 'prospect'
      `),
      pool.query(`SELECT COUNT(DISTINCT prospect_id)::int AS followed_up FROM prospect_notes`),
    ]);
    const s = summaryRes.rows[0];
    const followedUp   = noteRes.rows[0].followed_up ?? 0;
    const notFollowedUp = Math.max(0, Number(s.active) - Number(followedUp));
    return makeResponse('card',
      `Prospects — ${s.active} active of ${s.total} total`,
      ['View aging', 'Who needs follow-up?', 'Prospects by instrument'],
      {
        student: {
          total_prospects:  s.total,
          active_prospects: s.active,
          status_new:       s.status_new,
          status_contacted: s.status_contacted,
          status_enrolled:  s.status_enrolled,
          followed_up:      followedUp,
          not_followed_up:  notFollowedUp,
        },
      }
    );
  },

  'prospect.list': async ({ params }) => {
    const { status, aging, instrument } = params;
    const values = [];
    const wheres = ["s.student_type = 'prospect'", 's.is_active = true'];

    if (status) {
      values.push(status);
      wheres.push(`s.metadata->>'status' = $${values.length}`);
    }
    if (aging) {
      const agingSQL = {
        fresh:    `s.created_at >= NOW() - INTERVAL '7 days'`,
        followup: `s.created_at < NOW() - INTERVAL '7 days'  AND s.created_at >= NOW() - INTERVAL '14 days'`,
        warm:     `s.created_at < NOW() - INTERVAL '14 days' AND s.created_at >= NOW() - INTERVAL '30 days'`,
        cold:     `s.created_at < NOW() - INTERVAL '30 days'`,
      };
      const clause = agingSQL[aging.toLowerCase()];
      if (clause) wheres.push(clause);
    }
    if (instrument) {
      values.push(`%${instrument}%`);
      wheres.push(`s.metadata->>'interested_instrument' ILIKE $${values.length}`);
    }

    const rows = (await pool.query(
      `SELECT s.name,
              s.phone,
              s.metadata->>'interested_instrument' AS instrument,
              s.metadata->>'status'                AS status,
              s.metadata->>'lead_source'           AS source,
              EXTRACT(DAY FROM NOW() - s.created_at)::int AS age_days,
              (SELECT COUNT(*) FROM prospect_notes pn WHERE pn.prospect_id = s.id)::int AS note_count
       FROM students s
       WHERE ${wheres.join(' AND ')}
       ORDER BY s.created_at DESC
       LIMIT 30`,
      values
    )).rows;

    if (!rows.length) return makeResponse('text', 'No prospects found for those filters.', ['View all prospects', 'View aging summary']);

    const label = [
      aging     ? `aging: ${aging}`           : '',
      status    ? `status: ${status}`         : '',
      instrument? `instrument: ${instrument}` : '',
    ].filter(Boolean).join(', ') || 'all active';

    return makeResponse('list',
      `${rows.length} prospect(s) — ${label}`,
      ['View aging', 'Who needs follow-up?'],
      {
        students: rows.map(r => ({
          name:  r.name,
          phone: r.phone,
          label: `${r.instrument || 'Unknown'} · ${r.age_days}d old · ${r.note_count ? r.note_count + ' note(s)' : 'no follow-up'}`,
          value: r.name,
        })),
      }
    );
  },

  'prospect.aging': async () => {
    const row = (await pool.query(`
      SELECT
        COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')                                        AS fresh,
        COUNT(*) FILTER (WHERE created_at < NOW() - INTERVAL '7 days'
                           AND created_at >= NOW() - INTERVAL '14 days')                                       AS followup,
        COUNT(*) FILTER (WHERE created_at < NOW() - INTERVAL '14 days'
                           AND created_at >= NOW() - INTERVAL '30 days')                                       AS warm,
        COUNT(*) FILTER (WHERE created_at < NOW() - INTERVAL '30 days')                                        AS cold
      FROM students
      WHERE student_type = 'prospect' AND is_active = true
    `)).rows[0];

    const total = Number(row.fresh) + Number(row.followup) + Number(row.warm) + Number(row.cold);
    return makeResponse('card',
      `Prospect aging — ${total} active total`,
      ['Show cold prospects', 'Show fresh prospects', 'View as chart'],
      {
        student: {
          'fresh (0–7d)':      row.fresh,
          'follow-up (8–14d)': row.followup,
          'warm (15–30d)':     row.warm,
          'cold (30d+)':       row.cold,
          total:               total,
        },
      }
    );
  },

  'prospect.followup': async ({ params }) => {
    const mode = (params.mode || 'pending').toLowerCase(); // 'pending' = no notes, 'done' = has notes
    const hasnotes = mode === 'done';

    const rows = (await pool.query(
      `SELECT s.name, s.phone,
              s.metadata->>'interested_instrument'  AS instrument,
              s.metadata->>'status'                 AS status,
              EXTRACT(DAY FROM NOW() - s.created_at)::int AS age_days,
              COUNT(pn.id)::int                      AS note_count
       FROM students s
       LEFT JOIN prospect_notes pn ON pn.prospect_id = s.id
       WHERE s.student_type = 'prospect' AND s.is_active = true
       GROUP BY s.id, s.name, s.phone, s.metadata, s.created_at
       HAVING ${hasnotes ? 'COUNT(pn.id) > 0' : 'COUNT(pn.id) = 0'}
       ORDER BY s.created_at ASC
       LIMIT 30`
    )).rows;

    const label = hasnotes ? 'followed up (have notes)' : 'NOT yet followed up (no notes)';
    if (!rows.length) return makeResponse('text', `No prospects ${label}.`, ['View all prospects', 'View aging']);

    return makeResponse('list',
      `${rows.length} prospect(s) ${label}`,
      hasnotes ? ['View aging', 'View pending follow-ups'] : ['View aging', 'View followed-up list'],
      {
        students: rows.map(r => ({
          name:  r.name,
          phone: r.phone,
          label: `${r.instrument || 'Unknown'} · ${r.age_days}d old · status: ${r.status || 'new'}`,
          value: r.name,
        })),
      }
    );
  },

  // ── Prospect chart ────────────────────────────────────────────────────────

  'chart.prospects': async ({ params }) => {
    const by        = (params.by         || 'aging').toLowerCase();
    const chartType = (params.chart_type || 'pie').toLowerCase();

    let rows, title;

    if (by === 'instrument') {
      rows = (await pool.query(`
        SELECT
          COALESCE(metadata->>'interested_instrument', 'Not specified') AS label,
          COUNT(*)::int AS value
        FROM students
        WHERE student_type = 'prospect' AND is_active = true
        GROUP BY label ORDER BY value DESC
      `)).rows;
      title = 'Prospects by instrument';
    } else if (by === 'status') {
      rows = (await pool.query(`
        SELECT
          COALESCE(NULLIF(metadata->>'status', ''), 'new') AS label,
          COUNT(*)::int AS value
        FROM students
        WHERE student_type = 'prospect' AND is_active = true
        GROUP BY label ORDER BY value DESC
      `)).rows;
      title = 'Prospects by status';
    } else {
      // aging (default)
      rows = [
        { label: 'Fresh (0–7d)',    value: 0 },
        { label: 'Follow-up (8–14d)', value: 0 },
        { label: 'Warm (15–30d)',   value: 0 },
        { label: 'Cold (30d+)',     value: 0 },
      ];
      const res = (await pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE created_at >= NOW() - INTERVAL '7 days')                                    AS fresh,
          COUNT(*) FILTER (WHERE created_at < NOW() - INTERVAL '7 days'
                             AND created_at >= NOW() - INTERVAL '14 days')                                   AS followup,
          COUNT(*) FILTER (WHERE created_at < NOW() - INTERVAL '14 days'
                             AND created_at >= NOW() - INTERVAL '30 days')                                   AS warm,
          COUNT(*) FILTER (WHERE created_at < NOW() - INTERVAL '30 days')                                    AS cold
        FROM students
        WHERE student_type = 'prospect' AND is_active = true
      `)).rows[0];
      rows[0].value = Number(res.fresh);
      rows[1].value = Number(res.followup);
      rows[2].value = Number(res.warm);
      rows[3].value = Number(res.cold);
      title = 'Prospects by aging';
    }

    if (!rows.length || rows.every(r => r.value === 0)) {
      return makeResponse('text', 'No prospect data available for a chart.', ['View prospect summary']);
    }

    return makeResponse('chart', title, ['View details', 'View prospect list'], {
      chart: {
        type: chartType,
        data: rows,
        xKey: 'label',
        series: [{ key: 'value', label: 'Prospects' }],
      },
    });
  },

  // ── Finance analytics ────────────────────────────────────────────────────

  'finance.summary': async ({ params }) => {
    const monthStr = params.month || new Date().toISOString().slice(0, 7); // YYYY-MM
    const [year, month] = monthStr.split('-');
    const periodStart = `${year}-${month}-01`;
    const periodEnd   = new Date(Number(year), Number(month), 0).toISOString().slice(0, 10);

    const [revenueRes, expenseRes, payoutRes, budgetRes] = await Promise.all([
      pool.query(
        `SELECT COALESCE(SUM(amount),0)::numeric(10,2) AS total,
                COUNT(*)::int                           AS count
         FROM payments
         WHERE timestamp::date BETWEEN $1 AND $2`,
        [periodStart, periodEnd]
      ),
      pool.query(
        `SELECT COALESCE(SUM(amount),0)::numeric(10,2) AS total,
                COUNT(*)::int                           AS count
         FROM expenses
         WHERE date BETWEEN $1 AND $2`,
        [periodStart, periodEnd]
      ),
      pool.query(
        `SELECT COALESCE(SUM(amount),0)::numeric(10,2) AS total
         FROM teacher_payouts
         WHERE created_at::date BETWEEN $1 AND $2`,
        [periodStart, periodEnd]
      ),
      pool.query(
        `SELECT revenue_target, expense_limits
         FROM monthly_budgets WHERE month = $1`,
        [monthStr]
      ),
    ]);

    const revenue    = Number(revenueRes.rows[0].total);
    const expenses   = Number(expenseRes.rows[0].total);
    const payouts    = Number(payoutRes.rows[0].total);
    const totalCosts = expenses + payouts;
    const net        = revenue - totalCosts;
    const budget     = budgetRes.rows[0];
    const target     = budget ? Number(budget.revenue_target) : null;
    const vsTarget   = target ? `₹${revenue} of ₹${target} target (${Math.round((revenue / target) * 100)}%)` : 'No target set';

    return makeResponse('card',
      `Finance summary — ${monthStr}`,
      ['Show expense breakdown', 'Show payment details', 'Revenue vs expenses chart'],
      {
        student: {
          period:           monthStr,
          revenue:          `₹${revenue} (${revenueRes.rows[0].count} payments)`,
          expenses:         `₹${expenses} (${expenseRes.rows[0].count} entries)`,
          teacher_payouts:  `₹${payouts}`,
          net_income:       `₹${net}`,
          vs_target:        vsTarget,
        },
      }
    );
  },

  'finance.revenue': async ({ params }) => {
    const period = (params.period || 'this_month').toLowerCase().replace(' ', '_');
    let start, end, label;

    if (period === 'last_month') {
      const d = new Date();
      d.setDate(1); d.setMonth(d.getMonth() - 1);
      start = d.toISOString().slice(0, 7) + '-01';
      const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      end = lastDay.toISOString().slice(0, 10);
      label = 'last month';
    } else if (period === 'this_year') {
      start = new Date().getFullYear() + '-01-01';
      end = new Date().toISOString().slice(0, 10);
      label = 'this year';
    } else if (period === 'last_3_months') {
      const d = new Date();
      d.setMonth(d.getMonth() - 3);
      start = d.toISOString().slice(0, 10);
      end = new Date().toISOString().slice(0, 10);
      label = 'last 3 months';
    } else {
      // this_month (default)
      const now = new Date();
      start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      end = now.toISOString().slice(0, 10);
      label = 'this month';
    }

    const [totalsRes, methodRes, instrumentRes] = await Promise.all([
      pool.query(
        `SELECT COALESCE(SUM(amount),0)::numeric(10,2) AS total,
                COUNT(*)::int                           AS count,
                AVG(amount)::numeric(10,2)              AS avg_payment
         FROM payments WHERE timestamp::date BETWEEN $1 AND $2`,
        [start, end]
      ),
      pool.query(
        `SELECT COALESCE(method,'unknown') AS label,
                COUNT(*)::int              AS count,
                SUM(amount)::numeric(10,2) AS total
         FROM payments
         WHERE timestamp::date BETWEEN $1 AND $2
         GROUP BY method ORDER BY total DESC`,
        [start, end]
      ),
      pool.query(
        `SELECT i.name AS label, SUM(p.amount)::numeric(10,2) AS total, COUNT(*)::int AS count
         FROM payments p
         JOIN packages pkg ON p.package_id = pkg.id
         JOIN instruments i ON pkg.instrument_id = i.id
         WHERE p.timestamp::date BETWEEN $1 AND $2
         GROUP BY i.name ORDER BY total DESC`,
        [start, end]
      ),
    ]);

    const t = totalsRes.rows[0];
    if (Number(t.count) === 0) return makeResponse('text', `No payments recorded for ${label}.`, ['Check last month', 'View expenses']);

    const methodLines = methodRes.rows.map(r => `${r.label}: ₹${r.total} (${r.count})`).join(' · ');
    const instrumentLines = instrumentRes.rows.map(r => `${r.label}: ₹${r.total}`).join(' · ');

    return makeResponse('card',
      `Revenue ${label}: ₹${t.total} across ${t.count} payment(s)`,
      ['View by instrument chart', 'Show P&L', 'Show expenses'],
      {
        student: {
          period:        label,
          total_revenue: `₹${t.total}`,
          payment_count: t.count,
          avg_payment:   `₹${t.avg_payment}`,
          by_method:     methodLines || 'N/A',
          by_instrument: instrumentLines || 'N/A',
        },
      }
    );
  },

  'finance.expenses': async ({ params }) => {
    const period = (params.period || 'this_month').toLowerCase().replace(' ', '_');
    let start, end, label;
    const now = new Date();

    if (period === 'last_month') {
      const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      start = d.toISOString().slice(0, 10);
      end   = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);
      label = 'last month';
    } else if (period === 'this_year') {
      start = `${now.getFullYear()}-01-01`;
      end   = now.toISOString().slice(0, 10);
      label = 'this year';
    } else {
      start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      end   = now.toISOString().slice(0, 10);
      label = 'this month';
    }

    const [totalRes, categoryRes] = await Promise.all([
      pool.query(
        `SELECT COALESCE(SUM(amount),0)::numeric(10,2) AS total, COUNT(*)::int AS count
         FROM expenses WHERE date BETWEEN $1 AND $2`,
        [start, end]
      ),
      pool.query(
        `SELECT category AS label,
                SUM(amount)::numeric(10,2) AS total,
                COUNT(*)::int              AS count
         FROM expenses
         WHERE date BETWEEN $1 AND $2
         GROUP BY category ORDER BY total DESC`,
        [start, end]
      ),
    ]);

    if (Number(totalRes.rows[0].count) === 0) {
      return makeResponse('text', `No expenses recorded for ${label}.`, ['Check last month', 'View revenue']);
    }

    return makeResponse('list',
      `Expenses ${label}: ₹${totalRes.rows[0].total} across ${totalRes.rows[0].count} entr(ies)`,
      ['Show P&L', 'Show revenue', 'Expenses chart'],
      {
        students: categoryRes.rows.map(r => ({
          name:  r.label,
          label: `₹${r.total} · ${r.count} item(s)`,
          value: r.label,
        })),
      }
    );
  },

  'finance.pnl': async ({ params }) => {
    const monthStr = params.month || new Date().toISOString().slice(0, 7);
    const [year, month] = monthStr.split('-');
    const start = `${year}-${month}-01`;
    const end   = new Date(Number(year), Number(month), 0).toISOString().slice(0, 10);

    const [revenueRes, expenseRes, payoutRes, prevRevenueRes] = await Promise.all([
      pool.query(
        `SELECT COALESCE(SUM(amount),0)::numeric(10,2) AS total, COUNT(*)::int AS count
         FROM payments WHERE timestamp::date BETWEEN $1 AND $2`,
        [start, end]
      ),
      pool.query(
        `SELECT COALESCE(SUM(amount),0)::numeric(10,2) AS total
         FROM expenses WHERE date BETWEEN $1 AND $2`,
        [start, end]
      ),
      pool.query(
        `SELECT COALESCE(SUM(amount),0)::numeric(10,2) AS total
         FROM teacher_payouts WHERE created_at::date BETWEEN $1 AND $2`,
        [start, end]
      ),
      // Previous month revenue for comparison
      pool.query(
        `SELECT COALESCE(SUM(amount),0)::numeric(10,2) AS total
         FROM payments
         WHERE timestamp::date BETWEEN
           (DATE_TRUNC('month', $1::date) - INTERVAL '1 month')
           AND (DATE_TRUNC('month', $1::date) - INTERVAL '1 day')`,
        [start]
      ),
    ]);

    const revenue   = Number(revenueRes.rows[0].total);
    const expenses  = Number(expenseRes.rows[0].total);
    const payouts   = Number(payoutRes.rows[0].total);
    const totalCost = expenses + payouts;
    const net       = revenue - totalCost;
    const margin    = revenue > 0 ? Math.round((net / revenue) * 100) : 0;
    const prevRev   = Number(prevRevenueRes.rows[0].total);
    const growth    = prevRev > 0 ? `${revenue >= prevRev ? '+' : ''}${Math.round(((revenue - prevRev) / prevRev) * 100)}% vs last month` : 'N/A';

    return makeResponse('card',
      `P&L — ${monthStr}: Net ₹${net} (${margin}% margin)`,
      ['Show revenue details', 'Show expenses', 'Revenue vs expenses chart'],
      {
        student: {
          month:            monthStr,
          revenue:          `₹${revenue} (${revenueRes.rows[0].count} payments)`,
          expenses:         `₹${expenses}`,
          teacher_payouts:  `₹${payouts}`,
          total_costs:      `₹${totalCost}`,
          net_income:       `₹${net}`,
          margin:           `${margin}%`,
          vs_last_month:    growth,
        },
      }
    );
  },

  'finance.payouts': async ({ params }) => {
    const period = (params.period || 'this_month').toLowerCase().replace(' ', '_');
    let start, end, label;
    const now = new Date();

    if (period === 'last_month') {
      const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      start = d.toISOString().slice(0, 10);
      end   = new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10);
      label = 'last month';
    } else if (period === 'this_year') {
      start = `${now.getFullYear()}-01-01`;
      end   = now.toISOString().slice(0, 10);
      label = 'this year';
    } else {
      start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      end   = now.toISOString().slice(0, 10);
      label = 'this month';
    }

    const [totalRes, perTeacherRes] = await Promise.all([
      pool.query(
        `SELECT COALESCE(SUM(amount),0)::numeric(10,2) AS total, COUNT(*)::int AS count
         FROM teacher_payouts WHERE created_at::date BETWEEN $1 AND $2`,
        [start, end]
      ),
      pool.query(
        `SELECT t.name AS label,
                SUM(tp.amount)::numeric(10,2) AS total,
                COUNT(*)::int                 AS count
         FROM teacher_payouts tp
         JOIN teachers t ON tp.teacher_id = t.id
         WHERE tp.created_at::date BETWEEN $1 AND $2
         GROUP BY t.id, t.name ORDER BY total DESC`,
        [start, end]
      ),
    ]);

    if (Number(totalRes.rows[0].count) === 0) {
      return makeResponse('text', `No teacher payouts recorded for ${label}.`, ['View revenue', 'Show P&L']);
    }

    return makeResponse('list',
      `Teacher payouts ${label}: ₹${totalRes.rows[0].total} total`,
      ['Show P&L', 'Show expenses'],
      {
        students: perTeacherRes.rows.map(r => ({
          name:  r.label,
          label: `₹${r.total}`,
          value: r.label,
        })),
      }
    );
  },

  'chart.finance': async ({ params }) => {
    const view      = (params.view       || 'revenue_vs_expenses').toLowerCase();
    const chartType = (params.chart_type || 'bar').toLowerCase();
    let rows, title;

    if (view === 'expenses_by_category') {
      const now = new Date();
      const start = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
      rows = (await pool.query(
        `SELECT category AS label, SUM(amount)::int AS value
         FROM expenses WHERE date >= $1
         GROUP BY category ORDER BY value DESC`,
        [start]
      )).rows;
      title = 'Expenses by category — this month';
    } else if (view === 'revenue_by_instrument') {
      rows = (await pool.query(
        `SELECT i.name AS label, SUM(p.amount)::int AS value
         FROM payments p
         JOIN packages pkg ON p.package_id = pkg.id
         JOIN instruments i ON pkg.instrument_id = i.id
         WHERE p.timestamp >= NOW() - INTERVAL '1 month'
         GROUP BY i.name ORDER BY value DESC`
      )).rows;
      title = 'Revenue by instrument — this month';
    } else {
      // revenue_vs_expenses (default) — last 6 months
      rows = (await pool.query(
        `SELECT
           TO_CHAR(month_series, 'Mon YY')  AS label,
           COALESCE(rev.total, 0)::int       AS revenue,
           COALESCE(exp.total, 0)::int       AS expenses
         FROM generate_series(
           DATE_TRUNC('month', NOW() - INTERVAL '5 months'),
           DATE_TRUNC('month', NOW()),
           '1 month'
         ) AS month_series
         LEFT JOIN (
           SELECT DATE_TRUNC('month', timestamp) AS m, SUM(amount) AS total
           FROM payments GROUP BY m
         ) rev ON rev.m = month_series
         LEFT JOIN (
           SELECT DATE_TRUNC('month', date) AS m, SUM(amount) AS total
           FROM expenses GROUP BY m
         ) exp ON exp.m = month_series
         ORDER BY month_series`
      )).rows;
      title = 'Revenue vs Expenses — last 6 months';
    }

    if (!rows.length || rows.every(r => (r.value ?? r.revenue) === 0)) {
      return makeResponse('text', 'No financial data available for a chart.', ['View finance summary']);
    }

    const isSingle = view !== 'revenue_vs_expenses';
    return makeResponse('chart', title, ['View P&L', 'Show details'], {
      chart: {
        type: chartType,
        data: rows,
        xKey: 'label',
        series: isSingle
          ? [{ key: 'value', label: title.split('—')[0].trim() }]
          : [
              { key: 'revenue',  color: '#4a90d9', label: 'Revenue'  },
              { key: 'expenses', color: '#e74c3c', label: 'Expenses' },
            ],
      },
    });
  },

  'school.locations': async () => {
    const locations = [
      {
        name:        'Main Campus — Bandlaguda',
        address:     'Flat No 1, 3rd Floor, House No 7-214, Abhyudaya Nagar, Kishan Nagar Colony, Bandlaguda Jagir-Kismatpura, Hyderabad — 500086',
        landmark:    'Opposite Kritunga Restaurant, near Bandlaguda / Rajendranagar',
        instruments: 'All instruments and vocal streams',
        status:      'open',
      },
      {
        name:        'PBEL City Campus (New)',
        address:     'PBEL City, Hyderabad',
        landmark:    '',
        instruments: 'Hindustani Vocals & Carnatic Vocals — open now. Guitar, Keyboard, Piano, Drums and other instruments coming soon.',
        status:      'partial',
      },
    ];
    const lines = locations.map(l =>
      `${l.name}: ${l.address}${l.landmark ? ' (' + l.landmark + ')' : ''} — ${l.instruments}`
    ).join('\n');
    return makeResponse('list', `HSM has ${locations.length} campus location(s):\n${lines}`,
      ['Get directions', 'Which instruments at PBEL City?', 'Working hours'],
      {
        students: locations.map(l => ({
          name:  l.name,
          label: l.instruments,
          value: l.status,
        })),
      }
    );
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
       LEFT JOIN enrollments e ON eb.enrollment_id = e.id
       LEFT JOIN students s ON e.student_id = s.id
         AND (s.student_type = 'permanent' OR s.student_type IS NULL)
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
  // School info
  T('school.locations', 'List all HSM campus locations, which instruments are available at each, and which are coming soon', {}),
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
  // Prospect analytics
  T('prospect.summary',  'Overview of all prospects: total, active, by status, and follow-up counts', {}),
  T('prospect.list',     'List prospects with optional filters by status, aging bucket, or instrument', { status: S('new | contacted | enrolled'), aging: S('fresh | followup | warm | cold'), instrument: S('instrument name') }),
  T('prospect.aging',    'Breakdown of active prospects by age: fresh(0-7d), follow-up(8-14d), warm(15-30d), cold(30+d)', {}),
  T('prospect.followup', 'Prospects who have or have not been followed up (have notes)', { mode: S('pending (no notes) | done (has notes)') }),
  // Charts
  T('chart.attendance',  'Chart of daily present/absent. Use chart_type=line for trend view.',         { period: S('week | month'), chart_type: S('bar | line') }),
  T('chart.students',    'Chart of students per instrument. Defaults to pie; use bar if requested.',   { chart_type: S('pie | bar') }),
  T('chart.revenue',     'Chart of monthly revenue last 6 months. Use chart_type=line for trend.',     { chart_type: S('bar | line') }),
  T('chart.prospects',   'Chart of prospects. by=aging|instrument|status. Defaults to pie.',           { by: S('aging | instrument | status'), chart_type: S('pie | bar') }),
  // Finance analytics
  T('finance.summary',  'Finance snapshot for a month: revenue, expenses, teacher payouts, net income, vs target', { month: S('YYYY-MM, defaults to current month') }),
  T('finance.revenue',  'Total revenue, payment count, avg payment, breakdown by method and instrument', { period: S('this_month | last_month | last_3_months | this_year') }),
  T('finance.expenses', 'Total expenses and breakdown by category for a period', { period: S('this_month | last_month | this_year') }),
  T('finance.pnl',      'Profit & Loss: revenue minus expenses and teacher payouts, margin, vs last month', { month: S('YYYY-MM, defaults to current month') }),
  T('finance.payouts',  'Total teacher payouts and per-teacher breakdown for a period', { period: S('this_month | last_month | this_year') }),
  T('chart.finance',    'Finance chart. view=revenue_vs_expenses|expenses_by_category|revenue_by_instrument', { view: S('revenue_vs_expenses | expenses_by_category | revenue_by_instrument'), chart_type: S('bar | line') }),
  // Actions
  T('attendance.mark_batch',
    'Mark attendance for ALL students in a batch at once. ' +
    'Set default_status (usually present) then list exceptions by name to mark them the opposite. ' +
    '"Mark all present except John and Mary" → default_status=present, exceptions=["John","Mary"].',
    {
      batch_id:       S('instrument name, batch time, or UUID'),
      default_status: { type: 'string', enum: ['present', 'absent'], description: 'Status for all students (default: present)' },
      exceptions:     { type: 'array', items: { type: 'string' }, description: 'Names of students to mark with the OPPOSITE status' },
      session_date:   S('YYYY-MM-DD, defaults to today'),
    }
  ),
  T('attendance.mark',   'Mark a SINGLE student present/absent/excused for a session',      { batch_id: S('UUID'), student_id: S('name or UUID'), status: { type: 'string', enum: ['present', 'absent', 'excused'] }, session_date: S('YYYY-MM-DD') }, ['status']),
  T('payment.record',    'Record a fee payment from a student',              { student_id: S('name or UUID'), package_id: S('UUID'), amount: { type: 'number' }, method: S('cash/UPI/bank') }, ['amount', 'method']),
  T('enroll.student',    'Start new student enrollment',                     { name: S('student name'), instrument: S('instrument name') }),
  T('student.update',    'Update student contact details',                   { student_id: S('name or UUID'), phone: S(''), guardian_contact: S(''), email: S('') }),
  T('batch.move',        'Move student from one batch to another',           { enrollment_id: S('UUID'), from_batch_id: S('UUID'), to_batch_id: S('UUID') }, ['enrollment_id', 'from_batch_id', 'to_batch_id']),
  T('payout.record',     'Record teacher salary payout',                     { teacher_id: S('name or UUID'), amount: { type: 'number' }, method: S(''), period_start: S('YYYY-MM-DD'), period_end: S('YYYY-MM-DD') }, ['amount', 'method', 'period_start', 'period_end']),
  T('notify.parent',     'Send absence notification to student guardian',    { student_id: S('name or UUID'), session_date: S('YYYY-MM-DD'), batch_name: S('') }, ['session_date', 'batch_name']),
  T('notify.batch',      'Get WhatsApp group link for a batch',              { batch_id: S('UUID') }),
];

const ACTION_SKILLS = new Set(['attendance.mark', 'attendance.mark_batch', 'payment.record', 'enroll.student', 'student.update', 'batch.move', 'payout.record']);
const LOOKUP_SKILLS = new Set(['school.locations', 'student.lookup', 'student.credits', 'student.profile', 'student.list', 'teacher.list', 'teacher.profile', 'teacher.students', 'teacher.payout', 'batch.roster', 'batch.schedule', 'payment.status', 'fee.query', 'stats.students', 'stats.unpaid', 'stats.attendance', 'report.lowcredits', 'reminder.payment', 'chart.attendance', 'chart.students', 'chart.revenue', 'prospect.summary', 'prospect.list', 'prospect.aging', 'prospect.followup', 'chart.prospects', 'finance.summary', 'finance.revenue', 'finance.expenses', 'finance.pnl', 'finance.payouts', 'chart.finance']);

module.exports = { skills, TOOL_DEFINITIONS, ACTION_SKILLS, LOOKUP_SKILLS };
