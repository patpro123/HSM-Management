-- Migration 015: Add is_extra flag to attendance_records
-- Allows recording a second (extra/makeup) attendance for the same student
-- on the same batch and date without overwriting the regular attendance record.

ALTER TABLE attendance_records
  ADD COLUMN IF NOT EXISTS is_extra BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN attendance_records.is_extra IS
  'TRUE for makeup / extra-session records. Multiple records with is_extra=TRUE may exist for the same (batch_id, student_id, session_date). Each deducts from classes_remaining.';
