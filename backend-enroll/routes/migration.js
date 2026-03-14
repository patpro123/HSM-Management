const express = require('express');
const router = express.Router();
const db = require('../db');
const { authenticateJWT } = require('../auth/jwtMiddleware');
const { authorizeRole } = require('../auth/rbacMiddleware');

// GET /api/migration/data?search=<name>
// Returns matching students (all, not just backfilled) with per-instrument enrollment data.
// Each record includes the most recent payment for that student+instrument and whether it is backfilled.
router.get('/data', authenticateJWT, authorizeRole(['admin']), async (req, res) => {
  const { search } = req.query;

  if (!search || search.trim().length < 2) {
    return res.json([]);
  }

  try {
    // Find matching students who have enrollments
    const studentsResult = await db.query(`
      SELECT DISTINCT s.id AS student_id, s.name AS student_name, e.id AS enrollment_id
      FROM students s
      JOIN enrollments e ON e.student_id = s.id
      WHERE s.name ILIKE $1
      ORDER BY s.name
      LIMIT 50
    `, [`%${search.trim()}%`]);

    const records = [];

    for (const student of studentsResult.rows) {
      // Get all enrollment_batches for this student with instrument info
      const batchesResult = await db.query(`
        SELECT
          eb.id,
          eb.classes_remaining,
          eb.payment_frequency,
          b.recurrence,
          b.start_time,
          b.end_time,
          t.name AS teacher_name,
          i.id AS instrument_id,
          i.name AS instrument_name
        FROM enrollment_batches eb
        JOIN batches b ON b.id = eb.batch_id
        JOIN instruments i ON i.id = b.instrument_id
        JOIN teachers t ON t.id = b.teacher_id
        WHERE eb.enrollment_id = $1
        ORDER BY i.name, eb.id
      `, [student.enrollment_id]);

      if (batchesResult.rows.length === 0) continue;

      // Group by instrument
      const instrumentMap = {};
      for (const row of batchesResult.rows) {
        if (!instrumentMap[row.instrument_id]) {
          instrumentMap[row.instrument_id] = {
            instrument_id: row.instrument_id,
            instrument_name: row.instrument_name,
            classes_remaining: 0,
            batches: [],
          };
        }
        instrumentMap[row.instrument_id].classes_remaining += parseInt(row.classes_remaining) || 0;
        instrumentMap[row.instrument_id].batches.push({
          id: row.id,
          classes_remaining: row.classes_remaining,
          payment_frequency: row.payment_frequency,
          recurrence: row.recurrence,
          start_time: row.start_time,
          end_time: row.end_time,
          teacher_name: row.teacher_name,
        });
      }

      // For each instrument, find the most recent payment
      for (const instrData of Object.values(instrumentMap)) {
        const paymentResult = await db.query(`
          SELECT
            p.id,
            p.timestamp AS payment_date,
            p.amount,
            p.metadata,
            COALESCE((p.metadata->>'backfill')::boolean, false) AS is_backfill
          FROM payments p
          JOIN packages pkg ON pkg.id = p.package_id
          WHERE p.student_id = $1 AND pkg.instrument_id = $2
          ORDER BY p.timestamp DESC
          LIMIT 1
        `, [student.student_id, instrData.instrument_id]);

        const payment = paymentResult.rows[0] || null;

        records.push({
          student_id: student.student_id,
          student_name: student.student_name,
          instrument_id: instrData.instrument_id,
          instrument_name: instrData.instrument_name,
          classes_remaining: instrData.classes_remaining,
          batches: instrData.batches,
          payment: payment ? {
            id: payment.id,
            payment_date: payment.payment_date,
            amount: payment.amount,
            metadata: payment.metadata,
            is_backfill: payment.is_backfill,
          } : null,
        });
      }
    }

    res.json(records);
  } catch (err) {
    console.error('GET /api/migration/data error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/migration/payment/:paymentId
// Updates the payment date (timestamp). Only allowed for backfilled payments.
router.put('/payment/:paymentId', authenticateJWT, authorizeRole(['admin']), async (req, res) => {
  const { paymentId } = req.params;
  const { payment_date } = req.body;

  if (!payment_date) {
    return res.status(400).json({ error: 'payment_date is required' });
  }

  try {
    const result = await db.query(
      `UPDATE payments SET timestamp = $1 WHERE id = $2 AND (metadata->>'backfill')::boolean = true RETURNING id, timestamp`,
      [payment_date, paymentId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Payment not found or not a backfilled record' });
    }

    res.json({ success: true, payment: result.rows[0] });
  } catch (err) {
    console.error('PUT /api/migration/payment error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/migration/classes
// Body: { student_id, instrument_id, classes_remaining, force }
// Sets total classes_remaining for the student+instrument, distributing across batch slots (CEIL/FLOOR split).
// If no backfill payment exists for student+instrument and force != true, returns 409 with a warning.
router.put('/classes', authenticateJWT, authorizeRole(['admin']), async (req, res) => {
  const { student_id, instrument_id, classes_remaining, force } = req.body;

  if (!student_id || !instrument_id) {
    return res.status(400).json({ error: 'student_id and instrument_id are required' });
  }

  if (classes_remaining === undefined || classes_remaining === null) {
    return res.status(400).json({ error: 'classes_remaining is required' });
  }

  const total = parseInt(classes_remaining, 10);
  if (isNaN(total) || total < 0) {
    return res.status(400).json({ error: 'classes_remaining must be a non-negative integer' });
  }

  // Check if a backfill payment exists for this student+instrument
  const backfillCheck = await db.query(`
    SELECT COUNT(*) AS cnt
    FROM payments p
    JOIN packages pkg ON pkg.id = p.package_id
    WHERE p.student_id = $1 AND pkg.instrument_id = $2
      AND (p.metadata->>'backfill')::boolean = true
  `, [student_id, instrument_id]);

  const isBackfill = parseInt(backfillCheck.rows[0].cnt) > 0;

  if (!isBackfill && !force) {
    return res.status(409).json({
      warning: true,
      message: 'This student was not backfilled. Updating classes remaining will overwrite live data. Set force=true to confirm.',
    });
  }

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Find all enrollment_batch IDs for this student+instrument, ordered for stable split
    const batchRows = await client.query(`
      SELECT eb.id, eb.enrollment_id
      FROM enrollment_batches eb
      JOIN enrollments e ON e.id = eb.enrollment_id
      JOIN batches b ON b.id = eb.batch_id
      WHERE e.student_id = $1 AND b.instrument_id = $2
      ORDER BY eb.id
    `, [student_id, instrument_id]);

    if (batchRows.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'No enrollment batch slots found for this student+instrument' });
    }

    const slots = batchRows.rows;
    const count = slots.length;

    // Distribute: slot 0 gets CEIL, rest share FLOOR
    for (let i = 0; i < count; i++) {
      const slotVal = i === 0 ? Math.ceil(total / count) : Math.floor(total / count);
      await client.query(
        `UPDATE enrollment_batches SET classes_remaining = $1 WHERE id = $2`,
        [slotVal, slots[i].id]
      );
    }

    // Sync enrollment total
    const enrollmentId = slots[0].enrollment_id;
    await client.query(`
      UPDATE enrollments SET
        classes_remaining = (
          SELECT COALESCE(SUM(eb.classes_remaining), 0)
          FROM enrollment_batches eb WHERE eb.enrollment_id = $1
        ),
        updated_at = now()
      WHERE id = $1
    `, [enrollmentId]);

    await client.query('COMMIT');
    res.json({ success: true, classes_remaining: total, slots_updated: count });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('PUT /api/migration/classes error:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

module.exports = router;
