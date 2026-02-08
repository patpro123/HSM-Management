const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/teachers - List all teachers
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM teachers ORDER BY name');
    res.json({ teachers: result.rows });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch teachers' });
  }
});

// POST /api/teachers - Create new teacher
router.post('/', async (req, res) => {
  const { name, email } = req.body;
  if (!name || !email) {
    return res.status(400).json({ error: 'Missing required fields' });
  }
  try {
    const result = await pool.query(
      'INSERT INTO teachers (name, email) VALUES ($1, $2) RETURNING *',
      [name, email]
    );
    res.status(201).json({ teacher: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: 'Failed to create teacher' });
  }
});

module.exports = router;
