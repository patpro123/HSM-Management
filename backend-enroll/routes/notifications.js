const express = require('express');
const router = express.Router();
const pool = require('../db');
const jwt = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key-change-in-prod';

// In-memory store of connected SSE clients
const clients = new Set();

// Emit a notification to relevant SSE clients.
// If notification.user_id is set, only send to that user's connections.
// If null (global), send to all connected clients.
router.emitNotification = (notification) => {
    const payload = `data: ${JSON.stringify(notification)}\n\n`;
    clients.forEach(client => {
        if (!notification.user_id || client.userId === notification.user_id) {
            client.res.write(payload);
        }
    });
};

// GET /api/notifications/stream - Server-Sent Events (SSE) stream
// EventSource can't send headers, so we accept the JWT via ?token= query param
router.get('/stream', (req, res) => {
    // Resolve user: dev-bypass already set req.user; otherwise verify ?token=
    if (!req.user && req.query.token) {
        try {
            req.user = jwt.verify(req.query.token, JWT_SECRET);
        } catch (_) { /* invalid token — stream proceeds as unauthenticated */ }
    }

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Add this client to the pool, tagged with the user so we can filter emits
    const client = { id: Date.now(), res, userId: req.user?.id || null };
    clients.add(client);

    // Send initial connection heartbeat
    res.write('data: {"type": "CONNECTED"}\n\n');

    // Heartbeat interval to keep connection alive
    const heartbeat = setInterval(() => {
        res.write(':\n\n'); // SSE comment to keep socket open
    }, 30000);

    // Cleanup on disconnect
    req.on('close', () => {
        clearInterval(heartbeat);
        clients.delete(client);
    });
});

// Lightweight auth resolver used by polling endpoints.
// In DISABLE_AUTH mode req.user is already set by global middleware.
// In production, we read the Bearer token here so polling always works.
function resolveUser(req, res, next) {
    if (req.user) return next(); // already set (dev bypass or prior middleware)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        try {
            req.user = jwt.verify(authHeader.slice(7), JWT_SECRET);
        } catch (_) { /* expired/invalid — proceed as unauthenticated */ }
    }
    next();
}

// GET /api/notifications - List relevant notifications
router.get('/', resolveUser, async (req, res) => {
    try {
        // user_id IS NULL means global notification (e.g. for all admins)
        const result = await pool.query(`
            SELECT * FROM notifications
            WHERE user_id IS NULL OR user_id = $1::uuid
            ORDER BY created_at DESC
            LIMIT 50
        `, [req.user?.id || null]);

        res.json({ notifications: result.rows });
    } catch (err) {
        console.error('[GET /api/notifications] Error:', err);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});

// GET /api/notifications/unread/count - Fast polling endpoint
router.get('/unread/count', resolveUser, async (req, res) => {
    try {
        const result = await pool.query(`
            SELECT COUNT(*) FROM notifications 
            WHERE is_read = false AND (user_id IS NULL OR user_id = $1::uuid)
        `, [req.user?.id || null]);

        res.json({ count: parseInt(result.rows[0].count, 10) });
    } catch (err) {
        console.error('[GET /api/notifications/count] Error:', err);
        res.status(500).json({ error: 'Failed to fetch notification count' });
    }
});

// PUT /api/notifications/:id/read - Mark single as read
router.put('/:id/read', async (req, res) => {
    try {
        const result = await pool.query(`
            UPDATE notifications 
            SET is_read = true, updated_at = CURRENT_TIMESTAMP 
            WHERE id = $1::uuid 
            RETURNING *
        `, [req.params.id]);

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Notification not found' });
        }

        res.json({ notification: result.rows[0] });
    } catch (err) {
        console.error('[PUT /api/notifications/:id/read] Error:', err);
        res.status(500).json({ error: 'Failed to mark notification as read' });
    }
});

// PUT /api/notifications/read-all - Mark all as read
router.put('/read-all', resolveUser, async (req, res) => {
    try {
        await pool.query(`
            UPDATE notifications 
            SET is_read = true, updated_at = CURRENT_TIMESTAMP 
            WHERE is_read = false AND (user_id IS NULL OR user_id = $1::uuid)
        `, [req.user?.id || null]);

        res.json({ success: true });
    } catch (err) {
        console.error('[PUT /api/notifications/read-all] Error:', err);
        res.status(500).json({ error: 'Failed to mark notifications as read' });
    }
});

// POST /api/notifications - Internal/System route to create a notification manually
router.post('/', async (req, res) => {
    const { type, title, message, action_link, metadata, user_id } = req.body;

    if (!type || !title || !message) {
        return res.status(400).json({ error: 'type, title, and message are required' });
    }

    try {
        const result = await pool.query(`
            INSERT INTO notifications (type, title, message, action_link, metadata, user_id) 
            VALUES ($1, $2, $3, $4, $5::jsonb, $6::uuid) 
            RETURNING *
        `, [
            type,
            title,
            message,
            action_link || null,
            metadata ? JSON.stringify(metadata) : '{}',
            user_id || null
        ]);

        res.status(201).json({ notification: result.rows[0] });
    } catch (err) {
        console.error('[POST /api/notifications] Error:', err);
        res.status(500).json({ error: 'Failed to create notification' });
    }
});

module.exports = router;
