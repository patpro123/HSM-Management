const express = require('express');
const crypto = require('crypto');
const pool = require('../db');
const { normalizePhone, logMessage } = require('../services/whatsappService');
const { authenticateJWT } = require('../auth/jwtMiddleware');
const { authorizeRole } = require('../auth/rbacMiddleware');

const router = express.Router();

// GET /api/whatsapp/webhook — Meta endpoint verification
router.get('/webhook', (req, res) => {
  const mode = req.query['hub.mode'];
  const token = req.query['hub.verify_token'];
  const challenge = req.query['hub.challenge'];

  if (mode === 'subscribe' && token === process.env.WHATSAPP_WEBHOOK_SECRET) {
    return res.status(200).send(challenge);
  }
  res.sendStatus(403);
});

// POST /api/whatsapp/webhook — inbound events from Meta
// (raw body parsing is handled in index.js before express.json)
router.post('/webhook', async (req, res) => {
  // Verify HMAC-SHA256 signature
  const sig = req.headers['x-hub-signature-256'];
  if (process.env.WHATSAPP_WEBHOOK_SECRET && sig) {
    const expected = 'sha256=' + crypto
      .createHmac('sha256', process.env.WHATSAPP_WEBHOOK_SECRET)
      .update(req.body)
      .digest('hex');
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) {
      return res.sendStatus(403);
    }
  }

  let payload;
  try {
    payload = JSON.parse(req.body.toString());
  } catch {
    return res.sendStatus(400);
  }

  // Always acknowledge immediately — Meta retries on non-200
  res.sendStatus(200);

  // Process asynchronously after response
  setImmediate(() => handleWebhookPayload(payload).catch(err => {
    console.error('WhatsApp webhook processing error:', err.message);
  }));
});

// Best-effort match of an inbound WhatsApp number to an existing student record,
// since a first-time opt-in won't have a whatsapp_contacts row yet.
async function findStudentIdByPhone(normalizedPhone) {
  const last10 = normalizedPhone.slice(-10);
  const { rows } = await pool.query(
    `SELECT id FROM students
     WHERE regexp_replace(phone, '\\D', '', 'g') LIKE '%' || $1
        OR regexp_replace(metadata->>'guardian_phone', '\\D', '', 'g') LIKE '%' || $1
     LIMIT 1`,
    [last10]
  );
  return rows[0]?.id || null;
}

async function handleWebhookPayload(payload) {
  const entries = payload?.entry || [];
  for (const entry of entries) {
    for (const change of entry.changes || []) {
      const value = change.value;
      if (!value) continue;

      // Delivery/read status updates
      for (const status of value.statuses || []) {
        await pool.query(
          `UPDATE whatsapp_messages SET status = $1, updated_at = now()
           WHERE wa_message_id = $2`,
          [status.status, status.id]
        );
      }

      // Inbound messages
      for (const msg of value.messages || []) {
        const phone = normalizePhone(msg.from);
        const body = msg.text?.body || '';

        // Look up student by phone
        const { rows } = await pool.query(
          `SELECT student_id FROM whatsapp_contacts WHERE phone = $1 LIMIT 1`,
          [phone]
        );
        const studentId = rows[0]?.student_id || null;

        await logMessage('inbound', phone, null, body, msg.id, studentId);

        // Handle STOP / opt-out
        if (/^stop$/i.test(body.trim())) {
          await pool.query(
            `UPDATE whatsapp_contacts
             SET is_opted_in = false, opted_out_at = now()
             WHERE phone = $1`,
            [phone]
          );
        }

        // Handle JOIN / START — self-serve opt-in. Upsert since a first-time
        // sender has no whatsapp_contacts row yet. The inbound text itself
        // (sent after seeing the disclosure next to the wa.me link/QR code)
        // is the consent record.
        if (/^(join|start)$/i.test(body.trim())) {
          const matchedStudentId = studentId || await findStudentIdByPhone(phone);
          await pool.query(
            `INSERT INTO whatsapp_contacts (phone, student_id, is_opted_in, opted_in_at, consent_source, consent_text)
             VALUES ($1, $2, true, now(), 'whatsapp_self_serve', $3)
             ON CONFLICT (phone) DO UPDATE
               SET is_opted_in = true,
                   opted_out_at = null,
                   opted_in_at = now(),
                   student_id = COALESCE(whatsapp_contacts.student_id, EXCLUDED.student_id),
                   consent_source = 'whatsapp_self_serve',
                   consent_text = EXCLUDED.consent_text`,
            [phone, matchedStudentId, body.trim()]
          );
        }
      }
    }
  }
}

// GET /api/whatsapp/contacts — list opted-in contacts (admin)
router.get('/contacts', authenticateJWT, authorizeRole(['admin']), async (req, res) => {
  const { student_id } = req.query;
  try {
    const params = [];
    let where = '';
    if (student_id) {
      params.push(student_id);
      where = 'WHERE wc.student_id = $1';
    }
    const { rows } = await pool.query(
      `SELECT wc.*, s.name AS student_name
       FROM whatsapp_contacts wc
       LEFT JOIN students s ON s.id = wc.student_id
       ${where}
       ORDER BY wc.created_at DESC`,
      params
    );
    res.json({ contacts: rows });
  } catch (err) {
    console.error('WhatsApp contacts fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
});

// POST /api/whatsapp/contacts — register / upsert a contact
router.post('/contacts', authenticateJWT, authorizeRole(['admin']), async (req, res) => {
  const { phone, student_id, consent_source, consent_text, is_opted_in } = req.body;
  if (!phone) return res.status(400).json({ error: 'phone required' });

  const normalized = normalizePhone(phone);
  const optingIn = is_opted_in !== false;
  try {
    // consent_source/consent_text record how opt-IN was obtained, so an opt-out
    // (is_opted_in: false) must never overwrite that original record.
    const { rows } = await pool.query(
      `INSERT INTO whatsapp_contacts (phone, student_id, is_opted_in, opted_in_at, opted_out_at, consent_source, consent_text)
       VALUES ($1, $2, $3, CASE WHEN $3 THEN now() ELSE NULL END, CASE WHEN $3 THEN NULL ELSE now() END, $4, $5)
       ON CONFLICT (phone) DO UPDATE
         SET student_id = COALESCE(EXCLUDED.student_id, whatsapp_contacts.student_id),
             is_opted_in = $3,
             opted_in_at = CASE WHEN $3 THEN now() ELSE whatsapp_contacts.opted_in_at END,
             opted_out_at = CASE WHEN $3 THEN NULL ELSE now() END,
             consent_source = CASE WHEN $3 THEN COALESCE($4, whatsapp_contacts.consent_source) ELSE whatsapp_contacts.consent_source END,
             consent_text = CASE WHEN $3 THEN COALESCE($5, whatsapp_contacts.consent_text) ELSE whatsapp_contacts.consent_text END
       RETURNING *`,
      [normalized, student_id || null, optingIn, optingIn ? (consent_source || 'manual_admin_entry') : null, optingIn ? (consent_text || null) : null]
    );
    res.status(201).json({ contact: rows[0] });
  } catch (err) {
    console.error('WhatsApp contact upsert error:', err);
    res.status(500).json({ error: 'Failed to save contact' });
  }
});

// GET /api/whatsapp/messages — message log (admin)
router.get('/messages', authenticateJWT, authorizeRole(['admin']), async (req, res) => {
  const { student_id, limit = 50 } = req.query;
  try {
    const params = [];
    let where = '';
    if (student_id) {
      params.push(student_id);
      where = 'WHERE wm.student_id = $1';
    }
    params.push(Math.min(Number(limit), 200));
    const { rows } = await pool.query(
      `SELECT wm.*, s.name AS student_name
       FROM whatsapp_messages wm
       LEFT JOIN students s ON s.id = wm.student_id
       ${where}
       ORDER BY wm.created_at DESC
       LIMIT $${params.length}`,
      params
    );
    res.json({ messages: rows });
  } catch (err) {
    console.error('WhatsApp messages fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch messages' });
  }
});

module.exports = router;
