const express = require('express');
const router = express.Router();
const pool = require('../db');

// Helper: count expected sessions for a given month from recurrence string
// Recurrence format: "TUE 17:00-18:00, THU 17:00-18:00"
function countExpectedSessionsForMonth(recurrenceStr, year, month) {
  if (!recurrenceStr) return 0;
  const dayMap = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 };
  const parts = recurrenceStr.split(',').map(s => s.trim());
  const scheduledDays = parts
    .map(p => p.split(' ')[0].toUpperCase())
    .filter(d => d in dayMap);

  let count = 0;
  const daysInMonth = new Date(year, month, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    const dow = new Date(year, month - 1, d).getDay();
    const dayName = Object.keys(dayMap).find(k => dayMap[k] === dow);
    if (dayName && scheduledDays.includes(dayName)) count++;
  }
  return count;
}

// Helper: check if a recurrence string includes a given day-of-week (0=Sun … 6=Sat)
function batchScheduledOnDay(recurrenceStr, dayOfWeek) {
  if (!recurrenceStr) return false;
  const dayMap = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 };
  const days = recurrenceStr.split(',').map(s => s.trim().split(' ')[0].toUpperCase());
  return days.some(d => dayMap[d] === dayOfWeek);
}

// ── TEACHER ATTENDANCE ENDPOINTS ─────────────────────────────────────────────

// GET /api/teachers/attendance?date=YYYY-MM-DD
// Returns all batches scheduled on that date with their attendance status
router.get('/attendance', async (req, res) => {
  const date = req.query.date || new Date().toISOString().slice(0, 10);
  try {
    const dow = new Date(date + 'T00:00:00').getDay(); // 0=Sun … 6=Sat

    // Fetch all active batches with teacher info
    const batchesRes = await pool.query(
      `SELECT b.id, b.recurrence, b.start_time, b.end_time, b.capacity,
         i.name as instrument_name,
         t.id as teacher_id, t.name as teacher_name
       FROM batches b
       JOIN instruments i ON i.id = b.instrument_id
       LEFT JOIN teachers t ON t.id = b.teacher_id
       WHERE b.is_makeup = false
       ORDER BY b.start_time`
    );

    // Filter to only batches scheduled on this day-of-week
    const scheduled = batchesRes.rows.filter(b => batchScheduledOnDay(b.recurrence, dow));

    if (scheduled.length === 0) return res.json({ date, batches: [] });

    // Fetch existing teacher_attendance records for this date
    const batchIds = scheduled.map(b => b.id);
    const taRes = await pool.query(
      `SELECT batch_id, status, notes FROM teacher_attendance
       WHERE session_date = $1 AND batch_id = ANY($2)`,
      [date, batchIds]
    );
    const taMap = {};
    taRes.rows.forEach(r => { taMap[r.batch_id] = r; });

    const result = scheduled.map(b => ({
      batch_id: b.id,
      instrument_name: b.instrument_name,
      teacher_id: b.teacher_id,
      teacher_name: b.teacher_name || 'Unassigned',
      recurrence: b.recurrence,
      start_time: b.start_time?.slice(0, 5),
      end_time: b.end_time?.slice(0, 5),
      status: taMap[b.id]?.status || null,   // null = not yet marked
      notes: taMap[b.id]?.notes || ''
    }));

    res.json({ date, batches: result });
  } catch (err) {
    console.error('Teacher attendance GET error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/teachers/attendance
// Body: { teacher_id, batch_id, session_date, status, notes }
router.post('/attendance', async (req, res) => {
  const { teacher_id, batch_id, session_date, status, notes } = req.body;
  if (!batch_id || !session_date || !status) {
    return res.status(400).json({ error: 'batch_id, session_date, and status are required' });
  }
  if (!['conducted', 'not_conducted'].includes(status)) {
    return res.status(400).json({ error: 'status must be conducted or not_conducted' });
  }
  try {
    const marked_by = req.user?.id || null;
    await pool.query(
      `INSERT INTO teacher_attendance (teacher_id, batch_id, session_date, status, notes, marked_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (batch_id, session_date)
       DO UPDATE SET status = $4, notes = $5, marked_by = $6, updated_at = now()`,
      [teacher_id, batch_id, session_date, status, notes || null, marked_by]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Teacher attendance POST error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// ─────────────────────────────────────────────────────────────────────────────

// GET /api/teachers/me/360 — MUST be before /:id/360 to avoid 'me' being treated as an ID
router.get('/me/360', async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });
  try {
    const result = await pool.query(
      `SELECT teacher_id FROM teacher_users WHERE user_id = $1 AND is_active = true LIMIT 1`,
      [req.user.id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No teacher profile linked to this account. Ask an admin to link your account.' });
    }
    res.json({ teacher_id: result.rows[0].teacher_id });
  } catch (err) {
    console.error('Teacher /me/360 error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/teachers/:id/students
// Returns all actively enrolled students under this teacher's batches
router.get('/:id/students', async (req, res) => {
  const teacherId = req.params.id;
  try {
    const result = await pool.query(
      `SELECT DISTINCT
         s.id, s.name, s.phone, s.guardian_contact,
         i.name AS instrument,
         b.id AS batch_id, b.recurrence,
         e.status AS enrollment_status,
         eb.classes_remaining
       FROM students s
       JOIN enrollments e ON s.id = e.student_id
       JOIN enrollment_batches eb ON e.id = eb.enrollment_id
       JOIN batches b ON eb.batch_id = b.id
       JOIN instruments i ON b.instrument_id = i.id
       WHERE b.teacher_id = $1
         AND e.status = 'active'
         AND b.is_makeup = false
       ORDER BY s.name`,
      [teacherId]
    );
    res.json({ students: result.rows });
  } catch (err) {
    console.error('Teacher students error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/teachers/:id/360
router.get('/:id/360', async (req, res) => {
  const teacherId = req.params.id;
  try {
    // 1. Teacher profile
    const teacherRes = await pool.query(
      `SELECT t.*,
         COALESCE(t.metadata->>'email', '') as email
       FROM teachers t
       WHERE t.id = $1`,
      [teacherId]
    );
    if (teacherRes.rows.length === 0) {
      return res.status(404).json({ error: 'Teacher not found' });
    }
    const teacher = teacherRes.rows[0];

    // 2. Assigned batches with active student counts
    const batchesRes = await pool.query(
      `SELECT b.id, i.name as instrument_name, b.recurrence, b.capacity,
         b.start_time, b.end_time,
         COUNT(DISTINCT CASE WHEN e.status = 'active' THEN eb.enrollment_id END) as active_students
       FROM batches b
       JOIN instruments i ON i.id = b.instrument_id
       LEFT JOIN enrollment_batches eb ON eb.batch_id = b.id
       LEFT JOIN enrollments e ON eb.enrollment_id = e.id
       WHERE b.teacher_id = $1
       GROUP BY b.id, i.name`,
      [teacherId]
    );
    const batches = batchesRes.rows;
    const totalActiveStudents = batches.reduce((sum, b) => sum + parseInt(b.active_students || 0), 0);

    // 3. Sessions conducted per month (last 12 months)
    // Combines explicit teacher_attendance records + implicit student attendance records
    const sessionsRes = await pool.query(
      `SELECT month, SUM(conducted) AS conducted FROM (
         -- Explicit teacher attendance marks
         SELECT to_char(date_trunc('month', ta.session_date), 'YYYY-MM') AS month,
                COUNT(DISTINCT ta.session_date::text || '-' || ta.batch_id::text) AS conducted
         FROM teacher_attendance ta
         JOIN batches b ON ta.batch_id = b.id
         WHERE b.teacher_id = $1 AND ta.status = 'conducted'
         GROUP BY date_trunc('month', ta.session_date)
         UNION ALL
         -- Implicit from student attendance (batches where students were marked)
         SELECT to_char(date_trunc('month', ar.session_date), 'YYYY-MM') AS month,
                COUNT(DISTINCT ar.session_date::text || '-' || ar.batch_id::text) AS conducted
         FROM attendance_records ar
         JOIN batches b ON ar.batch_id = b.id
         LEFT JOIN teacher_attendance ta ON ta.batch_id = ar.batch_id AND ta.session_date = ar.session_date
         WHERE b.teacher_id = $1 AND ta.id IS NULL
         GROUP BY date_trunc('month', ar.session_date)
       ) combined
       GROUP BY month
       ORDER BY month DESC
       LIMIT 12`,
      [teacherId]
    );

    // 4. Build monthly breakdown with expected counts
    const monthlyBreakdown = sessionsRes.rows.map(row => {
      const [y, m] = row.month.split('-').map(Number);
      let expected = 0;
      batches.forEach(b => {
        if (b.recurrence) expected += countExpectedSessionsForMonth(b.recurrence, y, m);
      });
      return { month: row.month, conducted: parseInt(row.conducted), expected };
    });

    // 5. Current month stats
    const now = new Date();
    const currentMonthStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    let currentMonthExpected = 0;
    batches.forEach(b => {
      if (b.recurrence) {
        currentMonthExpected += countExpectedSessionsForMonth(b.recurrence, now.getFullYear(), now.getMonth() + 1);
      }
    });
    const currentMonthData = monthlyBreakdown.find(r => r.month === currentMonthStr);
    const currentMonthSessions = currentMonthData?.conducted || 0;
    const totalSessions = sessionsRes.rows.reduce((sum, r) => sum + parseInt(r.conducted), 0);

    // 6. Payout projection (auto-select by payout_type)
    let projectedAmount = 0;
    let projectedBasis = '';
    const rate = parseFloat(teacher.rate) || 0;

    if (teacher.payout_type === 'fixed') {
      projectedAmount = rate;
      projectedBasis = 'Fixed monthly salary';
    } else if (teacher.payout_type === 'per_student_monthly') {
      projectedAmount = totalActiveStudents * rate;
      projectedBasis = `${totalActiveStudents} students × ₹${rate}`;
    }

    // 7. Payout history (last 24 records)
    const payoutsRes = await pool.query(
      `SELECT id, amount, method, period_start, period_end, linked_classes_count, created_at
       FROM teacher_payouts
       WHERE teacher_id = $1
       ORDER BY created_at DESC
       LIMIT 24`,
      [teacherId]
    );
    const payoutHistory = payoutsRes.rows.map(p => ({
      ...p,
      period: p.period_start
        ? new Date(p.period_start).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
        : new Date(p.created_at).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })
    }));
    const totalPaid = payoutHistory.reduce((sum, p) => sum + parseFloat(p.amount), 0);

    res.json({
      profile: {
        id: teacher.id,
        name: teacher.name,
        phone: teacher.phone || '',
        email: teacher.email || '',
        payout_type: teacher.payout_type,
        rate,
        is_active: teacher.is_active,
        batch_count: batches.length,
        batches: batches.map(b => ({
          id: b.id,
          instrument_name: b.instrument_name,
          recurrence: b.recurrence,
          capacity: parseInt(b.capacity),
          active_students: parseInt(b.active_students || 0)
        }))
      },
      attendance: {
        summary: {
          total_sessions_conducted: totalSessions,
          current_month_sessions: currentMonthSessions,
          current_month_expected: currentMonthExpected
        },
        monthly_breakdown: monthlyBreakdown
      },
      payout: {
        projected: {
          amount: projectedAmount,
          basis: projectedBasis,
          model: teacher.payout_type
        },
        history: payoutHistory,
        total_paid: totalPaid
      }
    });
  } catch (err) {
    console.error('Teacher 360 error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
