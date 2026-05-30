'use strict';

const pool = require('../db');

const RANKS = [
    { name: 'Rookie',    min: 0,    color: 'slate'  },
    { name: 'Performer', min: 300,  color: 'sky'    },
    { name: 'Artist',    min: 1200, color: 'amber'  },
    { name: 'Maestro',   min: 3500, color: 'orange' },
];

function getRankInfo(totalXP) {
    let current = RANKS[0];
    for (const rank of RANKS) {
        if (totalXP >= rank.min) current = rank;
    }
    const nextIndex = RANKS.indexOf(current) + 1;
    const next = RANKS[nextIndex] || null;
    return {
        rank:        current,
        nextRank:    next,
        xpToNextRank: next ? next.min - totalXP : 0,
    };
}

// INSERT into xp_events, UPDATE students.total_xp — fire-and-forget, never throws
async function awardXP(studentId, eventType, points, { refId, metadata } = {}) {
    if (!studentId || points <= 0) return;
    try {
        await pool.query(
            `INSERT INTO xp_events (student_id, event_type, points, ref_id, metadata)
             VALUES ($1, $2, $3, $4, $5::jsonb)`,
            [studentId, eventType, points, refId || null, JSON.stringify(metadata || {})]
        );
        await pool.query(
            `UPDATE students SET total_xp = total_xp + $1 WHERE id = $2`,
            [points, studentId]
        );
    } catch (err) {
        console.error(`[xpService] awardXP failed (${eventType}, ${points}pts):`, err.message);
    }
}

// After habit toggle ON — check if the student has hit a streak milestone
async function checkStreakMilestones(studentId) {
    try {
        // Get per-day completion counts for last 365 days
        const result = await pool.query(
            `SELECT hl.logged_date::text AS date, COUNT(hl.habit_id) AS count
             FROM habit_logs hl
             JOIN habits h ON h.id = hl.habit_id
             WHERE h.student_id = $1
               AND hl.logged_date >= CURRENT_DATE - INTERVAL '365 days'
             GROUP BY hl.logged_date`,
            [studentId]
        );

        // Re-use the same streak logic as habits.js
        const countRes = await pool.query(
            `SELECT COUNT(*) AS total FROM habits WHERE student_id = $1 AND archived_at IS NULL`,
            [studentId]
        );
        const totalActive = parseInt(countRes.rows[0].total, 10);
        const threshold   = Math.max(1, Math.min(5, totalActive));

        const qualified = new Set(
            result.rows
                .filter(r => parseInt(r.count, 10) >= threshold)
                .map(r => r.date)
        );

        // Walk back from today to compute current streak
        const pad  = n => String(n).padStart(2, '0');
        const fmt  = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
        const cursor = new Date();
        if (!qualified.has(fmt(cursor))) cursor.setDate(cursor.getDate() - 1);
        let streak = 0;
        while (qualified.has(fmt(cursor))) {
            streak++;
            cursor.setDate(cursor.getDate() - 1);
        }

        if (streak === 0) return;

        // Every 7-day multiple: award streak_milestone_7
        if (streak % 7 === 0) {
            const existing = await pool.query(
                `SELECT id FROM xp_events
                 WHERE student_id = $1
                   AND event_type = 'streak_milestone_7'
                   AND (metadata->>'streak')::int = $2
                   AND awarded_at::date = CURRENT_DATE`,
                [studentId, streak]
            );
            if (!existing.rows.length) {
                await awardXP(studentId, 'streak_milestone_7', 75, {
                    metadata: { streak },
                });
            }
        }

        // Every 30-day multiple: additionally award streak_milestone_30
        if (streak % 30 === 0) {
            const existing = await pool.query(
                `SELECT id FROM xp_events
                 WHERE student_id = $1
                   AND event_type = 'streak_milestone_30'
                   AND (metadata->>'streak')::int = $2
                   AND awarded_at::date = CURRENT_DATE`,
                [studentId, streak]
            );
            if (!existing.rows.length) {
                await awardXP(studentId, 'streak_milestone_30', 200, {
                    metadata: { streak },
                });
            }
        }
    } catch (err) {
        console.error('[xpService] checkStreakMilestones failed:', err.message);
    }
}

// Returns full XP summary for a student
async function getStudentXPSummary(studentId) {
    const [studentRes, eventsRes] = await Promise.all([
        pool.query(`SELECT total_xp FROM students WHERE id = $1`, [studentId]),
        pool.query(
            `SELECT event_type, points, metadata, awarded_at
             FROM xp_events WHERE student_id = $1
             ORDER BY awarded_at DESC LIMIT 10`,
            [studentId]
        ),
    ]);

    const totalXP = studentRes.rows[0]?.total_xp ?? 0;
    const { rank, nextRank, xpToNextRank } = getRankInfo(totalXP);

    return {
        totalXP,
        rank,
        nextRank,
        xpToNextRank,
        recentEvents: eventsRes.rows,
    };
}

module.exports = { RANKS, getRankInfo, awardXP, checkStreakMilestones, getStudentXPSummary };
