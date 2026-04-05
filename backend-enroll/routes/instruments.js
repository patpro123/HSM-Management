const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/instruments
router.get('/', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM instruments ORDER BY name');
    res.json({ instruments: result.rows });
  } catch (err) {
    console.error('Get instruments error:', err);
    res.status(500).json({ error: 'Failed to fetch instruments' });
  }
});

module.exports = router;
