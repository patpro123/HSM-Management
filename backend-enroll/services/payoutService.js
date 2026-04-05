'use strict';

/**
 * Returns a Date object set to the 20th of the given month/year (local midnight).
 * Used as the admission cutoff for the monthly payout report.
 *
 * @param {number} [year]  - defaults to current year
 * @param {number} [month] - 1-indexed month, defaults to current month
 * @returns {Date}
 */
function buildPayoutCutoffDate(year, month) {
  const now = new Date();
  const y = year  !== undefined ? year  : now.getFullYear();
  const m = month !== undefined ? month : now.getMonth() + 1; // 1-indexed
  return new Date(y, m - 1, 20); // month is 0-indexed in Date constructor
}

/**
 * Active student SQL:
 *   - Teacher payout_type = 'per_student_monthly'
 *   - Student's earliest enrollment_batches.enrolled_on with this teacher < cutoff (20th of month)
 *   - Total present attendance records for this teacher's batches > 2
 *   - One row per (teacher, student) pair — deduplicates multi-batch enrolments
 */
const ACTIVE_STUDENTS_SQL = `
  SELECT
    t.id                          AS teacher_id,
    t.name                        AS teacher_name,
    t.rate,
    t.metadata->>'email'          AS teacher_email,
    s.id                          AS student_id,
    s.name                        AS student_name,
    MIN(eb.enrolled_on)           AS enrolled_on,
    COUNT(ar.id)                  AS classes_attended
  FROM teachers t
  JOIN batches b
    ON b.teacher_id = t.id
   AND b.is_makeup = FALSE
  JOIN enrollment_batches eb
    ON eb.batch_id = b.id
  JOIN enrollments e
    ON e.id = eb.enrollment_id
  JOIN students s
    ON s.id = e.student_id
  LEFT JOIN attendance_records ar
    ON ar.student_id = s.id
   AND ar.batch_id   = b.id
   AND ar.status     = 'present'
  WHERE t.payout_type = 'per_student_monthly'
    AND t.is_active   = TRUE
  GROUP BY t.id, t.name, t.rate, t.metadata, s.id, s.name
  HAVING
    MIN(eb.enrolled_on) < $1
    AND COUNT(ar.id) > 2
  ORDER BY t.name, s.name
`;

/**
 * Queries the database and returns the monthly payout report.
 *
 * @param {object} pool     - pg Pool (injectable for testing)
 * @param {object} options
 * @param {number} [options.year]   - report year  (default: current)
 * @param {number} [options.month]  - report month 1-indexed (default: current)
 * @returns {Promise<object>} report
 */
async function getMonthlyPayoutReport(pool, { year, month } = {}) {
  const cutoff = buildPayoutCutoffDate(year, month);

  const { rows } = await pool.query(ACTIVE_STUDENTS_SQL, [cutoff]);

  // Group rows by teacher
  const teacherMap = new Map();

  for (const row of rows) {
    if (!teacherMap.has(row.teacher_id)) {
      teacherMap.set(row.teacher_id, {
        teacher_id:         row.teacher_id,
        teacher_name:       row.teacher_name,
        rate:               parseFloat(row.rate),
        teacher_email:      row.teacher_email || null,
        active_students:    [],
      });
    }

    teacherMap.get(row.teacher_id).active_students.push({
      student_id:      row.student_id,
      student_name:    row.student_name,
      enrolled_on:     row.enrolled_on instanceof Date
        ? row.enrolled_on.toISOString().slice(0, 10)
        : row.enrolled_on,
      classes_attended: parseInt(row.classes_attended, 10),
    });
  }

  // Compute per-teacher totals
  const teachers = Array.from(teacherMap.values()).map(t => ({
    ...t,
    active_student_count: t.active_students.length,
    total_payable:        t.rate * t.active_students.length,
  }));

  const grand_total = teachers.reduce((sum, t) => sum + t.total_payable, 0);

  // Format month label
  const now = new Date();
  const reportYear  = year  !== undefined ? year  : now.getFullYear();
  const reportMonth = month !== undefined ? month : now.getMonth() + 1;
  const monthLabel  = `${reportYear}-${String(reportMonth).padStart(2, '0')}`;

  return {
    month:        monthLabel,
    generated_at: new Date().toISOString(),
    teachers,
    grand_total,
  };
}

module.exports = { getMonthlyPayoutReport, buildPayoutCutoffDate };
