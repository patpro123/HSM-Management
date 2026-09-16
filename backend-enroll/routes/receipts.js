const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateJWT } = require('../auth/jwtMiddleware');
const { authorizeRole } = require('../auth/rbacMiddleware');
const { assignReceiptNumber } = require('../services/receiptService');
const { sendReceiptEmail } = require('../services/emailService');

const PAYMENT_FOR_LABELS = {
  tuition: 'Tuition Fee',
  registration: 'Registration',
  exam: 'Exam Fee',
  materials: 'Materials',
  other: 'Other',
};

const LOCATION_LABELS = {
  hsm: 'HSM Main',
  pbel: 'PBEL City',
};

// GET /api/receipts/:paymentId - Fetch everything needed to render a receipt
router.get('/:paymentId', authenticateJWT, authorizeRole(['admin']), async (req, res) => {
  const { paymentId } = req.params;

  try {
    const result = await pool.query(
      `SELECT p.id, p.amount, p.method, p.metadata, p.timestamp, p.receipt_number,
              s.name AS student_name, s.phone AS student_phone, s.guardian_contact,
              s.metadata->>'email' AS student_email,
              pkg.name AS package_name,
              COALESCE(bi.name, pkgi.name, fsi.name) AS instrument_name,
              t.name AS teacher_name,
              u.name AS recorded_by_name
       FROM payments p
       JOIN students s ON p.student_id = s.id
       LEFT JOIN packages pkg ON p.package_id = pkg.id
       LEFT JOIN instruments pkgi ON pkg.instrument_id = pkgi.id
       -- Modern package flow: package_id sent by the frontend is often a fee_structures.id,
       -- which doesn't match the legacy packages table, so it's stashed in metadata instead
       -- (see routes/payments.js). Fall back to it for the instrument name.
       LEFT JOIN fee_structures fs ON fs.id = (p.metadata->>'fee_structure_id')::uuid
       LEFT JOIN instruments fsi ON fs.instrument_id = fsi.id
       LEFT JOIN batches b ON b.id = (p.metadata->>'batch_id')::uuid
       LEFT JOIN instruments bi ON b.instrument_id = bi.id
       LEFT JOIN teachers t ON b.teacher_id = t.id
       LEFT JOIN users u ON p.recorded_by = u.id
       WHERE p.id = $1`,
      [paymentId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Payment not found' });
    }

    const row = result.rows[0];

    // Lazily assign a receipt number for payments recorded before this feature existed
    let receiptNumber = row.receipt_number;
    if (!receiptNumber) {
      receiptNumber = await assignReceiptNumber(pool, row.id, row.timestamp);
    }

    const meta = row.metadata || {};
    const locationLabel = LOCATION_LABELS[meta.location] || null;
    const descriptionLabel = PAYMENT_FOR_LABELS[meta.payment_for] || 'Payment';

    res.json({
      payment_id: row.id,
      receipt_number: receiptNumber,
      date: row.timestamp,
      student_name: row.student_name,
      student_phone: row.student_phone || row.guardian_contact || null,
      student_email: row.student_email || null,
      amount: row.amount,
      payment_method: row.method,
      description: descriptionLabel,
      instrument_name: row.instrument_name || null,
      teacher_name: row.teacher_name || null,
      location_label: locationLabel,
      recorded_by_name: row.recorded_by_name || null,
    });
  } catch (err) {
    console.error('Error fetching receipt:', err);
    res.status(500).json({ error: 'Failed to fetch receipt' });
  }
});

// POST /api/receipts/:paymentId/email - Email the receipt PDF (rendered client-side, posted as base64)
router.post('/:paymentId/email', authenticateJWT, authorizeRole(['admin']), async (req, res) => {
  const { paymentId } = req.params;
  const { to, pdf_base64, student_name, receipt_number, amount } = req.body;

  if (!to || !pdf_base64) {
    return res.status(400).json({ error: 'to and pdf_base64 are required' });
  }

  try {
    const pdfBuffer = Buffer.from(pdf_base64, 'base64');
    await sendReceiptEmail({
      guardianEmail: to,
      studentName: student_name,
      receiptNumber: receipt_number,
      amount,
      pdfBuffer,
    });

    await pool.query(
      `INSERT INTO receipt_deliveries (payment_id, channel, recipient, sent_by, status)
       VALUES ($1, 'email', $2, $3, 'sent')`,
      [paymentId, to, req.user?.id || null]
    );

    res.json({ success: true });
  } catch (err) {
    console.error('Error emailing receipt:', err);
    await pool.query(
      `INSERT INTO receipt_deliveries (payment_id, channel, recipient, sent_by, status, error)
       VALUES ($1, 'email', $2, $3, 'failed', $4)`,
      [paymentId, to, req.user?.id || null, err.message]
    ).catch(() => {});
    res.status(500).json({ error: 'Failed to send receipt email' });
  }
});

// POST /api/receipts/:paymentId/log-whatsapp - Audit log for the manual-forward WhatsApp flow
router.post('/:paymentId/log-whatsapp', authenticateJWT, authorizeRole(['admin']), async (req, res) => {
  const { paymentId } = req.params;
  const { recipient } = req.body;

  try {
    await pool.query(
      `INSERT INTO receipt_deliveries (payment_id, channel, recipient, sent_by, status)
       VALUES ($1, 'whatsapp_manual', $2, $3, 'initiated')`,
      [paymentId, recipient || null, req.user?.id || null]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Error logging WhatsApp forward:', err);
    res.status(500).json({ error: 'Failed to log WhatsApp forward' });
  }
});

module.exports = router;
