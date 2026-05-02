const pool = require('../db');

const BASE_URL = 'https://graph.facebook.com/v19.0';

function isEnabled() {
  return !!(process.env.WHATSAPP_API_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);
}

function normalizePhone(phone) {
  const digits = String(phone).replace(/\D/g, '');
  if (digits.startsWith('91') && digits.length === 12) return digits;
  if (digits.length === 10) return `91${digits}`;
  return digits;
}

async function sendTemplate(to, templateName, components = []) {
  const resp = await fetch(
    `${BASE_URL}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.WHATSAPP_API_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: {
          name: templateName,
          language: { code: 'en' },
          components,
        },
      }),
    }
  );

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`WhatsApp API ${resp.status}: ${err}`);
  }

  return resp.json();
}

async function logMessage(direction, phone, templateName, body, waMessageId, studentId) {
  try {
    await pool.query(
      `INSERT INTO whatsapp_messages
         (wa_message_id, direction, phone, template_name, body, student_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (wa_message_id) DO NOTHING`,
      [waMessageId || null, direction, phone, templateName || null, body || null, studentId || null]
    );
  } catch (err) {
    console.error('WhatsApp log error:', err.message);
  }
}

async function getOptedInPhone(studentId) {
  const { rows } = await pool.query(
    `SELECT phone FROM whatsapp_contacts
     WHERE student_id = $1 AND is_opted_in = true
     LIMIT 1`,
    [studentId]
  );
  return rows[0]?.phone || null;
}

async function notifyAttendancePresent(studentId, studentName, instrument) {
  if (!isEnabled()) return;
  try {
    const phone = await getOptedInPhone(studentId);
    if (!phone) return;

    const result = await sendTemplate(phone, 'attendance_confirmation', [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: studentName },
          { type: 'text', text: instrument },
        ],
      },
    ]);

    const waId = result?.messages?.[0]?.id;
    await logMessage('outbound', phone, 'attendance_confirmation', null, waId, studentId);
  } catch (err) {
    console.error('WhatsApp attendance notify error:', err.message);
  }
}

async function notifyClassesLow(studentId, studentName, classesRemaining, instrument) {
  if (!isEnabled()) return;
  try {
    const phone = await getOptedInPhone(studentId);
    if (!phone) return;

    const result = await sendTemplate(phone, 'classes_low_alert', [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: studentName },
          { type: 'text', text: String(classesRemaining) },
          { type: 'text', text: instrument },
        ],
      },
    ]);

    const waId = result?.messages?.[0]?.id;
    await logMessage('outbound', phone, 'classes_low_alert', null, waId, studentId);
  } catch (err) {
    console.error('WhatsApp classes-low notify error:', err.message);
  }
}

async function notifyPaymentReceived(studentId, studentName, amount, instrument) {
  if (!isEnabled()) return;
  try {
    const phone = await getOptedInPhone(studentId);
    if (!phone) return;

    const result = await sendTemplate(phone, 'payment_received', [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: studentName },
          { type: 'text', text: String(amount) },
          { type: 'text', text: instrument },
        ],
      },
    ]);

    const waId = result?.messages?.[0]?.id;
    await logMessage('outbound', phone, 'payment_received', null, waId, studentId);
  } catch (err) {
    console.error('WhatsApp payment notify error:', err.message);
  }
}

async function notifyEnrollmentWelcome(studentId, studentName, instrument) {
  if (!isEnabled()) return;
  try {
    const phone = await getOptedInPhone(studentId);
    if (!phone) return;

    const result = await sendTemplate(phone, 'enrollment_welcome', [
      {
        type: 'body',
        parameters: [
          { type: 'text', text: studentName },
          { type: 'text', text: instrument },
        ],
      },
    ]);

    const waId = result?.messages?.[0]?.id;
    await logMessage('outbound', phone, 'enrollment_welcome', null, waId, studentId);
  } catch (err) {
    console.error('WhatsApp enrollment notify error:', err.message);
  }
}

module.exports = {
  isEnabled,
  normalizePhone,
  logMessage,
  getOptedInPhone,
  notifyAttendancePresent,
  notifyClassesLow,
  notifyPaymentReceived,
  notifyEnrollmentWelcome,
};
