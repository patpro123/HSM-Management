// Fan-out helpers for the notifications table.
// One row per recipient user_id — NOT a shared user_id=NULL broadcast row —
// so read state and visibility are correctly scoped per user.

const pool = require('../db');

async function insertAndEmit(userId, { type, title, message, action_link, metadata }) {
  const { rows } = await pool.query(
    `INSERT INTO notifications (type, title, message, action_link, metadata, user_id)
     VALUES ($1, $2, $3, $4, $5::jsonb, $6)
     RETURNING created_at`,
    [type, title, message, action_link || null, JSON.stringify(metadata || {}), userId]
  );

  const notificationsRouter = require('../routes/notifications');
  notificationsRouter.emitNotification?.({
    type, title, message, action_link, metadata, user_id: userId,
    created_at: rows[0].created_at,
  });
}

async function notifyUsers(userIds, notification) {
  const uniqueIds = [...new Set(userIds)].filter(Boolean);
  for (const userId of uniqueIds) {
    await insertAndEmit(userId, notification);
  }
  return uniqueIds.length;
}

async function notifyAdmins(notification) {
  const { rows: admins } = await pool.query(
    `SELECT user_id FROM user_roles WHERE role = 'admin' AND revoked_at IS NULL`
  );
  return notifyUsers(admins.map(a => a.user_id), notification);
}

module.exports = { notifyUsers, notifyAdmins };
