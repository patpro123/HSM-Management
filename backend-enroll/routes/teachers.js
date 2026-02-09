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

// PUT /api/teachers/:id - Update teacher
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, email, phone, payout_type, rate, is_active } = req.body;
  try {
    const result = await pool.query(
      `UPDATE teachers 
       SET name = $1, email = COALESCE($2, email), phone = COALESCE($3, phone), payout_type = COALESCE($4, payout_type), rate = COALESCE($5, rate), is_active = COALESCE($6, is_active), updated_at = NOW()
       WHERE id = $7 RETURNING *`,
      [name, email, phone, payout_type, rate, is_active, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Teacher not found' });
    }
    res.json({ teacher: result.rows[0] });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Failed to update teacher' });
  }
});

// DELETE /api/teachers/:id - Delete teacher
router.delete('/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM teachers WHERE id = $1 RETURNING *', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Teacher not found' });
    }
    res.json({ message: 'Teacher deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete teacher. They may be assigned to batches.' });
  }
});

module.exports = router;
