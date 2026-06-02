const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/stats/dashboard
router.get('/dashboard', async (req, res) => {
    try {
        const [
            intentfulResult,
            inactiveStudentsResult,
            activeTeachersResult,
            inactiveTeachersResult,
            teacherStudentResult,
            expensesResult,
            monthlyTrendResult,
            inactiveTrendResult,
        ] = await Promise.all([
            pool.query(
                `SELECT COUNT(*) FROM students
                 WHERE student_type = 'intentful_user' AND is_active = true`
            ),
            pool.query(
                `SELECT COUNT(*) FROM students
                 WHERE is_active = false
                   AND (student_type = 'permanent' OR student_type IS NULL)
                   AND updated_at >= NOW() - INTERVAL '6 months'`
            ),
            pool.query(
                `SELECT COUNT(*) FROM teachers WHERE is_active = true`
            ),
            pool.query(
                `SELECT COUNT(*) FROM teachers
                 WHERE is_active = false
                   AND updated_at >= NOW() - INTERVAL '6 months'`
            ),
            pool.query(
                `SELECT t.name AS teacher, COUNT(DISTINCT s.id) AS active_students
                 FROM teachers t
                 JOIN batches b ON b.teacher_id = t.id
                 JOIN enrollment_batches eb ON eb.batch_id = b.id
                 JOIN enrollments e ON e.id = eb.enrollment_id
                 JOIN students s ON s.id = e.student_id
                 WHERE t.is_active = true
                   AND s.is_active = true
                   AND e.status = 'active'
                 GROUP BY t.id, t.name
                 ORDER BY active_students DESC`
            ),
            pool.query(
                `SELECT COALESCE(SUM(amount), 0) AS total
                 FROM expenses
                 WHERE date >= DATE_TRUNC('month', NOW())`
            ),
            pool.query(
                `WITH months AS (
                   SELECT generate_series(
                     DATE_TRUNC('month', NOW() - INTERVAL '11 months'),
                     DATE_TRUNC('month', NOW()),
                     '1 month'::interval
                   ) AS month_start
                 )
                 SELECT
                   TO_CHAR(m.month_start, 'Mon ''YY') AS label,
                   (
                     SELECT COUNT(DISTINCT s.id)
                     FROM students s
                     JOIN enrollments e ON e.student_id = s.id
                     WHERE (s.student_type = 'permanent' OR s.student_type IS NULL)
                       AND (e.enrolled_on IS NULL OR DATE_TRUNC('month', e.enrolled_on) <= m.month_start)
                       AND (
                         (s.is_active = true  AND e.status = 'active')
                         OR
                         (s.is_active = false AND s.deactivated_at >= m.month_start + INTERVAL '1 month')
                       )
                   ) AS count
                 FROM months m
                 ORDER BY m.month_start`
            ),
            pool.query(
                `WITH months AS (
                   SELECT generate_series(
                     DATE_TRUNC('month', NOW() - INTERVAL '2 months'),
                     DATE_TRUNC('month', NOW()),
                     '1 month'::interval
                   ) AS month_start
                 )
                 SELECT
                   TO_CHAR(m.month_start, 'Mon ''YY') AS label,
                   COUNT(s.id) AS count
                 FROM months m
                 LEFT JOIN students s ON
                   DATE_TRUNC('month', s.updated_at) = m.month_start
                   AND s.is_active = false
                   AND (s.student_type = 'permanent' OR s.student_type IS NULL)
                 GROUP BY m.month_start, label
                 ORDER BY m.month_start`
            ),
        ]);

        res.json({
            intentful_users_count: parseInt(intentfulResult.rows[0].count, 10),
            inactive_students_last_6_months: parseInt(inactiveStudentsResult.rows[0].count, 10),
            active_teachers_count: parseInt(activeTeachersResult.rows[0].count, 10),
            inactive_teachers_last_6_months: parseInt(inactiveTeachersResult.rows[0].count, 10),
            teacher_student_counts: teacherStudentResult.rows.map(r => ({
                teacher: r.teacher,
                active_students: parseInt(r.active_students, 10),
            })),
            current_month_expenses: parseFloat(expensesResult.rows[0].total),
            monthly_student_trend: monthlyTrendResult.rows.map(r => ({
                label: r.label,
                count: parseInt(r.count, 10),
            })),
            monthly_inactive_trend: inactiveTrendResult.rows.map(r => ({
                label: r.label,
                count: parseInt(r.count, 10),
            })),
        });
    } catch (err) {
        console.error('[GET /api/stats/dashboard] Error:', err);
        res.status(500).json({ error: 'Failed to fetch dashboard stats' });
    }
});

// GET /api/stats/inactive-trend?branch=&teacher=&instrument=
// Filters use metadata->last_batch_info snapshotted at deactivation time.
router.get('/inactive-trend', async (req, res) => {
    const { branch, teacher, instrument } = req.query;
    const params = [];
    let paramIdx = 1;
    const conditions = [
        "s.is_active = false",
        "(s.student_type = 'permanent' OR s.student_type IS NULL)",
    ];

    if (teacher) {
        conditions.push(`s.metadata->'last_batch_info'->'teachers' ? $${paramIdx++}`);
        params.push(teacher);
    }
    if (instrument) {
        conditions.push(`s.metadata->'last_batch_info'->'instruments' ? $${paramIdx++}`);
        params.push(instrument);
    }
    if (branch) {
        conditions.push(`s.metadata->'last_batch_info'->'branch_codes' ? $${paramIdx++}`);
        params.push(branch);
    }

    const whereSQL = conditions.join(' AND ');

    const query = `
        WITH months AS (
          SELECT generate_series(
            DATE_TRUNC('month', NOW() - INTERVAL '2 months'),
            DATE_TRUNC('month', NOW()),
            '1 month'::interval
          ) AS month_start
        ),
        inactive AS (
          SELECT s.id, s.updated_at
          FROM students s
          WHERE ${whereSQL}
        )
        SELECT
          TO_CHAR(m.month_start, 'Mon ''YY') AS label,
          COUNT(DISTINCT i.id) AS count
        FROM months m
        LEFT JOIN inactive i ON DATE_TRUNC('month', i.updated_at) = m.month_start
        GROUP BY m.month_start
        ORDER BY m.month_start
    `;

    try {
        const result = await pool.query(query, params);
        res.json({
            monthly_inactive_trend: result.rows.map(r => ({
                label: r.label,
                count: parseInt(r.count, 10),
            })),
        });
    } catch (err) {
        console.error('[GET /api/stats/inactive-trend] Error:', err);
        res.status(500).json({ error: 'Failed to fetch inactive trend' });
    }
});

module.exports = router;
