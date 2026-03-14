-- Migration 012: Teacher Attendance View
-- Creates a helper view for counting sessions conducted per teacher per month.
-- All data derived from existing attendance_records + batches tables — no new tables.

CREATE OR REPLACE VIEW teacher_session_counts AS
SELECT
  b.teacher_id,
  date_trunc('month', ar.session_date)::date AS month,
  COUNT(DISTINCT ar.session_date::text || '-' || ar.batch_id::text) AS sessions_conducted
FROM attendance_records ar
JOIN batches b ON ar.batch_id = b.id
WHERE b.teacher_id IS NOT NULL
GROUP BY b.teacher_id, date_trunc('month', ar.session_date);

-- Grant read access (adjust role name to match your DB setup)
-- GRANT SELECT ON teacher_session_counts TO hsm_admin;
