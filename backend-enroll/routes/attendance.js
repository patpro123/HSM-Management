const express = require('express');
const router = express.Router();
const pool = require('../db');
const rbac = require('../auth/rbacMiddleware');

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
router.post('/', rbac.filterTeacherData, async (req, res) => {
  const { records } = req.body;
  if (!Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ error: 'No attendance records provided' });
  }

  // Teachers may only mark attendance for their own batches
  if (req.dataFilter?.isTeacher) {
    const teacherId = req.dataFilter.teacherId;
    if (!teacherId) {
      return res.status(403).json({ error: 'Teacher account not linked to a profile' });
    }
    const batchIds = [...new Set(records.map(r => r.batch_id))];
    const owned = await pool.query(
      'SELECT id FROM batches WHERE id = ANY($1) AND teacher_id = $2',
      [batchIds, teacherId]
    );
    if (owned.rows.length !== batchIds.length) {
      return res.status(403).json({ error: 'You can only mark attendance for your own batches' });
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const deductCredit = (sId, bId, isGuest) => {
      if (isGuest) {
        return client.query(`
          UPDATE enrollment_batches eb
          SET classes_remaining = COALESCE(eb.classes_remaining, 0) - 1
          FROM enrollments e
          JOIN batches b ON b.id = eb.batch_id
          WHERE eb.enrollment_id = e.id AND e.student_id = $1 AND e.status = 'active'
            AND b.instrument_id = (SELECT instrument_id FROM batches WHERE id = $2)
        `, [sId, bId]);
      }
      return client.query(`
        UPDATE enrollment_batches eb
        SET classes_remaining = COALESCE(eb.classes_remaining, 0) - 1
        FROM enrollments e
        WHERE eb.enrollment_id = e.id AND e.student_id = $1 AND eb.batch_id = $2
      `, [sId, bId]);
    };

    const refundCredit = (sId, bId, isGuest) => {
      if (isGuest) {
        return client.query(`
          UPDATE enrollment_batches eb
          SET classes_remaining = COALESCE(eb.classes_remaining, 0) + 1
          FROM enrollments e
          JOIN batches b ON b.id = eb.batch_id
          WHERE eb.enrollment_id = e.id AND e.student_id = $1 AND e.status = 'active'
            AND b.instrument_id = (SELECT instrument_id FROM batches WHERE id = $2)
        `, [sId, bId]);
      }
      return client.query(`
        UPDATE enrollment_batches eb
        SET classes_remaining = COALESCE(eb.classes_remaining, 0) + 1
        FROM enrollments e
        WHERE eb.enrollment_id = e.id AND e.student_id = $1 AND eb.batch_id = $2
      `, [sId, bId]);
    };

    for (const record of records) {
      const { batch_id, student_id, date, status, is_extra, is_guest } = record;

      if (is_extra) {
        await client.query(
          'INSERT INTO attendance_records (batch_id, student_id, session_date, status, source, is_extra, finalized_at) VALUES ($1, $2, $3, $4, $5, TRUE, NOW())',
          [batch_id, student_id, date, status, 'manual']
        );
        if (status === 'present') {
          await deductCredit(student_id, batch_id, is_guest);
        }
      } else {
        const checkRes = await client.query(
          'SELECT id, status FROM attendance_records WHERE batch_id = $1 AND student_id = $2 AND session_date = $3 AND is_extra = FALSE',
          [batch_id, student_id, date]
        );

        if (checkRes.rows.length > 0) {
          const oldStatus = checkRes.rows[0].status;
          await client.query(
            'UPDATE attendance_records SET status = $1, source = $2, finalized_at = NOW() WHERE id = $3',
            [status, 'manual', checkRes.rows[0].id]
          );

          if (oldStatus !== 'present' && status === 'present') {
            await deductCredit(student_id, batch_id, is_guest);
          } else if (oldStatus === 'present' && status !== 'present') {
            await refundCredit(student_id, batch_id, is_guest);
          }
        } else {
          await client.query(
            'INSERT INTO attendance_records (batch_id, student_id, session_date, status, source, is_extra, finalized_at) VALUES ($1, $2, $3, $4, $5, FALSE, NOW())',
            [batch_id, student_id, date, status, 'manual']
          );
          if (status === 'present') {
            await deductCredit(student_id, batch_id, is_guest);
          }
        }
      }
    }

    await client.query('COMMIT');
    res.json({ message: 'Attendance saved successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Attendance save error:', err);
    res.status(500).json({ error: 'Failed to save attendance' });
  } finally {
    client.release();
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

    if (presentCount > 0) {
      await client.query(`
        UPDATE enrollment_batches eb
        SET classes_remaining = COALESCE(eb.classes_remaining, 0) + $3
        FROM enrollments e
        WHERE eb.enrollment_id = e.id AND e.student_id = $1 AND eb.batch_id = $2
      `, [student_id, batch_id, presentCount]);
    }

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

module.exports = router;
