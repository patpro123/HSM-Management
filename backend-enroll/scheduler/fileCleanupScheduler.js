'use strict';

const cron = require('node-cron');
const { cleanupExpired } = require('../services/driveService');

/**
 * Core job — separated from the cron registration so it can be triggered
 * manually (e.g. via a dev admin route for testing).
 *
 * @returns {Promise<{ processed: number, errors: number }>}
 */
async function runFileCleanupJob() {
  console.log('[fileCleanupScheduler] Starting expired Drive file cleanup…');
  const result = await cleanupExpired();
  console.log(
    `[fileCleanupScheduler] Done — ${result.processed} deleted, ${result.errors} errors`
  );
  return result;
}

/**
 * Registers the monthly cron job.
 * Default: 02:00 on the 1st of every month (UTC).
 * Override via FILE_CLEANUP_CRON_SCHEDULE env var.
 */
function registerFileCleanupScheduler() {
  const schedule = process.env.FILE_CLEANUP_CRON_SCHEDULE || '0 2 1 * *';

  cron.schedule(schedule, async () => {
    try {
      await runFileCleanupJob();
    } catch (err) {
      console.error('[fileCleanupScheduler] Job failed:', err.message);
    }
  });

  console.log(`[fileCleanupScheduler] Registered — schedule: "${schedule}"`);
}

module.exports = { registerFileCleanupScheduler, runFileCleanupJob };
