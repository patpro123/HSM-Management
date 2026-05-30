'use strict';

const express = require('express');
const router  = express.Router();
const pool    = require('../db');
const jwt     = require('jsonwebtoken');
const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key-change-in-prod';

// Lightweight auth resolver — same pattern as notifications.js
function resolveUser(req, res, next) {
    if (req.user) return next();
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
        try { req.user = jwt.verify(authHeader.slice(7), JWT_SECRET); } catch (_) {}
    }
    next();
}

// Compute currentStreak and longestStreak from an array of {date, count} rows.
// A day qualifies if count >= threshold.
function computeStreaks(dailyCounts, threshold) {
    if (!dailyCounts.length) return { currentStreak: 0, longestStreak: 0 };

    const qualified = new Set(
        dailyCounts
            .filter(r => parseInt(r.count, 10) >= threshold)
            .map(r => r.date)
    );

    const today = new Date();
    const pad   = n => String(n).padStart(2, '0');
    const fmt   = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

    let currentStreak = 0;
    const cursor = new Date(today);
    if (!qualified.has(fmt(cursor))) cursor.setDate(cursor.getDate() - 1);
    while (qualified.has(fmt(cursor))) {
        currentStreak++;
        cursor.setDate(cursor.getDate() - 1);
    }

    const sorted = [...qualified].sort();
    let longest = 0, run = 0, prev = null;
    for (const d of sorted) {
        if (prev) {
            const gap = (new Date(d) - new Date(prev)) / 86400000;
            run = gap === 1 ? run + 1 : 1;
        } else {
            run = 1;
        }
        longest = Math.max(longest, run);
        prev = d;
    }

    return { currentStreak, longestStreak: longest };
}

// GET /api/students/:studentId/habits
router.get('/students/:studentId/habits', resolveUser, async (req, res) => {
    const { studentId } = req.params;
    try {
        const [habitsResult, logsResult, countResult, streakResult] = await Promise.all([
            pool.query(
                `SELECT id, title, icon, display_order,
                        metadata->>'type'  AS habit_type,
                        metadata->>'level' AS habit_level
                 FROM habits
                 WHERE student_id = $1 AND archived_at IS NULL
                 ORDER BY display_order, created_at`,
                [studentId]
            ),
            // Last 30 days of logs with theory answer presence
            pool.query(
                `SELECT hl.habit_id, hl.logged_date::text AS date,
                        hl.id AS log_id,
                        hl.voice_note_url IS NOT NULL OR hl.voice_note_data IS NOT NULL AS has_voice_note,
                        hl.theory_question_id,
                        hl.theory_answer_text,
                        hl.theory_answer_correct,
                        tq.question AS theory_question_text,
                        tq.answer_hint AS theory_answer_hint
                 FROM habit_logs hl
                 JOIN habits h ON h.id = hl.habit_id
                 LEFT JOIN theory_questions tq ON tq.id = hl.theory_question_id
                 WHERE h.student_id = $1
                   AND hl.logged_date >= CURRENT_DATE - INTERVAL '30 days'
                 ORDER BY hl.logged_date`,
                [studentId]
            ),
            pool.query(
                `SELECT COUNT(*) AS total FROM habits WHERE student_id = $1 AND archived_at IS NULL`,
                [studentId]
            ),
            pool.query(
                `SELECT hl.logged_date::text AS date, COUNT(hl.habit_id) AS count
                 FROM habit_logs hl
                 JOIN habits h ON h.id = hl.habit_id
                 WHERE h.student_id = $1
                   AND hl.logged_date >= CURRENT_DATE - INTERVAL '365 days'
                 GROUP BY hl.logged_date`,
                [studentId]
            ),
        ]);

        // Group logs by date → { "YYYY-MM-DD": ["habitId1", ...] }
        const logs = {};
        const logMeta = {}; // { "habitId__YYYY-MM-DD": { logId, hasVoiceNote, ... } }
        for (const row of logsResult.rows) {
            if (!logs[row.date]) logs[row.date] = [];
            logs[row.date].push(row.habit_id);
            logMeta[`${row.habit_id}__${row.date}`] = {
                logId:               row.log_id,
                hasVoiceNote:        row.has_voice_note,
                theoryQuestionId:    row.theory_question_id,
                theoryAnswerText:    row.theory_answer_text,
                theoryAnswerCorrect: row.theory_answer_correct,
                theoryQuestionText:  row.theory_question_text,
                theoryAnswerHint:    row.theory_answer_hint,
            };
        }

        const totalActive = parseInt(countResult.rows[0].total, 10);
        const threshold   = Math.max(1, Math.min(5, totalActive));
        const { currentStreak, longestStreak } = computeStreaks(streakResult.rows, threshold);

        const fullCountRes = await pool.query(
            `SELECT COUNT(*) AS total
             FROM habit_logs hl
             JOIN habits h ON h.id = hl.habit_id
             WHERE h.student_id = $1`,
            [studentId]
        );

        // For each theory-type habit, pick today's question (if not already logged today)
        const today = new Date().toISOString().slice(0, 10);
        const habits = habitsResult.rows;
        for (const habit of habits) {
            if (habit.habit_type !== 'theory') continue;
            const alreadyLogged = (logs[today] || []).includes(habit.id);
            if (alreadyLogged) continue;

            // Get student's primary instrument for question matching
            const instrRes = await pool.query(
                `SELECT inst.name AS instrument
                 FROM enrollments e
                 JOIN enrollment_batches eb ON eb.enrollment_id = e.id
                 JOIN batches b ON b.id = eb.batch_id
                 JOIN instruments inst ON inst.id = b.instrument_id
                 WHERE e.student_id = $1 AND e.status = 'active'
                 ORDER BY inst.name NULLS LAST LIMIT 1`,
                [studentId]
            );
            const instrument = instrRes.rows[0]?.instrument || null;
            const level = habit.habit_level || 'beginner';

            // Pick a random question, avoiding the last 10 answered for this habit
            const qRes = await pool.query(
                `SELECT id, question, answer_hint, sheet_storage_id
                 FROM theory_questions
                 WHERE (instrument = $1 OR instrument IS NULL)
                   AND level = $2
                   AND archived_at IS NULL
                   AND id NOT IN (
                     SELECT theory_question_id FROM habit_logs
                     WHERE habit_id = $3 AND theory_question_id IS NOT NULL
                     ORDER BY logged_date DESC LIMIT 10
                   )
                 ORDER BY RANDOM() LIMIT 1`,
                [instrument, level, habit.id]
            );
            if (qRes.rows.length > 0) {
                habit.todayTheoryQuestion = qRes.rows[0];
            }
        }

        res.json({
            habits,
            logs,
            logMeta,
            stats: {
                currentStreak,
                longestStreak,
                totalCompletions: parseInt(fullCountRes.rows[0].total, 10),
            },
        });
    } catch (err) {
        console.error('[GET /students/:id/habits]', err);
        res.status(500).json({ error: 'Failed to fetch habits' });
    }
});

// POST /api/students/:studentId/habits — create a habit (max 10 active)
router.post('/students/:studentId/habits', resolveUser, async (req, res) => {
    const { studentId } = req.params;
    const { title, icon, type, level } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'title is required' });

    try {
        const countRes = await pool.query(
            `SELECT COUNT(*) AS total FROM habits WHERE student_id = $1 AND archived_at IS NULL`,
            [studentId]
        );
        if (parseInt(countRes.rows[0].total, 10) >= 10) {
            return res.status(400).json({ error: 'Maximum of 10 active habits allowed' });
        }

        const orderRes = await pool.query(
            `SELECT COALESCE(MAX(display_order), -1) + 1 AS next_order
             FROM habits WHERE student_id = $1`,
            [studentId]
        );
        const displayOrder = orderRes.rows[0].next_order;

        const metadata = type === 'theory' ? JSON.stringify({ type: 'theory', level: level || 'beginner' }) : '{}';
        const result = await pool.query(
            `INSERT INTO habits (student_id, title, icon, display_order, metadata)
             VALUES ($1, $2, $3, $4, $5::jsonb) RETURNING id, title, icon, display_order,
                    metadata->>'type' AS habit_type, metadata->>'level' AS habit_level`,
            [studentId, title.trim(), icon || '🎵', displayOrder, metadata]
        );
        res.status(201).json({ habit: result.rows[0] });
    } catch (err) {
        console.error('[POST /students/:id/habits]', err);
        res.status(500).json({ error: 'Failed to create habit' });
    }
});

// PUT /api/habits/:habitId — update title and/or icon
router.put('/habits/:habitId', resolveUser, async (req, res) => {
    const { habitId } = req.params;
    const { title, icon } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'title is required' });

    try {
        const result = await pool.query(
            `UPDATE habits SET title = $1, icon = COALESCE($2, icon)
             WHERE id = $3 AND archived_at IS NULL
             RETURNING id, title, icon, display_order`,
            [title.trim(), icon || null, habitId]
        );
        if (!result.rows.length) return res.status(404).json({ error: 'Habit not found' });
        res.json({ habit: result.rows[0] });
    } catch (err) {
        console.error('[PUT /habits/:id]', err);
        res.status(500).json({ error: 'Failed to update habit' });
    }
});

// DELETE /api/habits/:habitId — soft-delete (archive)
router.delete('/habits/:habitId', resolveUser, async (req, res) => {
    const { habitId } = req.params;
    try {
        const result = await pool.query(
            `UPDATE habits SET archived_at = NOW()
             WHERE id = $1 AND archived_at IS NULL
             RETURNING id`,
            [habitId]
        );
        if (!result.rows.length) return res.status(404).json({ error: 'Habit not found' });
        res.json({ success: true });
    } catch (err) {
        console.error('[DELETE /habits/:id]', err);
        res.status(500).json({ error: 'Failed to archive habit' });
    }
});

// POST /api/habits/:habitId/log — toggle today's log
// On toggle ON: returns logId + linkedHomework (pending assignments targeting this habit)
// Accepts optional theory answer fields for theory-type habits.
router.post('/habits/:habitId/log', resolveUser, async (req, res) => {
    const { habitId } = req.params;
    const { theory_question_id, theory_answer_text, theory_answer_file } = req.body;
    const today = new Date().toISOString().slice(0, 10);

    try {
        const existing = await pool.query(
            `SELECT id FROM habit_logs WHERE habit_id = $1 AND logged_date = $2`,
            [habitId, today]
        );

        if (existing.rows.length) {
            await pool.query(
                `DELETE FROM habit_logs WHERE habit_id = $1 AND logged_date = $2`,
                [habitId, today]
            );
            return res.json({ logged: false });
        }

        // Handle theory answer scan upload if provided
        let theoryStorageId = null;
        if (theory_answer_file && process.env.DRIVE_ENABLED === 'true' && process.env.DRIVE_FOLDER_HOMEWORK_AUDIO) {
            try {
                const driveService = require('../services/driveService');
                const base64Part = theory_answer_file.includes(',') ? theory_answer_file.split(',')[1] : theory_answer_file;
                const buffer = Buffer.from(base64Part, 'base64');
                const { fileStorageId } = await driveService.upload({
                    buffer,
                    fileName: `theory_${Date.now()}.pdf`,
                    mimeType: 'application/pdf',
                    category: 'student_document',
                    entityType: 'theory_answer',
                });
                theoryStorageId = fileStorageId;
            } catch (_) {}
        }

        const insertRes = await pool.query(
            `INSERT INTO habit_logs
               (habit_id, logged_date, theory_question_id, theory_answer_text, theory_answer_storage_id)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (habit_id, logged_date) DO NOTHING
             RETURNING id`,
            [habitId, today, theory_question_id || null, theory_answer_text || null, theoryStorageId]
        );
        const logId = insertRes.rows[0]?.id || null;

        // Award XP and check streak milestones (fire-and-forget)
        pool.query('SELECT student_id FROM habits WHERE id = $1', [habitId])
            .then(({ rows }) => {
                if (!rows.length) return;
                const { student_id } = rows[0];
                const xpService = require('../services/xpService');
                xpService.awardXP(student_id, 'habit_log', 10, { refId: habitId });
                xpService.checkStreakMilestones(student_id);
            })
            .catch(() => {});

        // Find pending homework assignments that target this habit (for voice note prompt)
        let linkedHomework = [];
        if (logId) {
            try {
                const habitRes = await pool.query(
                    'SELECT student_id FROM habits WHERE id = $1', [habitId]
                );
                if (habitRes.rows.length) {
                    const studentId = habitRes.rows[0].student_id;
                    const hwRes = await pool.query(
                        `SELECT a.id, a.title, a.habit_target_count,
                                COALESCE((
                                  SELECT COUNT(*)::int FROM habit_logs hl2
                                  WHERE hl2.habit_id = $1
                                    AND hl2.logged_date >= a.created_at::date
                                    AND hl2.logged_date <= CURRENT_DATE
                                ), 0) AS habit_target_completed
                         FROM homework_assignments a
                         WHERE a.habit_target_habit_id = $1
                           AND a.student_id = $2
                           AND a.status IN ('pending', 'returned')
                           AND NOT EXISTS (
                             SELECT 1 FROM homework_submissions s
                             WHERE s.assignment_id = a.id
                           )`,
                        [habitId, studentId]
                    );
                    linkedHomework = hwRes.rows;
                }
            } catch (_) {}
        }

        res.json({ logged: true, logId, linkedHomework });
    } catch (err) {
        console.error('[POST /habits/:id/log]', err);
        res.status(500).json({ error: 'Failed to toggle log' });
    }
});

// POST /api/habits/logs/:logId/voice-note — attach a voice note to a habit log row
router.post('/habits/logs/:logId/voice-note', resolveUser, async (req, res) => {
    const { logId } = req.params;
    const { file_name, file_type, file_data } = req.body;
    if (!file_data) return res.status(400).json({ error: 'file_data is required' });

    try {
        const logRes = await pool.query(
            `SELECT hl.id FROM habit_logs hl
             JOIN habits h ON h.id = hl.habit_id
             WHERE hl.id = $1`,
            [logId]
        );
        if (!logRes.rows.length) return res.status(404).json({ error: 'Log not found' });

        let voiceNoteUrl  = null;
        let storageId     = null;
        let storedData    = null;

        const useDrive = process.env.DRIVE_ENABLED === 'true' && Boolean(process.env.DRIVE_FOLDER_HOMEWORK_AUDIO);
        if (useDrive) {
            try {
                const driveService = require('../services/driveService');
                const base64Part = file_data.includes(',') ? file_data.split(',')[1] : file_data;
                const buffer = Buffer.from(base64Part, 'base64');
                const result = await driveService.upload({
                    buffer,
                    fileName: file_name || `voice_note_${Date.now()}.webm`,
                    mimeType: file_type || 'audio/webm',
                    category: 'homework_audio',
                    entityType: 'habit_voice_note',
                    entityId: logId,
                });
                voiceNoteUrl = result.publicUrl;
                storageId    = result.fileStorageId;
            } catch (_) {
                storedData = file_data;
            }
        } else {
            storedData = file_data;
        }

        await pool.query(
            `UPDATE habit_logs
             SET voice_note_url = $1, voice_note_data = $2,
                 voice_note_storage_id = $3, voice_note_recorded_at = NOW()
             WHERE id = $4`,
            [voiceNoteUrl, storedData, storageId, logId]
        );

        res.json({ success: true, voiceNoteUrl });
    } catch (err) {
        console.error('[POST /habits/logs/:id/voice-note]', err);
        res.status(500).json({ error: 'Failed to save voice note' });
    }
});

// GET /api/habits/logs/:logId/voice-note — stream voice note audio (handles Drive + inline base64)
router.get('/habits/logs/:logId/voice-note', resolveUser, async (req, res) => {
    const { logId } = req.params;
    try {
        const result = await pool.query(
            `SELECT hl.voice_note_storage_id, hl.voice_note_url, hl.voice_note_data,
                    fs.drive_file_id, fs.mime_type, fs.file_name
             FROM habit_logs hl
             LEFT JOIN file_storage fs ON fs.id = hl.voice_note_storage_id
             WHERE hl.id = $1`,
            [logId]
        );
        if (!result.rows.length) return res.status(404).json({ error: 'Log not found' });

        const row = result.rows[0];

        // Option 1: Drive-backed storage
        if (row.drive_file_id) {
            const driveService = require('../services/driveService');
            const driveClient  = driveService.getDriveClient();
            const driveRes = await driveClient.files.get(
                { fileId: row.drive_file_id, alt: 'media' },
                { responseType: 'stream' }
            );
            res.setHeader('Content-Type', row.mime_type || 'audio/webm');
            res.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(row.file_name || 'voice_note')}"`);
            driveRes.data.pipe(res);
            return;
        }

        // Option 2: Inline base64 (local dev / no-Drive path)
        if (row.voice_note_data) {
            const base64 = row.voice_note_data;
            let mimeType = 'audio/webm';
            let rawBase64 = base64;
            const m = base64.match(/^data:([^;]+);base64,(.+)$/s);
            if (m) { mimeType = m[1]; rawBase64 = m[2]; }
            const buffer = Buffer.from(rawBase64, 'base64');
            res.setHeader('Content-Type', mimeType);
            res.setHeader('Content-Length', buffer.length);
            return res.send(buffer);
        }

        // Option 3: External URL (rare fallback)
        if (row.voice_note_url) return res.redirect(row.voice_note_url);

        return res.status(404).json({ error: 'No voice note on this log' });
    } catch (err) {
        console.error('[GET /habits/logs/:id/voice-note]', err);
        if (!res.headersSent) res.status(500).json({ error: 'Failed to stream voice note' });
    }
});

// POST /api/habits/assign-bulk — assign the same habit to multiple students at once
router.post('/habits/assign-bulk', resolveUser, async (req, res) => {
    const { student_ids, title, icon, type, level } = req.body;
    if (!Array.isArray(student_ids) || student_ids.length === 0)
        return res.status(400).json({ error: 'student_ids must be a non-empty array' });
    if (!title?.trim())
        return res.status(400).json({ error: 'title is required' });

    const metadata = type === 'theory'
        ? JSON.stringify({ type: 'theory', level: level || 'beginner' })
        : '{}';
    const habitIcon = (icon || '🎵').trim() || '🎵';

    const client = await pool.connect();
    try {
        await client.query('BEGIN');
        let created = 0, skipped = 0;
        const habitIds = [];
        for (const studentId of student_ids) {
            const countRes = await client.query(
                `SELECT COUNT(*) AS total FROM habits WHERE student_id = $1 AND archived_at IS NULL`,
                [studentId]
            );
            if (parseInt(countRes.rows[0].total, 10) >= 10) { skipped++; continue; }

            const orderRes = await client.query(
                `SELECT COALESCE(MAX(display_order), -1) + 1 AS next_order FROM habits WHERE student_id = $1`,
                [studentId]
            );
            const result = await client.query(
                `INSERT INTO habits (student_id, title, icon, display_order, metadata)
                 VALUES ($1, $2, $3, $4, $5::jsonb) RETURNING id`,
                [studentId, title.trim(), habitIcon, orderRes.rows[0].next_order, metadata]
            );
            habitIds.push(result.rows[0].id);
            created++;
        }
        await client.query('COMMIT');
        res.status(201).json({ created, skipped, habit_ids: habitIds });
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('[POST /habits/assign-bulk]', err);
        res.status(500).json({ error: 'Failed to assign habits' });
    } finally {
        client.release();
    }
});

// PUT /api/habits/logs/:logId/theory-answer — teacher marks theory answer correct/incorrect
router.put('/habits/logs/:logId/theory-answer', resolveUser, async (req, res) => {
    const { logId } = req.params;
    const { correct } = req.body;
    if (typeof correct !== 'boolean') return res.status(400).json({ error: 'correct (boolean) is required' });

    try {
        const result = await pool.query(
            `UPDATE habit_logs SET theory_answer_correct = $1
             WHERE id = $2
             RETURNING id, theory_answer_correct,
               (SELECT student_id FROM habits WHERE id = habit_logs.habit_id) AS student_id`,
            [correct, logId]
        );
        if (!result.rows.length) return res.status(404).json({ error: 'Log not found' });

        // Award XP for correct answer (fire-and-forget)
        if (correct) {
            const { student_id } = result.rows[0];
            const xpService = require('../services/xpService');
            xpService.awardXP(student_id, 'theory_correct', 5, { refId: logId })
                .catch(() => {});
        }

        res.json({ success: true });
    } catch (err) {
        console.error('[PUT /habits/logs/:id/theory-answer]', err);
        res.status(500).json({ error: 'Failed to update theory answer' });
    }
});

module.exports = router;
