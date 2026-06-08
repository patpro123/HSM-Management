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
    const locationLabels = { hsm_main: 'HSM Main Branch', pbel_city: 'PBEL City' };
    const location = locationLabels[metadata?.location] || metadata?.location || 'Not specified';
    const guardianName = metadata?.guardian_name || '';
    const guardianPhone = metadata?.guardian_phone || '';
    const notes = metadata?.notes || '';
    const demoType = metadata?.demo_type || 'normal';

    const isDemoDay = demoType === 'demo_day';
    const subject = isDemoDay
        ? `New Enquiry (Demo Day): ${name} — ${instrument}`
        : `New Enquiry: ${name} — ${instrument}`;
    const headerTitle = isDemoDay
        ? `New Student Enquiry (Demo Day)`
        : `New Student Enquiry`;

    const mailOptions = {
        from: `"HSM Admissions" <${process.env.SMTP_USER}>`,
        to: NOTIFY_EMAILS.join(', '),
        subject: subject,
        html: `
            <h2>${headerTitle}</h2>
            <p>A new prospect has submitted an enquiry via the HSM intake form.</p>
            <table style="border-collapse:collapse;width:100%;max-width:560px;">
                <tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:600;background:#f8fafc;">Name</td><td style="padding:8px;border:1px solid #e2e8f0;">${name}</td></tr>
                <tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:600;background:#f8fafc;">Phone</td><td style="padding:8px;border:1px solid #e2e8f0;">${phone}</td></tr>
                <tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:600;background:#f8fafc;">Email</td><td style="padding:8px;border:1px solid #e2e8f0;">${email}</td></tr>
                <tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:600;background:#f8fafc;">Branch</td><td style="padding:8px;border:1px solid #e2e8f0;">${location}</td></tr>
                <tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:600;background:#f8fafc;">Instrument / Stream</td><td style="padding:8px;border:1px solid #e2e8f0;">${instrument}</td></tr>
                <tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:600;background:#f8fafc;">Enquiry Type</td><td style="padding:8px;border:1px solid #e2e8f0;">${isDemoDay ? 'Demo Day Spot Booking' : 'Regular Trial Class'}</td></tr>
                ${guardianName ? `<tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:600;background:#f8fafc;">Guardian Name</td><td style="padding:8px;border:1px solid #e2e8f0;">${guardianName}</td></tr>` : ''}
                ${guardianPhone ? `<tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:600;background:#f8fafc;">Guardian Phone</td><td style="padding:8px;border:1px solid #e2e8f0;">${guardianPhone}</td></tr>` : ''}
                <tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:600;background:#f8fafc;">How they found us</td><td style="padding:8px;border:1px solid #e2e8f0;">${source}</td></tr>
                ${notes ? `<tr><td style="padding:8px;border:1px solid #e2e8f0;font-weight:600;background:#f8fafc;">Notes</td><td style="padding:8px;border:1px solid #e2e8f0;">${notes}</td></tr>` : ''}
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

// GET /api/intentful-users - List intentful users (from exit intent modal)
router.get('/intentful-users', async (req, res) => {
    try {
        const includeInactive = req.query.include_inactive === 'true';
        const whereClause = includeInactive
            ? "WHERE student_type = 'intentful_user'"
            : "WHERE student_type = 'intentful_user' AND is_active = true";
        const result = await pool.query(`SELECT * FROM students ${whereClause} ORDER BY created_at DESC`);
        res.json({ intentful_users: result.rows });
    } catch (err) {
        console.error('[GET /api/prospects/intentful-users] Error:', err);
        res.status(500).json({ error: 'Failed to fetch intentful users' });
    }
});

// POST /api/intentful-users/:id/convert - Convert an intentful user to a prospect
// Body: { instrument?: string, notes?: string }
router.post('/intentful-users/:id/convert', async (req, res) => {
    const { instrument, notes } = req.body || {};
    try {
        const extraMeta = {
            status: 'new',
            converted_from_intentful: true,
            converted_at: new Date().toISOString(),
        };
        if (instrument) extraMeta.interested_instrument = instrument;
        if (notes) extraMeta.notes = notes;

        const result = await pool.query(
            `UPDATE students SET student_type = 'prospect',
             metadata = metadata || $2::jsonb,
             updated_at = NOW()
             WHERE id = $1 AND student_type = 'intentful_user' RETURNING *`,
            [req.params.id, JSON.stringify(extraMeta)]
        );
        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Intentful user not found' });
        }
        res.json({ prospect: result.rows[0] });
    } catch (err) {
        console.error('[POST /api/prospects/intentful-users/:id/convert] Error:', err);
        res.status(500).json({ error: 'Failed to convert intentful user to prospect' });
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

// PUT /api/prospects/:id - Update prospect (is_active, metadata, status)
router.put('/:id', async (req, res) => {
    const { is_active, status, metadata } = req.body;
    try {
        let query, params;
        if (is_active !== undefined && status !== undefined) {
            query = `UPDATE students SET is_active = $1, metadata = metadata || jsonb_build_object('status', $2::text) || $3::jsonb, updated_at = NOW()
                     WHERE id = $4 AND student_type = 'prospect' RETURNING *`;
            params = [is_active, status, JSON.stringify(metadata || {}), req.params.id];
        } else if (is_active !== undefined) {
            query = `UPDATE students SET is_active = $1, metadata = metadata || $2::jsonb, updated_at = NOW() WHERE id = $3 AND student_type = 'prospect' RETURNING *`;
            params = [is_active, JSON.stringify(metadata || {}), req.params.id];
        } else {
            const metaObj = { ...metadata };
            if (status !== undefined) metaObj.status = status;
            query = `UPDATE students SET metadata = metadata || $1::jsonb, updated_at = NOW()
                     WHERE id = $2 AND student_type = 'prospect' RETURNING *`;
            params = [JSON.stringify(metaObj), req.params.id];
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

// POST /api/prospects/:id/whatsapp-nudge - Log WhatsApp demo nudge and mark status as contacted
router.post('/:id/whatsapp-nudge', async (req, res) => {
    const { message, created_by } = req.body;
    if (!message || !message.trim()) return res.status(400).json({ error: 'message is required' });
    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        const noteResult = await client.query(
            'INSERT INTO prospect_notes (prospect_id, note, created_by) VALUES ($1, $2, $3) RETURNING *',
            [req.params.id, `📱 WhatsApp nudge sent: "${message.trim()}"`, created_by || 'Admin']
        );
        const prospectResult = await client.query(
            `UPDATE students
             SET metadata = metadata || jsonb_build_object('status', 'contacted'::text),
                 updated_at = NOW()
             WHERE id = $1 AND student_type = 'prospect' RETURNING *`,
            [req.params.id]
        );
        if (prospectResult.rows.length === 0) {
            await client.query('ROLLBACK');
            return res.status(404).json({ error: 'Prospect not found' });
        }
        await client.query('COMMIT');
        res.json({ prospect: prospectResult.rows[0], note: noteResult.rows[0] });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[POST /api/prospects/:id/whatsapp-nudge] Error:', err);
        res.status(500).json({ error: 'Failed to log WhatsApp nudge' });
    } finally {
        client.release();
    }
});

// POST /api/prospects - Create a new prospect or intentful user (from landing page)
// Pass user_type: 'intentful' to store as intentful_user instead of prospect
router.post('/', async (req, res) => {
    console.log('[POST /api/prospects] Incoming form:', req.body);
    const {
        name, address, phone, email, instrument, location, source,
        dob, guardian_name, guardian_phone, notes, demo_type, demo_day_date,
        user_type
    } = req.body;

    if (!name || !phone) {
        return res.status(400).json({ error: 'Name and phone are required.' });
    }

    const isIntentful = user_type === 'intentful';
    const studentType = isIntentful ? 'intentful_user' : 'prospect';

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const metadata = {
            email,
            address,
            interested_instrument: instrument,
            location: location || undefined,
            lead_source: source,
            dob: dob || undefined,
            guardian_name: guardian_name || undefined,
            guardian_phone: guardian_phone || undefined,
            notes: notes || undefined,
            status: 'new',
            demo_type: demo_type || 'normal',
            demo_day_date: demo_day_date || undefined
        };

        const insertQuery = `
      INSERT INTO students (name, phone, metadata, student_type, is_active)
      VALUES ($1, $2, $3, $4, true)
      RETURNING *
    `;

        const insertResult = await client.query(insertQuery, [
            name,
            phone,
            JSON.stringify(metadata),
            studentType
        ]);

        await client.query('COMMIT');
        const record = insertResult.rows[0];
        console.log(`[POST /api/prospects] ${studentType} created:`, record.id);

        // Notify admins (only for prospects, not intentful users)
        if (!isIntentful) {
            try {
                const isDemoDay = demo_type === 'demo_day';
                const notifTitle = isDemoDay ? 'New Demo Day Sign-up' : 'New Demo Sign-up';
                const notifMsg = isDemoDay
                    ? `${name} recently booked a trial class for ${instrument || 'a program'} during Demo Day.`
                    : `${name} recently booked a trial class for ${instrument || 'a program'}.`;

                await pool.query(`
                    INSERT INTO notifications (type, title, message, metadata, action_link)
                    VALUES ($1, $2, $3, $4::jsonb, $5)
                `, [
                    'NEW_PROSPECT',
                    notifTitle,
                    notifMsg,
                    JSON.stringify({ prospect_id: record.id, phone, email, demo_type: demo_type || 'normal' }),
                    '/students'
                ]);

                const notificationsRouter = require('./notifications');
                if (notificationsRouter.emitNotification) {
                    notificationsRouter.emitNotification({
                        type: 'NEW_PROSPECT',
                        title: notifTitle,
                        message: notifMsg,
                        metadata: { prospect_id: record.id, phone, email, demo_type: demo_type || 'normal' },
                        action_link: '/students',
                        created_at: new Date().toISOString()
                    });
                }
            } catch (notifErr) {
                console.error('[POST /api/prospects] Failed to create notification:', notifErr.message);
            }

            sendProspectNotification(record).catch(err =>
                console.error('[prospects] Failed to send notification email:', err.message)
            );
        }

        res.status(201).json({ message: isIntentful ? 'Guide request recorded.' : 'Demo class booked successfully!', prospect: record });

    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[POST /api/prospects] Error:', err);
        res.status(500).json({ error: 'Failed to record submission.' });
    } finally {
        client.release();
    }
});

module.exports = router;
