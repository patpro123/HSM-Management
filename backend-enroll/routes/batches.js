const express = require('express');
const router = express.Router();
const pool = require('../db');
const rbac = require('../auth/rbacMiddleware');

// GET /api/batches - fetch all batches with instrument and teacher details
router.get('/', rbac.filterTeacherData, async (req, res) => {
  try {
    let queryArgs = [];
    let teacherFilter = '';

    if (req.dataFilter && req.dataFilter.isTeacher) {
      if (!req.dataFilter.teacherId) {
        return res.json({ batches: [] });
      }
      teacherFilter = `AND b.teacher_id = $1`;
      queryArgs.push(req.dataFilter.teacherId);
    }

    const result = await pool.query(`
      SELECT
        b.id,
        b.recurrence,
        b.start_time,
        b.end_time,
        b.capacity,
        b.is_makeup,
        i.id as instrument_id,
        i.name as instrument_name,
        t.id as teacher_id,
        t.name as teacher_name,
        COUNT(eb.id) FILTER (WHERE e.status = 'active') AS student_count
      FROM batches b
      JOIN instruments i ON b.instrument_id = i.id
      LEFT JOIN teachers t ON b.teacher_id = t.id
      LEFT JOIN enrollment_batches eb ON eb.batch_id = b.id
      LEFT JOIN enrollments e ON e.id = eb.enrollment_id
      WHERE b.is_makeup = false ${teacherFilter}
      GROUP BY b.id, i.id, i.name, t.id, t.name
      ORDER BY i.name, b.recurrence
    `, queryArgs);
    res.json({ batches: result.rows });
  } catch (err) {
    console.error('Get batches error:', err);
    res.status(500).json({ error: 'Failed to fetch batches' });
  }
});

// GET /api/batches/:batchId/students - fetch students for a specific batch
// Must come before /:instrumentId to avoid route shadowing
router.get('/:batchId/students', async (req, res) => {
  const { batchId } = req.params;
  const { date } = req.query;

  try {
    let query = `
      SELECT
        s.id as student_id,
        s.name as student_name,
        s.phone,
        s.guardian_contact,
        s.metadata->>'phone' as meta_phone,
        s.metadata->>'guardian_phone' as guardian_phone,
        eb.classes_remaining
    `;
    const params = [batchId];

    if (date) {
      query += `, ar.status as attendance_status, EXISTS(SELECT 1 FROM attendance_records x WHERE x.student_id = s.id AND x.batch_id = eb.batch_id AND x.session_date = $2 AND x.is_extra = TRUE) as has_extra `;
    }

    query += `
      FROM students s
      JOIN enrollments e ON s.id = e.student_id
      JOIN enrollment_batches eb ON e.id = eb.enrollment_id
    `;

    if (date) {
      query += ` LEFT JOIN attendance_records ar ON ar.student_id = s.id AND ar.batch_id = eb.batch_id AND ar.session_date = $2 AND ar.is_extra = FALSE `;
      params.push(date);
    }

    query += ` WHERE eb.batch_id = $1 AND e.status = 'active' ORDER BY s.name`;

    const result = await pool.query(query, params);
    res.json({ students: result.rows });
  } catch (err) {
    console.error('Get batch students error:', err);
    res.status(500).json({ error: 'Failed to fetch students for batch' });
  }
});

// GET /api/batches/:instrumentId - fetch batches for a specific instrument
router.get('/:instrumentId', async (req, res) => {
  const { instrumentId } = req.params;
  const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  if (!instrumentId || !uuidRegex.test(instrumentId)) {
    console.warn('Invalid instrumentId param:', instrumentId);
    return res.status(400).json({ error: 'Invalid instrumentId parameter' });
  }
  try {
    const result = await pool.query(`
      SELECT
        b.id,
        b.recurrence,
        b.start_time,
        b.end_time,
        b.capacity,
        b.is_makeup,
        i.name as instrument_name,
        t.id as teacher_id,
        t.name as teacher_name
      FROM batches b
      JOIN instruments i ON b.instrument_id = i.id
      LEFT JOIN teachers t ON b.teacher_id = t.id
      WHERE b.instrument_id = $1 AND b.is_makeup = false
      ORDER BY b.recurrence
    `, [instrumentId]);
    res.json({ batches: result.rows });
  } catch (err) {
    console.error('Get batches by instrument error:', err);
    res.status(500).json({ error: 'Failed to fetch batches' });
  }
});

// POST /api/batches - create a new batch
router.post('/', async (req, res) => {
  const { instrument_id, teacher_id, recurrence, start_time, end_time, capacity } = req.body;

  if (!instrument_id || !recurrence || !start_time || !end_time) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const result = await pool.query(
      `INSERT INTO batches (instrument_id, teacher_id, recurrence, start_time, end_time, capacity)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [instrument_id, teacher_id || null, recurrence, start_time, end_time, capacity || 8]
    );
    res.status(201).json({ batch: result.rows[0] });
  } catch (err) {
    console.error('Create batch error:', err);
    res.status(500).json({ error: 'Failed to create batch' });
  }
});

// PUT /api/batches/:id - update a batch
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { teacher_id, recurrence, start_time, end_time, capacity } = req.body;

  try {
    const result = await pool.query(
      `UPDATE batches
       SET teacher_id = $1, recurrence = $2, start_time = $3, end_time = $4, capacity = $5, updated_at = NOW()
       WHERE id = $6 RETURNING *`,
      [teacher_id || null, recurrence, start_time, end_time, capacity, id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Batch not found' });
    }

    res.json({ batch: result.rows[0] });
  } catch (err) {
    console.error('Update batch error:', err);
    res.status(500).json({ error: 'Failed to update batch' });
  }
});

// DELETE /api/batches/:id - delete a batch
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM batches WHERE id = $1 RETURNING *', [id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Batch not found' });
    }
    res.json({ message: 'Batch deleted successfully', batch: result.rows[0] });
  } catch (err) {
    console.error('Delete batch error:', err);
    if (err.code === '23503') {
      return res.status(400).json({ error: 'Cannot delete batch with active enrollments or attendance records.' });
    }
    res.status(500).json({ error: 'Failed to delete batch' });
  }
});

module.exports = router;
