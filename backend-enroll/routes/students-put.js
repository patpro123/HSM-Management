const express = require('express');
const router = express.Router();
const pool = require('../db');

// PUT /api/students/:id - Update student details and enrollments
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { first_name, last_name, dob, phone, guardian_name, guardian_phone, address, email, batches, metadata } = req.body;
  console.log(`[PUT /api/students/${id}] Incoming body:`, req.body);
  
  if (!first_name || !last_name || !email) {
    return res.status(400).json({ error: 'Missing required fields: first_name, last_name, email' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Get current student metadata
    const currentStudent = await client.query('SELECT metadata FROM students WHERE id = $1', [id]);
    const currentMetadata = currentStudent.rows[0]?.metadata || {};

    // Prepare new metadata by merging old and new
    const newMetadata = {
      ...currentMetadata,
      ...metadata,
      email: email || metadata?.email,
      address: address || metadata?.address,
      guardian_name: guardian_name || metadata?.guardian_name,
      guardian_phone: guardian_phone || metadata?.guardian_phone,
    };
    
    // Update student record
    const studentResult = await client.query(
      'UPDATE students SET name = $1, dob = $2, phone = $3, guardian_contact = $4, metadata = $5, updated_at = now() WHERE id = $6 RETURNING *',
      [
        `${first_name} ${last_name}`,
        dob || null,
        phone || null,
        guardian_name || null,
        JSON.stringify(newMetadata),
        id
      ]
    );
    const student = studentResult.rows[0];

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // This is a simplified example. A full implementation would also handle batch updates (add/remove/update).
    // For now, we are just updating the student's core profile.
    
    await client.query('COMMIT');
    console.log(`[PUT /api/students/${id}] Student updated successfully:`, student);
    res.json({ student });

  } catch (err) {
    await client.query('ROLLBACK');
    console.error(`[PUT /api/students/${id}] Error:`, err);
    res.status(500).json({ error: 'Failed to update student' });
  } finally {
    client.release();
  }
});

module.exports = router;
