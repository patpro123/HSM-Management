-- Migration 038: Add marks, breakdown, and teacher feedback to homework workflow
-- Status flow: pending → submitted → returned | closed
-- 'returned' allows student to resubmit; 'closed' terminates with optional marks

ALTER TABLE homework_assignments
  ADD COLUMN IF NOT EXISTS total_marks            INTEGER,
  ADD COLUMN IF NOT EXISTS marks_breakdown        JSONB,
  ADD COLUMN IF NOT EXISTS teacher_comment        TEXT,
  ADD COLUMN IF NOT EXISTS marks_awarded          INTEGER,
  ADD COLUMN IF NOT EXISTS marks_awarded_breakdown JSONB;
