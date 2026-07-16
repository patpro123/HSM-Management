'use strict';

const cron = require('node-cron');
const driveService = require('../services/driveService');
const { notifyAdmins } = require('../utils/notifyRecipients');

// In-memory — resets on deploy/restart, which just means one extra check
// confirms current state. Avoids a DB round-trip on every tick.
let lastKnownHealthy = true;

/**
 * Core job — separated from cron registration so it can be triggered manually.
 * @returns {Promise<{ healthy: boolean, errors: object[] }>}
 */
async function runDriveHealthCheck() {
  if (process.env.DRIVE_ENABLED !== 'true') {
    return { healthy: true, errors: [] };
  }

  const { healthy, errors } = await driveService.checkHealth();

  if (!healthy && lastKnownHealthy) {
    console.error('[driveHealthScheduler] Drive integration is DOWN:', errors);
    await notifyAdmins({
      type: 'DRIVE_HEALTH_FAILED',
      title: 'Google Drive storage is broken',
      message: `Homework/makeup material uploads will fail until this is fixed. ` +
        errors.map(e => `${e.category}: ${e.message}`).join('; '),
    }).catch(err => console.error('[driveHealthScheduler] failed to notify admins:', err.message));
  } else if (healthy && !lastKnownHealthy) {
    console.log('[driveHealthScheduler] Drive integration recovered');
    await notifyAdmins({
      type: 'DRIVE_HEALTH_RECOVERED',
      title: 'Google Drive storage is back up',
      message: 'File uploads for homework and makeup material are working again.',
    }).catch(err => console.error('[driveHealthScheduler] failed to notify admins:', err.message));
  }

  lastKnownHealthy = healthy;
  return { healthy, errors };
}

/**
 * Registers the periodic health-check cron job.
 * Default: every 15 minutes. Override via DRIVE_HEALTH_CRON_SCHEDULE env var.
 */
function registerDriveHealthScheduler() {
  const schedule = process.env.DRIVE_HEALTH_CRON_SCHEDULE || '*/15 * * * *';

  cron.schedule(schedule, () => {
    runDriveHealthCheck().catch(err => console.error('[driveHealthScheduler] check failed:', err.message));
  });

  console.log(`[driveHealthScheduler] Registered — schedule: "${schedule}"`);
}

module.exports = { registerDriveHealthScheduler, runDriveHealthCheck };
