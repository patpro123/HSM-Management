'use strict';

const cron   = require('node-cron');
const pool   = require('../db');
const { getMonthlyPayoutReport } = require('../services/payoutService');
const { sendPayoutEmail }        = require('../routes/payouts');

/**
 * Parses the comma-separated PAYOUT_REPORT_RECIPIENTS env var.
 * Falls back to SMTP_USER if not set.
 * @returns {string[]}
 */
function getRecipients() {
  const raw = process.env.PAYOUT_REPORT_RECIPIENTS || process.env.SMTP_USER || '';
  return raw.split(',').map(e => e.trim()).filter(Boolean);
}

/**
 * Core job logic — separated so it can be called manually from a route too.
 */
async function runPayoutReportJob() {
  const now        = new Date();
  const year       = now.getFullYear();
  const month      = now.getMonth() + 1; // 1-indexed
  const recipients = getRecipients();

  if (recipients.length === 0) {
    console.warn('[payoutScheduler] No recipients configured — set PAYOUT_REPORT_RECIPIENTS');
    return;
  }

  console.log(`[payoutScheduler] Running payout report for ${year}-${String(month).padStart(2, '0')}`);

  const report    = await getMonthlyPayoutReport(pool, { year, month });
  const messageId = await sendPayoutEmail(recipients, report);

  console.log(`[payoutScheduler] Report emailed to ${recipients.join(', ')} — messageId: ${messageId}`);
  console.log(`[payoutScheduler] Grand total: ₹${report.grand_total} across ${report.teachers.length} teacher(s)`);
}

/**
 * Registers the cron job.
 * Schedule: 09:00 on the 25th of every month.
 * Cron syntax: minute hour day-of-month month day-of-week
 *              0      9    25            *     *
 */
function registerPayoutScheduler() {
  const schedule = process.env.PAYOUT_CRON_SCHEDULE || '0 9 25 * *';

  cron.schedule(schedule, async () => {
    try {
      await runPayoutReportJob();
    } catch (err) {
      console.error('[payoutScheduler] Job failed:', err);
    }
  });

  console.log(`[payoutScheduler] Registered — schedule: "${schedule}" (next run: 25th at 09:00)`);
}

module.exports = { registerPayoutScheduler, runPayoutReportJob };
