'use strict';

const nodemailer = require('nodemailer');

function buildTransporter() {
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

async function sendAbsenceNotification({ guardianEmail, studentName, sessionDate, batchName }) {
  const transporter = buildTransporter();

  const formattedDate = new Date(sessionDate).toLocaleDateString('en-IN', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  });

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; color: #333; font-size: 15px; }
    .header { background: #1a1a2e; color: white; padding: 20px 30px; }
    .header h1 { margin: 0; font-size: 22px; }
    .content { padding: 30px; }
    .info-box { background: #f5f5f5; border-left: 4px solid #e74c3c; padding: 15px 20px; margin: 20px 0; border-radius: 4px; }
    .footer { background: #f0f0f0; padding: 15px 30px; font-size: 12px; color: #888; }
  </style>
</head>
<body>
  <div class="header"><h1>Hyderabad School of Music</h1></div>
  <div class="content">
    <p>Dear Parent/Guardian,</p>
    <p>
      This is to inform you that <strong>${studentName}</strong> was marked
      <strong>absent</strong> for their class on <strong>${formattedDate}</strong>.
    </p>
    <div class="info-box">
      <strong>Batch:</strong> ${batchName}<br>
      <strong>Date:</strong> ${formattedDate}<br>
      <strong>Student:</strong> ${studentName}
    </div>
    <p>
      Please note that <strong>absent classes are not deducted</strong> from your
      remaining class balance — only attended classes are counted.
    </p>
    <p>
      If you believe this is an error or would like to schedule a makeup class,
      please contact us or reach out through WhatsApp.
    </p>
    <p>Warm regards,<br><strong>The HSM Team</strong></p>
  </div>
  <div class="footer">Hyderabad School of Music &bull; This is an automated message.</div>
</body>
</html>`;

  await transporter.sendMail({
    from:    `"HSM — Hyderabad School of Music" <${process.env.SMTP_USER}>`,
    to:      guardianEmail,
    subject: `Absence Notice: ${studentName} — ${formattedDate}`,
    html,
  });
}

async function sendPaymentReminder({ guardianEmail, studentName, instrument, classesRemaining }) {
  const transporter = buildTransporter();

  const html = `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; color: #333; font-size: 15px; }
    .header { background: #1a1a2e; color: white; padding: 20px 30px; }
    .header h1 { margin: 0; font-size: 22px; }
    .content { padding: 30px; }
    .warn-box { background: #fff8e1; border-left: 4px solid #f39c12; padding: 15px 20px; margin: 20px 0; border-radius: 4px; }
    .footer { background: #f0f0f0; padding: 15px 30px; font-size: 12px; color: #888; }
  </style>
</head>
<body>
  <div class="header"><h1>Hyderabad School of Music</h1></div>
  <div class="content">
    <p>Dear Parent/Guardian,</p>
    <div class="warn-box">
      <strong>${studentName}</strong> has only <strong>${classesRemaining} class(es)</strong>
      remaining for <strong>${instrument}</strong>.
    </div>
    <p>
      To continue classes without interruption, please renew your package at your earliest convenience.
      Contact us via WhatsApp or speak to the front desk.
    </p>
    <p>Warm regards,<br><strong>The HSM Team</strong></p>
  </div>
  <div class="footer">Hyderabad School of Music &bull; Automated reminder.</div>
</body>
</html>`;

  await transporter.sendMail({
    from:    `"HSM — Hyderabad School of Music" <${process.env.SMTP_USER}>`,
    to:      guardianEmail,
    subject: `Class Renewal Reminder: ${studentName} — ${instrument}`,
    html,
  });
}

module.exports = { sendAbsenceNotification, sendPaymentReminder };
