const express = require('express');
const router = express.Router();
const pool = require('../db');
const { fetchStudent360Data } = require('./student360');

// GET /api/portal/student/:email - student 360 view via email lookup
router.get('/student/:email', async (req, res) => {
  const { email } = req.params;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  try {
    const studentRes = await pool.query(
      `SELECT id FROM students WHERE email = $1 OR metadata->>'email' = $1 LIMIT 1`,
      [email]
    );

    if (studentRes.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const data = await fetchStudent360Data(studentRes.rows[0].id);
    if (!data) {
      return res.status(404).json({ error: 'Student data not found' });
    }

    res.json(data);
  } catch (err) {
    console.error('Student 360 error:', err);
    res.status(500).json({ error: 'Failed to fetch student details' });
  }
});

module.exports = router;
