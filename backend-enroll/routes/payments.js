const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/payments - List all payments
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM payments ORDER BY timestamp DESC');
    res.json({ payments: result.rows });
  } catch (err) {
    console.error('Error fetching payments:', err);
    res.status(500).json({ error: 'Failed to fetch payments' });
  }
});

// GET /api/payments/status/:studentId - Get payment status details for a student
router.get('/status/:studentId', async (req, res) => {
  const { studentId } = req.params;
  const { batch_id } = req.query;

  try {
    // 1. Fetch Last Payment
    // We try to filter by instrument if batch_id is provided to be more relevant
    let instrumentId = null;
    if (batch_id) {
      const batchRes = await pool.query('SELECT instrument_id FROM batches WHERE id = $1', [batch_id]);
      if (batchRes.rows.length > 0) instrumentId = batchRes.rows[0].instrument_id;
    }

    let paymentQuery = `
      SELECT p.*, pkg.name as package_name, pkg.classes_count, pkg.instrument_id
      FROM payments p
      LEFT JOIN packages pkg ON p.package_id = pkg.id
      WHERE p.student_id = $1
    `;
    const params = [studentId];

    if (instrumentId) {
      paymentQuery += ` AND (pkg.instrument_id = $2 OR pkg.instrument_id IS NULL)`;
      params.push(instrumentId);
    }

    paymentQuery += ` ORDER BY p.timestamp DESC LIMIT 1`;

    const lastPaymentRes = await pool.query(paymentQuery, params);
    const lastPayment = lastPaymentRes.rows[0] || null;

    // 2. Fetch Classes Remaining
    let classesRemaining = 0;
    if (batch_id) {
      const creditRes = await pool.query(`
        SELECT eb.classes_remaining 
        FROM enrollment_batches eb
        JOIN enrollments e ON eb.enrollment_id = e.id
        WHERE e.student_id = $1 AND eb.batch_id = $2
      `, [studentId, batch_id]);
      if (creditRes.rows.length > 0) classesRemaining = creditRes.rows[0].classes_remaining;
    } else {
      const creditRes = await pool.query(`
        SELECT SUM(eb.classes_remaining) as total 
        FROM enrollment_batches eb
        JOIN enrollments e ON eb.enrollment_id = e.id
        WHERE e.student_id = $1
      `, [studentId]);
      classesRemaining = creditRes.rows[0].total || 0;
    }

    // 3. Calculate Dates
    let expectedStartDate = null;
    let isOverdue = false;

    if (lastPayment) {
      const lastDate = new Date(lastPayment.timestamp);
      let frequency = lastPayment.metadata?.payment_frequency;
      
      if (!frequency && lastPayment.package_name) {
        const name = lastPayment.package_name.toLowerCase();
        if (name.includes('monthly')) frequency = 'monthly';
        else if (name.includes('quarterly')) frequency = 'quarterly';
        else if (name.includes('half')) frequency = 'half_yearly';
        else if (name.includes('yearly')) frequency = 'yearly';
      }

      if (frequency) {
        const nextDate = new Date(lastDate);
        if (frequency === 'monthly') nextDate.setMonth(nextDate.getMonth() + 1);
        else if (frequency === 'quarterly') nextDate.setMonth(nextDate.getMonth() + 3);
        else if (frequency === 'half_yearly') nextDate.setMonth(nextDate.getMonth() + 6);
        else if (frequency === 'yearly') nextDate.setFullYear(nextDate.getFullYear() + 1);
        
        expectedStartDate = nextDate;
        if (new Date() > nextDate) isOverdue = true;
      }
    }

    res.json({
      last_payment: lastPayment,
      classes_remaining: parseInt(classesRemaining),
      expected_start_date: expectedStartDate,
      is_overdue: isOverdue
    });

  } catch (err) {
    console.error('Error fetching payment status:', err);
    res.status(500).json({ error: 'Failed to fetch payment status' });
  }
});

// POST /api/payments - Record a new payment
router.post('/', async (req, res) => {
  const { student_id, batch_id, amount, payment_method, payment_for, notes, class_credits, payment_frequency, payment_date } = req.body;
  
  if (!student_id || !amount) {
    return res.status(400).json({ error: 'Student and amount are required' });
  }

  const creditsToAdd = class_credits ? parseInt(class_credits) : 0;
  let targetBatchId = batch_id;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Insert Payment Record
    const metadata = {
      payment_for,
      notes,
      payment_frequency,
      credits_bought: creditsToAdd
    };

    // Auto-detect batch if not provided and we have credits to add
    if (creditsToAdd !== 0 && !targetBatchId) {
      const batchRes = await client.query(`
        SELECT eb.batch_id 
        FROM enrollment_batches eb
        JOIN enrollments e ON eb.enrollment_id = e.id
        WHERE e.student_id = $1 AND e.status = 'active'
      `, [student_id]);
      
      if (batchRes.rows.length === 1) {
        targetBatchId = batchRes.rows[0].batch_id;
        console.log(`[Payment] Auto-detected batch ${targetBatchId} for student ${student_id}`);
      }
    }

    const paymentRes = await client.query(
      `INSERT INTO payments (student_id, amount, method, metadata, timestamp)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [student_id, amount, payment_method, JSON.stringify(metadata), payment_date || new Date()]
    );

    // 2. Update Student Credits (add purchased credits to total)
    if (creditsToAdd !== 0) {
      await client.query(
        `UPDATE students 
         SET metadata = jsonb_set(
           COALESCE(metadata, '{}'::jsonb), 
           '{total_credits}', 
           (COALESCE((metadata->>'total_credits')::int, 0) + $1)::text::jsonb
         )
         WHERE id = $2`,
        [creditsToAdd, student_id]
      );
    }

    // 3. Update Batch Credits (if batch_id is provided)
    if (creditsToAdd !== 0 && targetBatchId) {
      const updateRes = await client.query(
        `UPDATE enrollment_batches eb
         SET classes_remaining = COALESCE(eb.classes_remaining, 0) + $1
         FROM enrollments e
         WHERE eb.enrollment_id = e.id AND e.student_id = $2 AND eb.batch_id = $3
         RETURNING eb.classes_remaining`,
        [creditsToAdd, student_id, targetBatchId]
      );
      console.log(`[Payment] Updated batch ${targetBatchId} credits. New balance:`, updateRes.rows[0]?.classes_remaining);
    }

    await client.query('COMMIT');
    res.status(201).json({ payment: paymentRes.rows[0], message: 'Payment recorded successfully' });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error recording payment:', err);
    res.status(500).json({ error: 'Failed to record payment' });
  } finally {
    client.release();
  }
});

// PUT /api/payments/:id - Update a payment
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { payment_date, notes, payment_method, payment_for } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Fetch existing payment to preserve other metadata
    const existingRes = await client.query('SELECT metadata FROM payments WHERE id = $1', [id]);
    if (existingRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Payment not found' });
    }
    
    const currentMeta = existingRes.rows[0].metadata || {};
    const newMeta = {
      ...currentMeta,
      notes: notes !== undefined ? notes : currentMeta.notes,
      payment_for: payment_for !== undefined ? payment_for : currentMeta.payment_for
    };

    const result = await client.query(
      `UPDATE payments 
       SET timestamp = $1, 
           method = COALESCE($2, method),
           metadata = $3
       WHERE id = $4 
       RETURNING *`,
      [payment_date, payment_method, JSON.stringify(newMeta), id]
    );

    await client.query('COMMIT');
    res.json({ payment: result.rows[0], message: 'Payment updated successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating payment:', err);
    res.status(500).json({ error: 'Failed to update payment' });
  } finally {
    client.release();
  }
});

module.exports = router;