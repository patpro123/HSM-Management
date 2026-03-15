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

    // 2. Fetch Classes Remaining (total + per-instrument breakdown)
    let classesRemaining = 0;
    const breakdownRes = await pool.query(`
      SELECT i.name as instrument, SUM(eb.classes_remaining) as remaining
      FROM enrollment_batches eb
      JOIN enrollments e ON eb.enrollment_id = e.id
      JOIN batches b ON eb.batch_id = b.id
      JOIN instruments i ON b.instrument_id = i.id
      WHERE e.student_id = $1
      GROUP BY i.name
      ORDER BY i.name
    `, [studentId]);
    const instrumentBreakdown = Object.fromEntries(
      breakdownRes.rows.map(r => [r.instrument, parseInt(r.remaining) || 0])
    );
    classesRemaining = Object.values(instrumentBreakdown).reduce((sum, v) => sum + v, 0);

    // If batch_id provided and breakdown is empty (edge case), fall back to direct lookup
    if (batch_id && breakdownRes.rows.length === 0) {
      const creditRes = await pool.query(`
        SELECT eb.classes_remaining
        FROM enrollment_batches eb
        JOIN enrollments e ON eb.enrollment_id = e.id
        WHERE e.student_id = $1 AND eb.batch_id = $2
      `, [studentId, batch_id]);
      if (creditRes.rows.length > 0) classesRemaining = creditRes.rows[0].classes_remaining;
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
      instrument_breakdown: instrumentBreakdown,
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

// GET /api/payments/credit-report?student_ids=1,2,3
// Returns attendance + payment credit summary per student (since last payment cycle)
router.get('/credit-report', async (req, res) => {
  const { student_ids } = req.query;

  try {
    // Fetch students — either specific IDs or all active students
    let studentsRes;
    if (student_ids) {
      const ids = student_ids.split(',').map(id => id.trim()).filter(Boolean);
      studentsRes = await pool.query(
        `SELECT id, name, phone, guardian_contact, metadata
         FROM students
         WHERE id = ANY($1::uuid[])
         ORDER BY name`,
        [ids]
      );
    } else {
      studentsRes = await pool.query(
        `SELECT s.id, s.name, s.phone, s.guardian_contact, s.metadata
         FROM students s
         JOIN enrollments e ON e.student_id = s.id AND e.status = 'active'
         ORDER BY s.name`
      );
    }

    const students = studentsRes.rows;

    const reports = await Promise.all(students.map(async (student) => {
      const sid = student.id;

      // 1. Last payment
      const lastPaymentRes = await pool.query(
        `SELECT p.*, pkg.classes_count
         FROM payments p
         LEFT JOIN packages pkg ON p.package_id = pkg.id
         WHERE p.student_id = $1
         ORDER BY p.timestamp DESC LIMIT 1`,
        [sid]
      );
      const lastPayment = lastPaymentRes.rows[0] || null;

      // Determine credits bought and last payment date
      let totalCreditsBought = 0;
      let lastCreditDate = null;
      let lastPaymentDate = null;

      if (lastPayment) {
        lastCreditDate = lastPayment.timestamp;
        lastPaymentDate = lastPayment.timestamp;

        if (lastPayment.metadata?.credits_bought) {
          totalCreditsBought = parseInt(lastPayment.metadata.credits_bought);
        } else if (lastPayment.classes_count) {
          totalCreditsBought = lastPayment.classes_count;
        } else {
          const freq = lastPayment.metadata?.payment_frequency || '';
          if (freq.includes('monthly')) totalCreditsBought = 8;
          else if (freq.includes('quarterly')) totalCreditsBought = 24;
          else if (freq.includes('half')) totalCreditsBought = 48;
          else if (freq.includes('yearly')) totalCreditsBought = 96;
        }
      }

      // 2. Attendance since last payment
      let attendanceQuery = `
        SELECT
          COUNT(*) FILTER (WHERE status = 'present') AS attended,
          COUNT(*) FILTER (WHERE status = 'absent') AS missed
        FROM attendance_records
        WHERE student_id = $1
      `;
      const attendanceParams = [sid];
      if (lastPaymentDate) {
        attendanceQuery += ` AND session_date >= $2::date`;
        attendanceParams.push(lastPaymentDate);
      }
      const attendanceRes = await pool.query(attendanceQuery, attendanceParams);
      const classesAttended = parseInt(attendanceRes.rows[0]?.attended || 0);
      const classesMissed = parseInt(attendanceRes.rows[0]?.missed || 0);

      // 3. Classes remaining per instrument
      const creditsRes = await pool.query(
        `SELECT i.name AS instrument, SUM(eb.classes_remaining) AS remaining
         FROM enrollment_batches eb
         JOIN enrollments e ON eb.enrollment_id = e.id
         JOIN batches b ON eb.batch_id = b.id
         JOIN instruments i ON b.instrument_id = i.id
         WHERE e.student_id = $1 AND e.status = 'active'
         GROUP BY i.name
         ORDER BY i.name`,
        [sid]
      );
      const instrumentCredits = Object.fromEntries(
        creditsRes.rows.map(r => [r.instrument, parseInt(r.remaining) || 0])
      );
      const creditsRemaining = Object.values(instrumentCredits).reduce((sum, v) => sum + v, 0);

      // 4. Next payment date
      let nextPaymentDate = null;
      let isOverdue = false;
      if (lastPayment) {
        let frequency = lastPayment.metadata?.payment_frequency;
        if (!frequency && lastPayment.metadata?.payment_for) {
          const pf = (lastPayment.metadata.payment_for || '').toLowerCase();
          if (pf.includes('monthly')) frequency = 'monthly';
          else if (pf.includes('quarterly')) frequency = 'quarterly';
          else if (pf.includes('half')) frequency = 'half_yearly';
          else if (pf.includes('yearly')) frequency = 'yearly';
        }
        if (frequency) {
          const next = new Date(lastPayment.timestamp);
          if (frequency === 'monthly') next.setMonth(next.getMonth() + 1);
          else if (frequency === 'quarterly') next.setMonth(next.getMonth() + 3);
          else if (frequency === 'half_yearly') next.setMonth(next.getMonth() + 6);
          else if (frequency === 'yearly') next.setFullYear(next.getFullYear() + 1);
          nextPaymentDate = next.toISOString();
          if (new Date() > next) isOverdue = true;
        }
      }

      // 5. Phone resolution: student phone first, guardian contact as fallback
      const phone = student.phone || student.guardian_contact || null;

      return {
        student_id: sid,
        student_name: student.name,
        phone,
        classes_attended: classesAttended,
        classes_missed: classesMissed,
        total_credits_bought: totalCreditsBought,
        last_credit_date: lastCreditDate,
        instrument_credits: instrumentCredits,
        credits_remaining: creditsRemaining,
        next_payment_date: nextPaymentDate,
        is_overdue: isOverdue
      };
    }));

    res.json({ reports });
  } catch (err) {
    console.error('Error fetching credit report:', err);
    res.status(500).json({ error: 'Failed to fetch credit report' });
  }
});

module.exports = router;