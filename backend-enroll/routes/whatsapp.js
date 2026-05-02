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

        // Handle START / opt back in
        if (/^start$/i.test(body.trim())) {
          await pool.query(
            `UPDATE whatsapp_contacts
             SET is_opted_in = true, opted_out_at = null, opted_in_at = now()
             WHERE phone = $1`,
            [phone]
          );
        }
      }
    }
  }
}

// GET /api/whatsapp/contacts — list opted-in contacts (admin)
router.get('/contacts', authenticateJWT, authorizeRole(['admin']), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT wc.*, s.name AS student_name
       FROM whatsapp_contacts wc
       LEFT JOIN students s ON s.id = wc.student_id
       ORDER BY wc.created_at DESC`
    );
    res.json({ contacts: rows });
  } catch (err) {
    console.error('WhatsApp contacts fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch contacts' });
  }
});

// POST /api/whatsapp/contacts — register / upsert a contact
router.post('/contacts', authenticateJWT, authorizeRole(['admin']), async (req, res) => {
  const { phone, student_id } = req.body;
  if (!phone) return res.status(400).json({ error: 'phone required' });

  const normalized = normalizePhone(phone);
  try {
    const { rows } = await pool.query(
      `INSERT INTO whatsapp_contacts (phone, student_id, is_opted_in, opted_in_at)
       VALUES ($1, $2, true, now())
       ON CONFLICT (phone) DO UPDATE
         SET student_id = COALESCE(EXCLUDED.student_id, whatsapp_contacts.student_id),
             is_opted_in = true,
             opted_in_at = now(),
             opted_out_at = null
       RETURNING *`,
      [normalized, student_id || null]
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
