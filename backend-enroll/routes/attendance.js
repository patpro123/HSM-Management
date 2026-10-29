const express = require('express');
const router = express.Router();
const pool = require('../db');
const rbac = require('../auth/rbacMiddleware');
const { authorizeRole } = require('../auth/rbacMiddleware');
const { authenticateJWT } = require('../auth/jwtMiddleware');
const attendanceService = require('../services/attendanceService');
const { toLocalDateStr, batchScheduledOnDay } = attendanceService;

// GET /api/attendance - fetch attendance records
router.get('/', rbac.filterTeacherData, async (req, res) => {
  const { student_id, batch_id, start_date, end_date } = req.query;
  try {
    let pIdx = 1;
    const params = [];
    let query = `
      SELECT ar.*, s.name as student_name
      FROM attendance_records ar
      JOIN students s ON ar.student_id = s.id
    `;

    if (req.dataFilter && req.dataFilter.isTeacher) {
      if (!req.dataFilter.teacherId) {
        return res.json({ attendance: [] });
      }
      query += ` JOIN batches b ON ar.batch_id = b.id `;
    }

    query += ` WHERE 1=1 `;

    if (req.dataFilter && req.dataFilter.isTeacher) {
      query += ` AND b.teacher_id = $${pIdx++} `;
      params.push(req.dataFilter.teacherId);
    }

    if (student_id) {
      query += ` AND ar.student_id = $${pIdx++}`;
      params.push(student_id);
    }
    if (batch_id) {
      query += ` AND ar.batch_id = $${pIdx++}`;
      params.push(batch_id);
    }
    if (start_date) {
      query += ` AND ar.session_date >= $${pIdx++}`;
      params.push(start_date);
    }
    if (end_date) {
      query += ` AND ar.session_date <= $${pIdx++}`;
      params.push(end_date);
    }

    query += ' ORDER BY ar.session_date DESC';

    const result = await pool.query(query, params);
    res.json({ attendance: result.rows });
  } catch (err) {
    console.error('Get attendance error:', err);
    res.status(500).json({ error: 'Failed to fetch attendance' });
  }
});

// POST /api/attendance - mark attendance
router.post('/', authenticateJWT, rbac.filterTeacherData, async (req, res) => {
  const { records } = req.body;
  if (!Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ error: 'No attendance records provided' });
  }

  // Teachers may mark attendance for any batch (e.g. covering for a colleague).
  // Records in batches they don't own get a note naming who marked them.
  let notes = new Map(); // batch_id -> note
  if (req.dataFilter?.isTeacher) {
    const teacherId = req.dataFilter.teacherId;
    if (!teacherId) {
      return res.status(403).json({ error: 'Teacher account not linked to a profile' });
    }
    notes = await attendanceService.buildAttendanceNotes(pool, {
      batchIds: [...new Set(records.map(r => r.batch_id))],
      teacherId,
      markerName: req.user.name || req.user.email,
    });
    if (!notes) {
      return res.status(404).json({ error: 'One or more batches not found' });
    }
  }

  try {
    await attendanceService.saveAttendanceTransaction(records, notes);
    res.json({ message: 'Attendance saved successfully' });
  } catch (err) {
    console.error('Attendance save error:', err);
    res.status(500).json({ error: 'Failed to save attendance' });
  }
});

// DELETE /api/attendance?batch_id=&student_id=&date= — un-mark a student (removes the regular, non-extra record)
router.delete('/', authenticateJWT, authorizeRole(['admin', 'teacher']), async (req, res) => {
  const { batch_id, student_id, date } = req.query;
  if (!batch_id || !student_id || !date) {
    return res.status(400).json({ error: 'batch_id, student_id and date are required' });
  }
  try {
    const result = await pool.query(
      'DELETE FROM attendance_records WHERE batch_id = $1 AND student_id = $2 AND session_date = $3 AND is_extra = FALSE',
      [batch_id, student_id, date]
    );
    res.json({ success: true, removed: result.rowCount });
  } catch (err) {
    console.error('Delete attendance error:', err);
    res.status(500).json({ error: 'Failed to remove attendance' });
  }
});

// POST /api/attendance/extra/remove - remove all extra-session records for a student on a date and refund credits
router.post('/extra/remove', async (req, res) => {
  const { batch_id, student_id, date } = req.body;
  if (!batch_id || !student_id || !date) {
    return res.status(400).json({ error: 'batch_id, student_id and date are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query(
      'SELECT id, status FROM attendance_records WHERE batch_id = $1 AND student_id = $2 AND session_date = $3 AND is_extra = TRUE',
      [batch_id, student_id, date]
    );

    if (existing.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.json({ message: 'No extra records found' });
    }

    const presentCount = existing.rows.filter(r => r.status === 'present').length;

    await client.query(
      'DELETE FROM attendance_records WHERE batch_id = $1 AND student_id = $2 AND session_date = $3 AND is_extra = TRUE',
      [batch_id, student_id, date]
    );

    await client.query('COMMIT');
    res.json({ message: 'Extra session removed', refunded: presentCount });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Delete extra attendance error:', err);
    res.status(500).json({ error: 'Failed to remove extra session' });
  } finally {
    client.release();
  }
});

// GET /api/attendance/report — admin-only absence dashboard
// Query: filterType=instrument|teacher, filterId=UUID, period=daily|weekly|monthly, date=YYYY-MM-DD
router.get('/report', authenticateJWT, authorizeRole(['admin']), async (req, res) => {
  const { filterType, filterId, period = 'weekly', date } = req.query;

  const anchor = date ? new Date(date + 'T00:00:00') : new Date();
  anchor.setHours(0, 0, 0, 0);

  let startDate, endDate;
  if (period === 'daily') {
    startDate = endDate = toLocalDateStr(anchor);
  } else if (period === 'weekly') {
    const dow = anchor.getDay();
    const diffToMon = dow === 0 ? -6 : 1 - dow;
    const mon = new Date(anchor);
    mon.setDate(anchor.getDate() + diffToMon);
    const sun = new Date(mon);
    sun.setDate(mon.getDate() + 6);
    startDate = toLocalDateStr(mon);
    endDate   = toLocalDateStr(sun);
  } else {
    const y = anchor.getFullYear(), m = anchor.getMonth();
    startDate = toLocalDateStr(new Date(y, m, 1));
    endDate   = toLocalDateStr(new Date(y, m + 1, 0));
  }

  try {
    const params = [startDate, endDate];
    let filterWhere = '';
    if (filterType === 'instrument' && filterId) {
      filterWhere = 'AND b.instrument_id = $3';
      params.push(filterId);
    } else if (filterType === 'teacher' && filterId) {
      filterWhere = 'AND b.teacher_id = $3';
      params.push(filterId);
    }

    const result = await pool.query(`
      SELECT
        s.id   AS student_id,
        s.name AS student_name,
        COUNT(*) FILTER (WHERE ar.status = 'present')             AS present_count,
        COUNT(*) FILTER (WHERE ar.status != 'present')            AS absent_count,
        COUNT(*)::int                                              AS total_sessions
      FROM attendance_records ar
      JOIN students s ON s.id = ar.student_id
      JOIN batches  b ON b.id = ar.batch_id
      WHERE ar.session_date >= $1
        AND ar.session_date <= $2
        AND ar.is_extra = FALSE
        ${filterWhere}
      GROUP BY s.id, s.name
      ORDER BY absent_count DESC, s.name
    `, params);

    const students = result.rows.map(r => {
      const absentCount   = parseInt(r.absent_count);
      const totalSessions = parseInt(r.total_sessions);
      const absentPct     = totalSessions > 0 ? Math.round((absentCount / totalSessions) * 100) : 0;
      return {
        student_id:    r.student_id,
        name:          r.student_name,
        present_count: parseInt(r.present_count),
        absent_count:  absentCount,
        total_sessions: totalSessions,
        absent_pct:    absentPct,
        flagged:       absentPct >= 30,
      };
    });

    const totalPresent = students.reduce((sum, s) => sum + s.present_count, 0);
    const totalAbsent  = students.reduce((sum, s) => sum + s.absent_count, 0);

    res.json({
      period,
      start_date: startDate,
      end_date: endDate,
      students,
      summary: {
        total_present: totalPresent,
        total_absent: totalAbsent,
        total_students: students.length,
      },
    });
  } catch (err) {
    console.error('[GET /attendance/report]', err);
    res.status(500).json({ error: 'Failed to generate attendance report' });
  }
});

// GET /api/attendance/absences — admin-only, cross-teacher absentee list for a date
// Query: date=YYYY-MM-DD (defaults to today)
router.get('/absences', authenticateJWT, authorizeRole(['admin']), async (req, res) => {
  const date = req.query.date || toLocalDateStr(new Date());
  const dow = new Date(date + 'T00:00:00').getDay();

  try {
    const batchesRes = await pool.query(`
      SELECT b.id, b.recurrence, b.teacher_id, t.name AS teacher_name, i.name AS instrument_name
      FROM batches b
      JOIN teachers   t ON t.id = b.teacher_id
      JOIN instruments i ON i.id = b.instrument_id
      WHERE b.is_makeup = FALSE
    `);

    const scheduled = batchesRes.rows.filter(b => batchScheduledOnDay(b.recurrence, dow));
    if (scheduled.length === 0) return res.json({ date, teachers: [] });

    const batchIds = scheduled.map(b => b.id);

    const studentsRes = await pool.query(`
      SELECT DISTINCT ON (s.id, b.id)
        s.id   AS student_id,
        s.name,
        b.id   AS batch_id,
        COALESCE(ar.status::text, 'not_marked') AS attendance_status,
        COALESCE((
          SELECT json_agg(json_build_object('id', ha.id, 'title', ha.title, 'created_at', ha.created_at) ORDER BY ha.created_at DESC)
          FROM homework_assignments ha
          WHERE ha.student_id = s.id AND ha.batch_id = b.id AND ha.session_date = $1 AND ha.is_makeup = TRUE
        ), '[]'::json) AS makeup_assignments
      FROM enrollment_batches eb
      JOIN enrollments  e  ON e.id  = eb.enrollment_id AND e.status = 'active'
      JOIN students     s  ON s.id  = e.student_id
      JOIN batches      b  ON b.id  = eb.batch_id
      LEFT JOIN attendance_records ar
             ON ar.student_id   = s.id
            AND ar.batch_id     = b.id
            AND ar.session_date = $1
            AND ar.is_extra     = FALSE
      WHERE eb.batch_id = ANY($2)
      ORDER BY s.id, b.id, ar.session_date DESC NULLS LAST
    `, [date, batchIds]);

    const batchMap = {};
    for (const b of scheduled) {
      batchMap[b.id] = {
        batch_id: b.id,
        teacher_id: b.teacher_id,
        teacher_name: b.teacher_name,
        instrument_name: b.instrument_name,
        students: [],
      };
    }
    for (const row of studentsRes.rows) {
      if (row.attendance_status === 'present') continue;
      const batch = batchMap[row.batch_id];
      if (batch) {
        batch.students.push({
          student_id: row.student_id,
          name: row.name,
          attendance_status: row.attendance_status,
          makeup_assignments: row.makeup_assignments,
        });
      }
    }

    const teacherMap = {};
    for (const batch of Object.values(batchMap)) {
      if (batch.students.length === 0) continue;
      if (!teacherMap[batch.teacher_id]) {
        teacherMap[batch.teacher_id] = {
          teacher_id: batch.teacher_id,
          teacher_name: batch.teacher_name,
          batches: [],
        };
      }
      teacherMap[batch.teacher_id].batches.push({
        batch_id: batch.batch_id,
        instrument_name: batch.instrument_name,
        students: batch.students,
      });
    }

    const teachers = Object.values(teacherMap).sort((a, b) => a.teacher_name.localeCompare(b.teacher_name));
    res.json({ date, teachers });
  } catch (err) {
    console.error('[GET /attendance/absences]', err);
    res.status(500).json({ error: 'Failed to fetch absences' });
  }
});

// GET /api/attendance/by-date — every batch with its students and attendance for one date.
// Admins and teachers both get all teachers' batches so a teacher can cover for a colleague;
// the frontend defaults teachers to their own batches (viewer_teacher_id).
// Query: date=YYYY-MM-DD (defaults to today)
router.get('/by-date', authenticateJWT, authorizeRole(['admin', 'teacher']), rbac.filterTeacherData, async (req, res) => {
  const date = req.query.date || toLocalDateStr(new Date());
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return res.status(400).json({ error: 'date must be YYYY-MM-DD' });
  }
  try {
    const batches = await attendanceService.getAttendanceByDate(pool, date);
    res.json({
      date,
      viewer_teacher_id: req.dataFilter?.isTeacher ? req.dataFilter.teacherId : null,
      batches,
    });
  } catch (err) {
    console.error('[GET /attendance/by-date]', err);
    res.status(500).json({ error: 'Failed to fetch attendance for date' });
  }
});

module.exports = router;
