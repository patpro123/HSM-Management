const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/prospects - List all prospect students
router.get('/', async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM students WHERE student_type = 'prospect' AND is_active = true ORDER BY created_at DESC");
        res.json({ prospects: result.rows });
    } catch (err) {
        console.error('[GET /api/prospects] Error:', err);
        res.status(500).json({ error: 'Failed to fetch prospects' });
    }
});

// POST /api/prospects - Create a new prospect (from landing page)
router.post('/', async (req, res) => {
    console.log('[POST /api/prospects] Incoming prospect form:', req.body);
    const { name, address, phone, email, instrument, source } = req.body;

    if (!name || !email || !phone) {
        return res.status(400).json({ error: 'Name, email, and phone are required for a trial booking.' });
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Create rich metadata block
        const prospectMetadata = {
            email,
            address,
            interested_instrument: instrument,
            lead_source: source,
            status: 'new'
        };

        // Insert student explicitly as a prospect
        const insertQuery = `
      INSERT INTO students (name, phone, metadata, student_type, is_active) 
      VALUES ($1, $2, $3, 'prospect', true) 
      RETURNING *
    `;

        const prospectResult = await client.query(insertQuery, [
            name,
            phone,
            JSON.stringify(prospectMetadata)
        ]);

        await client.query('COMMIT');
        const prospect = prospectResult.rows[0];
        console.log('[POST /api/prospects] Prospect created successfully:', prospect.id);

        res.status(201).json({ message: 'Demo class booked successfully!', prospect });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[POST /api/prospects] Error storing prospect:', err);
        res.status(500).json({ error: 'Failed to record demo booking.' });
    } finally {
        client.release();
    }
});

module.exports = router;
