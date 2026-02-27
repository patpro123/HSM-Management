const express = require('express');
const router = express.Router();
const pool = require('../db');

// PUT /api/students/:id - Update student details and enrollments
router.put('/:id', async (req, res) => {
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
        if (freq === 'monthly') totalCredits += 8;
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

      // Remove unselected batches
      for (const b of toRemove) {
        await client.query("DELETE FROM enrollment_batches WHERE id = $1", [b.id]);
      }

      // Add new batches
      for (const b of toAdd) {
        let initialCredits = 0;
        const freq = (b.payment_frequency || 'monthly').toLowerCase();
        if (freq === 'monthly') initialCredits = 8;
        else if (freq === 'quarterly') initialCredits = 24;
        else if (freq === 'half_yearly') initialCredits = 48;
        else if (freq === 'yearly') initialCredits = 96;

        await client.query(
          `INSERT INTO enrollment_batches 
           (enrollment_id, batch_id, payment_frequency, classes_remaining, enrolled_on)
           VALUES ($1, $2, $3, $4, $5)`,
          [enrollmentId, b.batch_id, freq, initialCredits, b.enrolled_on || new Date()]
        );
      }

      // Update existing batches (e.g. payment frequency change)
      for (const b of toUpdate) {
        const existingRecord = currentBatches.find(cb => String(cb.batch_id) === String(b.batch_id));
        if (existingRecord) {
          await client.query(
            `UPDATE enrollment_batches 
              SET payment_frequency = $1, enrolled_on = $2
              WHERE id = $3`,
            [b.payment_frequency || 'monthly', b.enrolled_on || new Date(), existingRecord.id]
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