'use strict';

const express    = require('express');
const nodemailer = require('nodemailer');
const pool       = require('../db');
const { authorizeRole } = require('../auth/rbacMiddleware');
const { getMonthlyPayoutReport } = require('../services/payoutService');

const router = express.Router();

// ---------------------------------------------------------------------------
// Email helpers
// ---------------------------------------------------------------------------

function buildTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

/**
 * Builds an HTML email body for the payout report.
 * @param {object} report
 * @returns {string} HTML string
 */
function buildEmailHtml(report) {
  const teacherRows = report.teachers.map(t => {
    const studentList = t.active_students
      .map(s => `
        <tr>
          <td style="padding:4px 8px;">${s.student_name}</td>
          <td style="padding:4px 8px;">${s.enrolled_on}</td>
          <td style="padding:4px 8px; text-align:center;">${s.classes_attended}</td>
        </tr>`)
      .join('');

    return `
      <tr style="background:#f0f4ff;">
        <td colspan="3" style="padding:8px; font-weight:bold; font-size:15px;">
          ${t.teacher_name}
          &nbsp;<span style="font-weight:normal; color:#555;">
            (Rate: ₹${t.rate}/student · ${t.active_student_count} active · Total: ₹${t.total_payable})
          </span>
        </td>
      </tr>
      <tr style="background:#e8ecf8; color:#333; font-size:12px;">
        <th style="padding:4px 8px; text-align:left;">Student</th>
        <th style="padding:4px 8px; text-align:left;">Enrolled On</th>
        <th style="padding:4px 8px; text-align:center;">Classes Attended</th>
      </tr>
      ${studentList}
      <tr>
        <td colspan="3" style="padding:4px 8px; border-bottom:1px solid #ccc;"></td>
      </tr>`;
  }).join('');

  return `
    <div style="font-family:Arial,sans-serif; max-width:700px; margin:auto;">
      <h2 style="color:#2c3e50;">HSM Monthly Teacher Payout Report — ${report.month}</h2>
      <p style="color:#555;">Generated: ${new Date(report.generated_at).toLocaleString('en-IN')}</p>
      <table style="width:100%; border-collapse:collapse; font-size:14px;">
        ${teacherRows}
      </table>
      <div style="margin-top:16px; padding:12px; background:#2c3e50; color:#fff; border-radius:4px;">
        <strong>Grand Total Payable: ₹${report.grand_total}</strong>
      </div>
      <p style="font-size:11px; color:#aaa; margin-top:12px;">
        Active student criteria: enrolled before 20th of the month AND attended more than 2 classes.
      </p>
    </div>`;
}

/**
 * Sends the payout report email.
 * @param {string[]} recipients
 * @param {object}   report
 * @returns {Promise<string>} messageId
 */
async function sendPayoutEmail(recipients, report) {
  const transporter = buildTransporter();
  const info = await transporter.sendMail({
    from:    `"HSM Finance" <${process.env.SMTP_USER}>`,
    to:      recipients.join(', '),
    subject: `HSM Teacher Payout Report — ${report.month}`,
    html:    buildEmailHtml(report),
  });
  return info.messageId;
}

// ---------------------------------------------------------------------------
// GET /api/finance/payout-report
// Returns the report without sending email (preview / manual trigger)
// ---------------------------------------------------------------------------
router.get(
  '/payout-report',
  authorizeRole(['admin']),
  async (req, res) => {
    try {
      const year  = req.query.year  ? parseInt(req.query.year, 10)  : undefined;
      const month = req.query.month ? parseInt(req.query.month, 10) : undefined;

      const report = await getMonthlyPayoutReport(pool, { year, month });
      res.json({ success: true, report });
    } catch (err) {
      console.error('[payouts] GET payout-report error:', err);
      res.status(500).json({ error: 'Failed to generate payout report' });
    }
  }
);

// ---------------------------------------------------------------------------
// POST /api/finance/payout-report/send-email
// Generates report and sends it to specified recipients
// ---------------------------------------------------------------------------
router.post(
  '/payout-report/send-email',
  authorizeRole(['admin']),
  async (req, res) => {
    const { recipients, year, month } = req.body;

    if (!recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ error: 'At least one recipient email is required' });
    }

    try {
      const y = year  ? parseInt(year, 10)  : undefined;
      const m = month ? parseInt(month, 10) : undefined;

      const report    = await getMonthlyPayoutReport(pool, { year: y, month: m });
      const messageId = await sendPayoutEmail(recipients, report);

      console.log(`[payouts] Payout report emailed to ${recipients.join(', ')} — messageId: ${messageId}`);
      res.json({ success: true, email_sent: true, message_id: messageId, report });
    } catch (err) {
      console.error('[payouts] POST send-email error:', err);
      res.status(500).json({ error: 'Failed to send payout report email' });
    }
  }
);

module.exports = router;
module.exports.sendPayoutEmail = sendPayoutEmail; // exported for scheduler
