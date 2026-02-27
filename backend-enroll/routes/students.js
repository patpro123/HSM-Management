const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/students - List all permanent students with enrollments
router.get('/', async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM students WHERE student_type = 'permanent' OR student_type IS NULL ORDER BY name");
    res.json({ students: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

// POST /api/students - Create new student
router.post('/', async (req, res) => {
  console.log('[POST /api/students] Incoming body:', req.body);
  const { first_name, last_name, email, dob, phone, guardian_name, guardian_phone, address, batches, payment, metadata } = req.body;
  if (!first_name || !last_name || !email) {
    console.warn('[POST /api/students] Missing required fields:', req.body);
    return res.status(400).json({ error: 'Missing required fields' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // Calculate total credits from batches
    let totalCredits = 0;
    if (Array.isArray(batches)) {
      const instrumentFreqs = new Map();
      batches.forEach(b => {
        const key = b.instrument_id || b.batch_id;
        const freq = (b.payment_frequency || 'monthly').toLowerCase();
        instrumentFreqs.set(key, freq);
      });

      instrumentFreqs.forEach(freq => {
        if (freq === 'monthly') totalCredits += 8;
        else if (freq === 'quarterly') totalCredits += 24;
        else if (freq === 'half_yearly') totalCredits += 48;
        else if (freq === 'yearly') totalCredits += 96;
      });
    }

    // Prepare metadata
    const studentMetadata = {
      ...metadata,
      email: email || metadata?.email,
      address: address || metadata?.address,
      guardian_name: guardian_name || metadata?.guardian_name,
      guardian_phone: guardian_phone || metadata?.guardian_phone,
      total_credits: totalCredits
    };

    // Insert student
    const studentResult = await client.query(
      'INSERT INTO students (name, dob, phone, guardian_contact, metadata) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [
        `${first_name} ${last_name}`,
        dob || null,
        phone || null,
        guardian_name || null,
        JSON.stringify(studentMetadata)
      ]
    );
    const student = studentResult.rows[0];

    // Insert enrollment
    const enrollmentResult = await client.query(
      'INSERT INTO enrollments (student_id, status) VALUES ($1, $2) RETURNING *',
      [student.id, 'active']
    );
    const enrollment = enrollmentResult.rows[0];

    // Insert enrollment_batches
    let enrollmentBatchRows = [];
    if (Array.isArray(batches)) {
      for (const batch of batches) {
        const { batch_id, payment_frequency, classes_remaining, enrolled_on } = batch;

        let initialCredits = classes_remaining || 0;
        const freq = (payment_frequency || '').toLowerCase();
        if (!initialCredits && freq === 'monthly') initialCredits = 8;
        if (!initialCredits && freq === 'quarterly') initialCredits = 24;

        const batchResult = await client.query(
          'INSERT INTO enrollment_batches (enrollment_id, batch_id, payment_frequency, classes_remaining, enrolled_on) VALUES ($1, $2, $3, $4, $5) RETURNING *',
          [enrollment.id, batch_id, payment_frequency || 'monthly', initialCredits, enrolled_on || new Date()]
        );
        enrollmentBatchRows.push(batchResult.rows[0]);
      }
    }

    // Insert payment
    let paymentRow = null;
    if (payment && payment.amount && payment.method) {
      const { amount, method, package_id, transaction_id } = payment;
      const payResult = await client.query(
        'INSERT INTO payments (student_id, package_id, amount, method, transaction_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
        [student.id, package_id || null, amount, method, transaction_id || null]
      );
      paymentRow = payResult.rows[0];
    }

    await client.query('COMMIT');
    console.log('[POST /api/students] Student and related records created successfully:', { student, enrollment, enrollmentBatchRows, paymentRow });
    res.status(201).json({ student, enrollment, enrollment_batches: enrollmentBatchRows, payment: paymentRow });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[POST /api/students] Error:', err);
    res.status(500).json({ error: 'Failed to create student with enrollments/payment' });
  } finally {
    client.release();
  }
});

// DELETE /api/students/:id - Soft delete a student (unenroll and mark inactive)
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Mark student as inactive
    const updateRes = await client.query(
      'UPDATE students SET is_active = false WHERE id = $1 RETURNING *',
      [id]
    );

    if (updateRes.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Student not found' });
    }

    // 2. Remove batch links (delete from enrollment_batches)
    await client.query(
      'DELETE FROM enrollment_batches WHERE enrollment_id IN (SELECT id FROM enrollments WHERE student_id = $1)',
      [id]
    );

    // 3. Update enrollment status to completed
    await client.query("UPDATE enrollments SET status = 'completed' WHERE student_id = $1", [id]);

    await client.query('COMMIT');
    res.status(204).send();
  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`[DELETE /api/students/${id}] Error:`, err);
    res.status(500).json({ error: 'Failed to delete student' });
  } finally {
    client.release();
  }
});

// POST /api/students/:id/restore - Restore a soft-deleted student
router.post('/:id/restore', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'UPDATE students SET is_active = true WHERE id = $1 RETURNING *',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    // Restore enrollment status to active
    await pool.query("UPDATE enrollments SET status = 'active' WHERE student_id = $1", [id]);

    res.json({ message: 'Student restored successfully', student: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to restore student' });
  }
});

module.exports = router;
