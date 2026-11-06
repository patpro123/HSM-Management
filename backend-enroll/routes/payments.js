const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateJWT } = require('../auth/jwtMiddleware');
const { authorizeRole } = require('../auth/rbacMiddleware');
const { recordPayment } = require('../services/paymentService');
const { computeClassesRemaining } = require('../utils/credits');
const { ServiceError } = require('../services/serviceError');
const { fetchDues } = require('../llm/dues');
const { prepareMessage } = require('../services/whatsappMessages');

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

// GET /api/payments/dues?max_remaining=5 - Students whose paid classes are used up or nearly so,
// one row per student (all their low instruments), each with a prepared WhatsApp reminder
router.get('/dues', authenticateJWT, authorizeRole(['admin', 'head_of_school']), async (req, res) => {
  const n = parseInt(req.query.max_remaining, 10);
  const maxRemaining = Number.isFinite(n) ? Math.min(Math.max(n, 0), 24) : 5;
  try {
    const rows = await fetchDues({ maxRemaining });
    const byStudent = new Map();
    for (const r of rows) {
      if (!byStudent.has(r.student_id)) byStudent.set(r.student_id, { student_id: r.student_id, name: r.name, dues: [] });
      byStudent.get(r.student_id).dues.push(r);
    }
    const students = await Promise.all([...byStudent.values()].map(async s => {
      const msg = await prepareMessage({ studentId: s.student_id, studentName: s.name, kind: 'payment_followup', data: { dues: s.dues } });
      return {
        student_id: s.student_id,
        name: s.name,
        min_remaining: Math.min(...s.dues.map(d => d.classes_remaining)),
        instruments: s.dues.map(d => ({
          instrument: d.instrument, allowance: d.allowance, used: d.used,
          classes_remaining: d.classes_remaining, overdue_classes: d.overdue_classes,
          last_paid_on: d.last_paid_on, pending_amount: d.pending_amount,
        })),
        to: msg.to, text: msg.text, link: msg.link,
      };
    }));
    students.sort((a, b) => a.min_remaining - b.min_remaining || a.name.localeCompare(b.name));
    res.json({ students, max_remaining: maxRemaining });
  } catch (err) {
    console.error('Error fetching dues:', err);
    res.status(500).json({ error: 'Failed to fetch pending payments' });
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

    // 2. Fetch Classes Remaining — computed dynamically: credits_bought - present_attendances
    const { byInstrument: instrumentBreakdown } = await computeClassesRemaining(pool, studentId);
    const classesRemaining = Object.values(instrumentBreakdown).reduce((sum, v) => sum + v, 0);

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
router.post('/', authenticateJWT, authorizeRole(['admin']), async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { payment } = await recordPayment(client, req.body, req.user?.id);
    await client.query('COMMIT');
    res.status(201).json({ payment, message: 'Payment recorded successfully' });
  } catch (err) {
    await client.query('ROLLBACK');
    if (err instanceof ServiceError) return res.status(err.status).json({ error: err.message });
    console.error('[Payment] Error recording payment for student', req.body?.student_id, ':', err.message, err.detail || '');
    res.status(500).json({ error: err.message || 'Failed to record payment' });
  } finally {
    client.release();
  }
});

// PUT /api/payments/:id - Update a payment
router.put('/:id', authenticateJWT, authorizeRole(['admin']), async (req, res) => {
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
        } else if (lastPayment.metadata?.period_start && lastPayment.metadata?.period_end) {
          // Infer from period duration: 1 month=8, 3 months=24, 6 months=48, 12 months=96
          const start = new Date(lastPayment.metadata.period_start);
          const end = new Date(lastPayment.metadata.period_end);
          const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
          if (months <= 1) totalCreditsBought = 8;
          else if (months <= 3) totalCreditsBought = 24;
          else if (months <= 6) totalCreditsBought = 48;
          else totalCreditsBought = 96;
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

      // 3. Classes remaining per instrument — dynamic: credits_bought - present_attendances
      const { byInstrument: instrumentCredits } = await computeClassesRemaining(pool, sid);
      const creditsRemaining = Object.values(instrumentCredits).reduce((sum, v) => sum + v, 0);

      // 4. Next payment date
      let nextPaymentDate = null;
      let isOverdue = false;
      if (lastPayment) {
        // Primary: use period_end stored directly in metadata
        if (lastPayment.metadata?.period_end) {
          const next = new Date(lastPayment.metadata.period_end);
          nextPaymentDate = next.toISOString();
          if (new Date() > next) isOverdue = true;
        } else {
          // Fallback: compute from payment_frequency
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
