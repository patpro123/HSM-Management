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

// POST /api/payments - Record a new payment
router.post('/', async (req, res) => {
  const { student_id, amount, payment_method, payment_for, notes, class_credits, payment_frequency, payment_date } = req.body;
  
  if (!student_id || !amount) {
    return res.status(400).json({ error: 'Student and amount are required' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Insert Payment Record
    const metadata = {
      payment_for,
      notes,
      payment_frequency,
      credits_bought: class_credits ? parseInt(class_credits) : 0
    };

    const paymentRes = await client.query(
      `INSERT INTO payments (student_id, amount, method, metadata, timestamp)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [student_id, amount, payment_method, JSON.stringify(metadata), payment_date || new Date()]
    );

    // 2. Update Student Credits (add purchased credits to total)
    if (class_credits) {
      await client.query(
        `UPDATE students 
         SET metadata = jsonb_set(
           COALESCE(metadata, '{}'::jsonb), 
           '{total_credits}', 
           (COALESCE((metadata->>'total_credits')::int, 0) + $1)::text::jsonb
         )
         WHERE id = $2`,
        [class_credits, student_id]
      );
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