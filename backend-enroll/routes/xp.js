'use strict';

const express    = require('express');
const router     = express.Router();
const xpService  = require('../services/xpService');

// GET /api/students/:studentId/xp
router.get('/students/:studentId/xp', async (req, res) => {
    try {
        const summary = await xpService.getStudentXPSummary(req.params.studentId);
        res.json(summary);
    } catch (err) {
        console.error('[GET /students/:id/xp]', err);
        res.status(500).json({ error: 'Failed to fetch XP summary' });
    }
});

module.exports = router;
