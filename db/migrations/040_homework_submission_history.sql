-- Track the full submit/return/close history for each homework assignment.
-- Each entry: { type, at, file_url, file_storage_id, file_name, note, comment,
--              marks_awarded, marks_awarded_breakdown }
ALTER TABLE homework_assignments
  ADD COLUMN IF NOT EXISTS submission_history JSONB NOT NULL DEFAULT '[]'::jsonb;
