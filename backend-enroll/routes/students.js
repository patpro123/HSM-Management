const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateJWT } = require('../auth/jwtMiddleware');
const { authorizeRole } = require('../auth/rbacMiddleware');

// GET /api/students - List all permanent students with enrollments
router.get('/', async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM students WHERE student_type = 'permanent' OR student_type IS NULL ORDER BY name");
    res.json({ students: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch students' });
  }
});

// POST /api/students - Create new student (admin only)
router.post('/', authenticateJWT, authorizeRole(['admin']), async (req, res) => {
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
        if (freq === 'pbel_4') totalCredits += 4;
        else if (freq === 'trial') totalCredits += 4;
        else if (freq === 'pbel_8') totalCredits += 8;
        else if (freq === 'monthly') totalCredits += 8;
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

    // Validate: max 2 batches per instrument
    if (Array.isArray(batches) && batches.length > 0) {
      const batchIdList = batches.map(b => String(b.batch_id));
      const batchInstrRes = await client.query(
        'SELECT id, instrument_id FROM batches WHERE id = ANY($1)',
        [batchIdList]
      );
      const instrCount = new Map();
      for (const row of batchInstrRes.rows) {
        const iid = String(row.instrument_id);
        instrCount.set(iid, (instrCount.get(iid) || 0) + 1);
      }
      for (const [iid, count] of instrCount) {
        if (count > 2) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'A student can be assigned to at most 2 batches per instrument' });
        }
      }
    }

    // Insert enrollment_batches
    let enrollmentBatchRows = [];
    if (Array.isArray(batches)) {
      for (const batch of batches) {
        const { batch_id, payment_frequency, classes_remaining, enrolled_on, trinity_grade, fee_structure_id } = batch;

        let initialCredits = classes_remaining || 0;
        let freq = (payment_frequency || 'monthly').toLowerCase();

        // Translate PBEL AND trial package types to valid DB enum values
        if (freq === 'pbel_4') { initialCredits = initialCredits || 4; freq = 'monthly'; }
        else if (freq === 'pbel_8') { initialCredits = initialCredits || 8; freq = 'monthly'; }
        else if (freq === 'trial') { initialCredits = initialCredits || 4; freq = 'monthly'; }
        else if (!initialCredits && freq === 'monthly') initialCredits = 8;
        else if (!initialCredits && freq === 'quarterly') initialCredits = 24;
        else if (!initialCredits && freq === 'half_yearly') initialCredits = 48;
        else if (!initialCredits && freq === 'yearly') initialCredits = 96;

        const batchResult = await client.query(
          `INSERT INTO enrollment_batches
             (enrollment_id, batch_id, payment_frequency, classes_remaining, enrolled_on, trinity_grade, fee_structure_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
          [
            enrollment.id, batch_id, freq, initialCredits,
            enrolled_on || new Date(),
            trinity_grade || 'Initial',
            fee_structure_id || null
          ]
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

// DELETE /api/students/:id - Soft delete a student (admin only)
router.delete('/:id', authenticateJWT, authorizeRole(['admin']), async (req, res) => {
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

// POST /api/students/:id/restore - Restore a soft-deleted student (admin only)
router.post('/:id/restore', authenticateJWT, authorizeRole(['admin']), async (req, res) => {
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

// POST /api/students/:studentId/image - upload student profile image (base64)
router.post('/:studentId/image', async (req, res) => {
  const { studentId } = req.params;
  const { image } = req.body || {};
  if (!image || typeof image !== 'string') {
    return res.status(400).json({ error: 'image (base64 string) is required' });
  }
  try {
    const updateRes = await pool.query(
      `UPDATE students SET metadata = jsonb_set(
        COALESCE(metadata, '{}'::jsonb),
        '{image}',
        to_jsonb($1)
      ) WHERE id = $2 RETURNING id`,
      [image, studentId]
    );
    if (updateRes.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    res.json({ ok: true, studentId, message: 'Image uploaded successfully' });
  } catch (err) {
    console.error('Image upload error:', err);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

// PUT /api/students/:id - Update student details and enrollments (admin only)
router.put('/:id', authenticateJWT, authorizeRole(['admin']), async (req, res) => {
  const { id } = req.params;
  const { name, dob, phone, guardian_contact, metadata, batches } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 0. Fetch current student to preserve existing metadata
    const currentRes = await client.query('SELECT metadata FROM students WHERE id = $1', [id]);
    if (currentRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Student not found' });
    }
    const currentMetadata = currentRes.rows[0].metadata || {};

    // Calculate total credits from the incoming batches array (which represents the desired state)
    let totalCredits = 0;
    if (Array.isArray(batches)) {
      const instrumentFreqs = new Map();
      batches.forEach(b => {
        const key = b.instrument_id || b.batch_id;
        const freq = (b.payment_frequency || 'monthly').toLowerCase();
        instrumentFreqs.set(key, freq);
      });

      instrumentFreqs.forEach(freq => {
        if (freq === 'pbel_4') totalCredits += 4;
        else if (freq === 'trial') totalCredits += 4;
        else if (freq === 'pbel_8') totalCredits += 8;
        else if (freq === 'monthly') totalCredits += 8;
        else if (freq === 'quarterly') totalCredits += 24;
        else if (freq === 'half_yearly') totalCredits += 48;
        else if (freq === 'yearly') totalCredits += 96;
      });
    }

    // Merge metadata: Current + Incoming + Calculated Credits
    const incomingMetadata = typeof metadata === 'string' ? JSON.parse(metadata || '{}') : (metadata || {});
    const finalMetadata = {
      ...currentMetadata,
      ...incomingMetadata,
      total_credits: totalCredits
    };

    // 1. Update Student Basic Info & Upgrade Prospect to Permanent
    const updateQuery = `
      UPDATE students
      SET name = COALESCE($1, name),
          dob = COALESCE($2, dob),
          phone = COALESCE($3, phone),
          guardian_contact = COALESCE($4, guardian_contact),
          metadata = $5,
          student_type = 'permanent',
          updated_at = NOW()
      WHERE id = $6
      RETURNING *
    `;

    const studentRes = await client.query(updateQuery, [
      name,
      dob || null,
      phone,
      guardian_contact,
      JSON.stringify(finalMetadata),
      id
    ]);

    // 2. Update Enrollments/Batches if provided
    if (batches && Array.isArray(batches)) {
      // Ensure active enrollment exists
      let enrollmentRes = await client.query(
        "SELECT id FROM enrollments WHERE student_id = $1 AND status = 'active'",
        [id]
      );

      let enrollmentId;
      if (enrollmentRes.rows.length === 0) {
        const newEnr = await client.query(
          "INSERT INTO enrollments (student_id, status, classes_remaining) VALUES ($1, 'active', 0) RETURNING id",
          [id]
        );
        enrollmentId = newEnr.rows[0].id;
      } else {
        enrollmentId = enrollmentRes.rows[0].id;
      }

      // Get current batches
      const currentBatchesRes = await client.query(
        "SELECT id, batch_id FROM enrollment_batches WHERE enrollment_id = $1",
        [enrollmentId]
      );
      const currentBatches = currentBatchesRes.rows;

      const newBatchIds = batches.map(b => String(b.batch_id));
      const currentBatchIds = currentBatches.map(b => String(b.batch_id));

      // Determine additions and removals
      const toAdd = batches.filter(b => !currentBatchIds.includes(String(b.batch_id)));
      const toRemove = currentBatches.filter(b => !newBatchIds.includes(String(b.batch_id)));
      const toUpdate = batches.filter(b => currentBatchIds.includes(String(b.batch_id)));

      // Validate: max 2 batches per instrument
      if (newBatchIds.length > 0) {
        const batchInstrRes = await client.query(
          'SELECT id, instrument_id FROM batches WHERE id = ANY($1)',
          [newBatchIds]
        );
        const instrCount = new Map();
        for (const row of batchInstrRes.rows) {
          const iid = String(row.instrument_id);
          instrCount.set(iid, (instrCount.get(iid) || 0) + 1);
        }
        for (const [iid, count] of instrCount) {
          if (count > 2) {
            await client.query('ROLLBACK');
            return res.status(400).json({ error: 'A student can be assigned to at most 2 batches per instrument' });
          }
        }
      }

      // Remove unselected batches
      for (const b of toRemove) {
        await client.query("DELETE FROM enrollment_batches WHERE id = $1", [b.id]);
      }

      // Add new batches
      for (const b of toAdd) {
        let initialCredits = 0;
        let freq = (b.payment_frequency || 'monthly').toLowerCase();
        // Translate PBEL package types to valid DB enum values
        if (freq === 'pbel_4') { initialCredits = 4; freq = 'monthly'; }
        else if (freq === 'pbel_8') { initialCredits = 8; freq = 'monthly'; }
        else if (freq === 'trial') { initialCredits = 4; freq = 'monthly'; }
        else if (freq === 'monthly') initialCredits = 8;
        else if (freq === 'quarterly') initialCredits = 24;
        else if (freq === 'half_yearly') initialCredits = 48;
        else if (freq === 'yearly') initialCredits = 96;

        await client.query(
          `INSERT INTO enrollment_batches
           (enrollment_id, batch_id, payment_frequency, classes_remaining, enrolled_on, trinity_grade, fee_structure_id)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [enrollmentId, b.batch_id, freq, initialCredits, b.enrolled_on || new Date(),
            b.trinity_grade || 'Initial', b.fee_structure_id || null]
        );
      }

      // Update existing batches (e.g. payment frequency change)
      for (const b of toUpdate) {
        const existingRecord = currentBatches.find(cb => String(cb.batch_id) === String(b.batch_id));
        if (existingRecord) {
          let updFreq = (b.payment_frequency || 'monthly').toLowerCase();
          if (updFreq === 'pbel_4' || updFreq === 'pbel_8' || updFreq === 'trial') updFreq = 'monthly';
          await client.query(
            `UPDATE enrollment_batches
              SET payment_frequency = $1, enrolled_on = $2
              WHERE id = $3`,
            [updFreq, b.enrolled_on || new Date(), existingRecord.id]
          );
        }
      }
    }

    await client.query('COMMIT');
    res.json({ student: studentRes.rows[0], message: 'Student updated successfully' });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error updating student:', err);
    res.status(500).json({ error: 'Failed to update student' });
  } finally {
    client.release();
  }
});

module.exports = router;
