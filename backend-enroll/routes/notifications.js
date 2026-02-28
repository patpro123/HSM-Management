const express = require('express');
const router = express.Router();
const pool = require('../db');

// In-memory store of connected SSE clients
const clients = new Set();

// Function to broadcast a notification to all connected clients
// We attach this to the router so other files can require it and call it
router.emitNotification = (notification) => {
    const payload = `data: ${JSON.stringify(notification)}\n\n`;
    clients.forEach(client => {
        // Simple global emit; in a very advanced app you might filter by user_id
        client.res.write(payload);
    });
};

// GET /api/notifications/stream - Server-Sent Events (SSE) stream
router.get('/stream', (req, res) => {
    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Add this client to the pool
    const client = { id: Date.now(), res };
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

// GET /api/notifications - List relevant notifications (Admin views all global ones)
router.get('/', async (req, res) => {
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
router.get('/unread/count', async (req, res) => {
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
router.put('/read-all', async (req, res) => {
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
