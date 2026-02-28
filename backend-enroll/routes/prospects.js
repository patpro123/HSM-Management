const express = require('express');
const router = express.Router();
const pool = require('../db');
const nodemailer = require('nodemailer');

// Email transporter (Gmail with App Password)
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

const NOTIFY_EMAILS = ['adminuser@hsm.org.in', 'partho.protim@gmail.com'];

async function sendProspectNotification(prospect) {
    const { name, phone, metadata } = prospect;
    const instrument = metadata?.interested_instrument || 'Not specified';
    const email = metadata?.email || 'Not provided';
    const source = metadata?.lead_source || 'Not specified';

    const mailOptions = {
        from: `"HSM Admissions" <${process.env.SMTP_USER}>`,
        to: NOTIFY_EMAILS.join(', '),
        subject: `New Trial Booking: ${name}`,
        html: `
            <h2>New Demo Class Booking</h2>
            <p>A new prospect has booked a trial session via the HSM website.</p>
            <table style="border-collapse:collapse;width:100%;max-width:500px;">
                <tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:600;">Name</td><td style="padding:8px;border:1px solid #e2e8f0;">${name}</td></tr>
                <tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:600;">Phone</td><td style="padding:8px;border:1px solid #e2e8f0;">${phone}</td></tr>
                <tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:600;">Email</td><td style="padding:8px;border:1px solid #e2e8f0;">${email}</td></tr>
                <tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:600;">Instrument</td><td style="padding:8px;border:1px solid #e2e8f0;">${instrument}</td></tr>
                <tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:600;">How they found us</td><td style="padding:8px;border:1px solid #e2e8f0;">${source}</td></tr>
            </table>
            <p style="margin-top:16px;color:#64748b;font-size:0.9rem;">Please follow up with this prospect within 24 hours.</p>
        `
    };

    console.log(`[prospects] Sending notification email to: ${NOTIFY_EMAILS.join(', ')} for prospect: ${name}`);
    const info = await transporter.sendMail(mailOptions);
    console.log(`[prospects] Email sent successfully. MessageId: ${info.messageId}`);
}

// GET /api/prospects - List all prospect students
// ?include_inactive=true to include inactive prospects
router.get('/', async (req, res) => {
    try {
        const includeInactive = req.query.include_inactive === 'true';
        const whereClause = includeInactive
            ? "WHERE student_type = 'prospect'"
            : "WHERE student_type = 'prospect' AND is_active = true";
        const result = await pool.query(`SELECT * FROM students ${whereClause} ORDER BY created_at DESC`);
        res.json({ prospects: result.rows });
    } catch (err) {
        console.error('[GET /api/prospects] Error:', err);
        res.status(500).json({ error: 'Failed to fetch prospects' });
    }
});

// GET /api/prospects/:id - Get a single prospect
router.get('/:id', async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM students WHERE id = $1 AND student_type = 'prospect'", [req.params.id]);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Prospect not found' });
        res.json({ prospect: result.rows[0] });
    } catch (err) {
        console.error('[GET /api/prospects/:id] Error:', err);
        res.status(500).json({ error: 'Failed to fetch prospect' });
    }
});

// PUT /api/prospects/:id - Update prospect (is_active, metadata.status)
router.put('/:id', async (req, res) => {
    const { is_active, status } = req.body;
    try {
        // Build update: optionally update is_active and/or merge metadata.status
        let query, params;
        if (is_active !== undefined && status !== undefined) {
            query = `UPDATE students SET is_active = $1, metadata = metadata || jsonb_build_object('status', $2::text), updated_at = NOW()
                     WHERE id = $3 AND student_type = 'prospect' RETURNING *`;
            params = [is_active, status, req.params.id];
        } else if (is_active !== undefined) {
            query = `UPDATE students SET is_active = $1, updated_at = NOW() WHERE id = $2 AND student_type = 'prospect' RETURNING *`;
            params = [is_active, req.params.id];
        } else if (status !== undefined) {
            query = `UPDATE students SET metadata = metadata || jsonb_build_object('status', $1::text), updated_at = NOW()
                     WHERE id = $2 AND student_type = 'prospect' RETURNING *`;
            params = [status, req.params.id];
        } else {
            return res.status(400).json({ error: 'Nothing to update' });
        }
        const result = await pool.query(query, params);
        if (result.rows.length === 0) return res.status(404).json({ error: 'Prospect not found' });
        res.json({ prospect: result.rows[0] });
    } catch (err) {
        console.error('[PUT /api/prospects/:id] Error:', err);
        res.status(500).json({ error: 'Failed to update prospect' });
    }
});

// GET /api/prospects/:id/notes - Get all notes for a prospect
router.get('/:id/notes', async (req, res) => {
    try {
        const result = await pool.query(
            'SELECT * FROM prospect_notes WHERE prospect_id = $1 ORDER BY created_at ASC',
            [req.params.id]
        );
        res.json({ notes: result.rows });
    } catch (err) {
        console.error('[GET /api/prospects/:id/notes] Error:', err);
        res.status(500).json({ error: 'Failed to fetch notes' });
    }
});

// POST /api/prospects/:id/notes - Add a note to a prospect
router.post('/:id/notes', async (req, res) => {
    const { note, created_by } = req.body;
    if (!note || !note.trim()) return res.status(400).json({ error: 'Note text is required' });
    try {
        const result = await pool.query(
            'INSERT INTO prospect_notes (prospect_id, note, created_by) VALUES ($1, $2, $3) RETURNING *',
            [req.params.id, note.trim(), created_by || null]
        );
        res.status(201).json({ note: result.rows[0] });
    } catch (err) {
        console.error('[POST /api/prospects/:id/notes] Error:', err);
        res.status(500).json({ error: 'Failed to add note' });
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

        // Send notification email — non-blocking, failures are logged only
        sendProspectNotification(prospect).catch(err =>
            console.error('[prospects] Failed to send notification email:', err.message)
        );

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
