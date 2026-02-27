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

    await transporter.sendMail(mailOptions);
    console.log(`[prospects] Notification email sent for prospect: ${name}`);
}

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
