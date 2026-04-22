const express = require('express');
const router = express.Router();
const pool = require('../db');
const rbac = require('../auth/rbacMiddleware');
const { authenticateJWT } = require('../auth/jwtMiddleware');

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
        b.whatsapp_group_link,
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
    // Dynamic classes_remaining: credits bought for this instrument - attendances in this instrument
    const cte = `
      WITH batch_instrument AS (
        SELECT instrument_id FROM batches WHERE id = $1
      ),
      raw_credits AS (
        SELECT p.student_id,
          CASE
            WHEN (p.metadata->>'credits_bought') IS NOT NULL
                 AND (p.metadata->>'credits_bought')::int > 0
              THEN (p.metadata->>'credits_bought')::int
            WHEN pkg.classes_count IS NOT NULL THEN pkg.classes_count
            ELSE 0
          END AS credits
        FROM payments p
        JOIN packages pkg ON p.package_id = pkg.id
        WHERE pkg.instrument_id = (SELECT instrument_id FROM batch_instrument)
        UNION ALL
        SELECT p.student_id,
          (p.metadata->>'credits_bought')::int AS credits
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
    `;

    let query = cte + `
      SELECT
        s.id as student_id,
        s.name as student_name,
        s.phone,
        s.guardian_contact,
        s.metadata->>'phone' as meta_phone,
        s.metadata->>'guardian_phone' as guardian_phone,
        GREATEST(0, COALESCE(ic.credits, 0) - COALESCE(ia.attended, 0)) AS classes_remaining
    `;
    const params = [batchId];

    if (date) {
      query += `, ar.status as attendance_status, EXISTS(SELECT 1 FROM attendance_records x WHERE x.student_id = s.id AND x.batch_id = eb.batch_id AND x.session_date = $2 AND x.is_extra = TRUE) as has_extra `;
    }

    query += `
      FROM students s
      JOIN enrollments e ON s.id = e.student_id
      JOIN enrollment_batches eb ON e.id = eb.enrollment_id
      LEFT JOIN instr_credits ic ON ic.student_id = s.id
      LEFT JOIN instr_attended ia ON ia.student_id = s.id
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

// GET /api/batches/instrument/:instrumentId/board - fetch all batches with students for instrument (admin only)
router.get('/instrument/:instrumentId/board', authenticateJWT, rbac.authorizeRole(['admin']), async (req, res) => {
  const { instrumentId } = req.params;
  const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
  if (!uuidRegex.test(instrumentId)) {
    return res.status(400).json({ error: 'Invalid instrumentId' });
  }
  try {
    const result = await pool.query(`
      WITH raw_credits AS (
        SELECT p.student_id,
          CASE
            WHEN (p.metadata->>'credits_bought') IS NOT NULL
                 AND (p.metadata->>'credits_bought')::int > 0
              THEN (p.metadata->>'credits_bought')::int
            WHEN pkg.classes_count IS NOT NULL THEN pkg.classes_count
            ELSE 0
          END AS credits
        FROM payments p
        JOIN packages pkg ON p.package_id = pkg.id
        WHERE pkg.instrument_id = $1
        UNION ALL
        SELECT p.student_id,
          (p.metadata->>'credits_bought')::int AS credits
        FROM payments p
        WHERE p.package_id IS NULL
          AND (p.metadata->>'instrument_id')::uuid = $1
          AND (p.metadata->>'credits_bought') IS NOT NULL
          AND (p.metadata->>'credits_bought')::int > 0
      ),
      instr_credits AS (
        SELECT student_id, SUM(credits) AS credits FROM raw_credits GROUP BY student_id
      ),
      instr_attended AS (
        SELECT ar.student_id, COUNT(*) AS attended
        FROM attendance_records ar
        JOIN batches b2 ON ar.batch_id = b2.id
        WHERE b2.instrument_id = $1 AND ar.status = 'present'
        GROUP BY ar.student_id
      )
      SELECT
        b.id AS batch_id,
        b.recurrence,
        b.start_time,
        b.end_time,
        b.capacity,
        b.whatsapp_group_link,
        t.name AS teacher_name,
        s.id AS student_id,
        s.name AS student_name,
        COALESCE(s.phone, s.metadata->>'phone') AS phone,
        s.guardian_contact,
        eb.id AS enrollment_batch_id,
        GREATEST(0, COALESCE(ic.credits, 0) - COALESCE(ia.attended, 0)) AS classes_remaining
      FROM batches b
      LEFT JOIN teachers t ON b.teacher_id = t.id
      LEFT JOIN enrollment_batches eb ON eb.batch_id = b.id
      LEFT JOIN enrollments e ON e.id = eb.enrollment_id AND e.status = 'active'
      LEFT JOIN students s ON s.id = e.student_id
      LEFT JOIN instr_credits ic ON ic.student_id = s.id
      LEFT JOIN instr_attended ia ON ia.student_id = s.id
      WHERE b.instrument_id = $1 AND b.is_makeup = false
      ORDER BY b.recurrence, s.name
    `, [instrumentId]);

    const batchMap = new Map();
    for (const row of result.rows) {
      if (!batchMap.has(row.batch_id)) {
        batchMap.set(row.batch_id, {
          id: row.batch_id,
          recurrence: row.recurrence,
          start_time: row.start_time,
          end_time: row.end_time,
          capacity: row.capacity,
          whatsapp_group_link: row.whatsapp_group_link,
          teacher_name: row.teacher_name,
          students: []
        });
      }
      if (row.student_id) {
        batchMap.get(row.batch_id).students.push({
          student_id: row.student_id,
          student_name: row.student_name,
          phone: row.phone,
          guardian_contact: row.guardian_contact,
          enrollment_batch_id: row.enrollment_batch_id,
          classes_remaining: row.classes_remaining
        });
      }
    }

    res.json({ batches: Array.from(batchMap.values()) });
  } catch (err) {
    console.error('Get instrument board error:', err);
    res.status(500).json({ error: 'Failed to fetch board data' });
  }
});

// POST /api/batches/move-student - move a student from one batch to another (admin only)
router.post('/move-student', authenticateJWT, rbac.authorizeRole(['admin']), async (req, res) => {
  const { enrollment_batch_id, from_batch_id, to_batch_id } = req.body;
  if (!enrollment_batch_id || !from_batch_id || !to_batch_id) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  if (from_batch_id === to_batch_id) {
    return res.status(400).json({ error: 'Source and target batch are the same' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Verify enrollment_batch exists and belongs to from_batch; get student info
    const ebResult = await client.query(`
      SELECT eb.id, e.student_id,
             s.name AS student_name,
             COALESCE(s.phone, s.metadata->>'phone') AS phone,
             s.guardian_contact,
             b_from.instrument_id AS from_instrument_id
      FROM enrollment_batches eb
      JOIN enrollments e ON e.id = eb.enrollment_id
      JOIN students s ON s.id = e.student_id
      JOIN batches b_from ON b_from.id = eb.batch_id
      WHERE eb.id = $1 AND eb.batch_id = $2
    `, [enrollment_batch_id, from_batch_id]);

    if (ebResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Enrollment not found in source batch' });
    }
    const eb = ebResult.rows[0];

    // Verify target batch: same instrument, has capacity
    const targetResult = await client.query(`
      SELECT b.id, b.instrument_id, b.capacity, b.whatsapp_group_link, b.recurrence,
             COUNT(eb2.id) FILTER (WHERE e2.status = 'active') AS current_count
      FROM batches b
      LEFT JOIN enrollment_batches eb2 ON eb2.batch_id = b.id
      LEFT JOIN enrollments e2 ON e2.id = eb2.enrollment_id
      WHERE b.id = $1
      GROUP BY b.id
    `, [to_batch_id]);

    if (targetResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Target batch not found' });
    }
    const target = targetResult.rows[0];

    if (target.instrument_id !== eb.from_instrument_id) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Cannot move student between different instruments' });
    }
    if (parseInt(target.current_count) >= target.capacity) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Target batch is at full capacity' });
    }

    // Check student not already in target batch
    const dupeCheck = await client.query(`
      SELECT eb.id FROM enrollment_batches eb
      JOIN enrollments e ON e.id = eb.enrollment_id
      WHERE eb.batch_id = $1 AND e.student_id = $2 AND e.status = 'active'
    `, [to_batch_id, eb.student_id]);

    if (dupeCheck.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'Student is already in the target batch' });
    }

    // Execute the move
    await client.query('UPDATE enrollment_batches SET batch_id = $1 WHERE id = $2', [to_batch_id, enrollment_batch_id]);

    const fromBatch = await client.query('SELECT recurrence, whatsapp_group_link FROM batches WHERE id = $1', [from_batch_id]);

    await client.query('COMMIT');

    res.json({
      success: true,
      student: { id: eb.student_id, name: eb.student_name, phone: eb.phone, guardian_contact: eb.guardian_contact },
      from_batch: { id: from_batch_id, recurrence: fromBatch.rows[0]?.recurrence, whatsapp_group_link: fromBatch.rows[0]?.whatsapp_group_link },
      to_batch: { id: to_batch_id, recurrence: target.recurrence, whatsapp_group_link: target.whatsapp_group_link }
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Move student error:', err);
    res.status(500).json({ error: 'Failed to move student' });
  } finally {
    client.release();
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
  const { teacher_id, recurrence, start_time, end_time, capacity, whatsapp_group_link } = req.body;

  try {
    const result = await pool.query(
      `UPDATE batches
       SET teacher_id = $1, recurrence = $2, start_time = $3, end_time = $4, capacity = $5,
           whatsapp_group_link = $6, updated_at = NOW()
       WHERE id = $7 RETURNING *`,
      [teacher_id || null, recurrence, start_time, end_time, capacity, whatsapp_group_link || null, id]
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
