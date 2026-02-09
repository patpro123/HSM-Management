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
  const { name, phone, email, payout_type, rate, is_active } = req.body;
  if (!name) {
    return res.status(400).json({ error: 'Teacher name is required' });
  }
  try {
    const metadata = { email: email || null };
    const result = await pool.query(
      `INSERT INTO teachers (name, phone, payout_type, rate, is_active, metadata) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING *`,
      [name, phone || null, payout_type || 'per_class', rate || 0, is_active !== undefined ? is_active : true, metadata]
    );
    res.status(201).json({ teacher: result.rows[0] });
  } catch (err) {
    console.error('Create teacher error:', err);
    res.status(500).json({ error: 'Failed to create teacher' });
  }
});

// PUT /api/teachers/:id - Update teacher
router.put('/:id', async (req, res) => {
  const { id } = req.params;
  const { name, phone, email, payout_type, rate, is_active } = req.body;
  try {
    const result = await pool.query(
      `UPDATE teachers 
       SET name = $1, phone = COALESCE($2, phone), payout_type = COALESCE($3, payout_type), rate = COALESCE($4, rate), is_active = COALESCE($5, is_active), 
           metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{email}', to_jsonb($6::text)), updated_at = NOW()
       WHERE id = $7 RETURNING *`,
      [name, phone, payout_type, rate, is_active, email || '', id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Teacher not found' });
    }
    res.json({ teacher: result.rows[0] });
  } catch (err) {
    console.error('Update teacher error:', err);
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
