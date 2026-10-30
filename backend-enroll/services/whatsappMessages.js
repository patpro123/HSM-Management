'use strict';

// Composing WhatsApp messages and preparing them for sending, shared by every chat skill (and
// route) that messages a family. The message is sent by the staff member tapping the click-to-chat
// link on their own phone, so no Meta-approved template is needed. Each prepared message is
// logged in whatsapp_messages as 'initiated'.

const pool = require('../db');
const { normalizePhone } = require('./whatsappService');
const { fmtDate, money } = require('../llm/dues');

const SIGN_OFF = '- HSM Team';
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 'es'}`;

// One entry per message kind: data in, text out. Add new kinds here.
const COMPOSERS = {
  // data: { studentName, dues: rows from fetchDues }
  payment_followup({ studentName, dues }) {
    const lines = dues.map(d => {
      const head = dues.length > 1 ? `${d.instrument}: ` : '';
      const due = d.pending_amount ? `the next payment of ${money(d.pending_amount)}` : 'the next payment';
      if (!d.last_paid_on) return `${head}we have no payment on record yet for the ${plural(d.used, 'class')} attended, so ${due} is due.`;
      const paid = `since the last payment on ${fmtDate(d.last_paid_on)}`;
      if (d.overdue_classes > 0) return `${head}${plural(d.used, 'class')} attended ${paid} (package of ${d.allowance}), so ${due} is now due.`;
      return `${head}${d.used} of ${d.allowance} classes used ${paid}, ${d.classes_remaining} left. ${due[0].toUpperCase()}${due.slice(1)} will be due shortly.`;
    }).map(l => l.replace(/^(.*?: )?([a-z])/, (m, h, c) => (h || '') + c.toUpperCase()));
    const instruments = dues.map(d => d.instrument).join(' & ');
    return [
      `Hi! A gentle reminder from Hyderabad School of Music about ${studentName}'s ${instruments} classes.`,
      '',
      ...lines,
      '',
      'Kindly arrange the payment before the classes run out. Please ignore this message if you have already paid.',
      '',
      SIGN_OFF,
    ].join('\n');
  },
};

function composeMessage(kind, data) {
  const compose = COMPOSERS[kind];
  if (!compose) throw new Error(`Unknown WhatsApp message kind: ${kind}`);
  return compose(data);
}

// https://wa.me/<number>?text=…  (without a number WhatsApp lets the sender pick the contact)
function waLink(phone, text) {
  const to = phone ? normalizePhone(phone) : '';
  return `https://wa.me/${to}?text=${encodeURIComponent(text)}`;
}

// The family's number: the guardian's when recorded, else the student's own
async function recipientFor(studentId) {
  const { rows } = await pool.query(
    `SELECT NULLIF(TRIM(guardian_contact), '') AS guardian, NULLIF(TRIM(phone), '') AS phone FROM students WHERE id = $1`,
    [studentId]
  );
  const phone = rows[0]?.guardian || rows[0]?.phone || null;
  return phone && normalizePhone(phone).length >= 10 ? normalizePhone(phone) : null;
}

// Compose a message for a student and build what the UI needs to send it. Does not log; the
// log is written when the staff member actually taps send (see logInitiated).
async function prepareMessage({ studentId, studentName, kind, data }) {
  const text = composeMessage(kind, { studentName, ...data });
  const to = await recipientFor(studentId);
  return { student_id: studentId, student_name: studentName, kind, to, text, link: waLink(to, text) };
}

async function logInitiated({ studentId, phone, kind, text, userId }) {
  await pool.query(
    `INSERT INTO whatsapp_messages (direction, phone, template_name, body, status, student_id, metadata)
     VALUES ('outbound', $1, $2, $3, 'initiated', $4, $5)`,
    [phone || '', `manual:${kind}`, text, studentId || null, JSON.stringify({ via: 'cleff', user_id: userId || null })]
  );
}

module.exports = { composeMessage, waLink, recipientFor, prepareMessage, logInitiated, COMPOSERS };
