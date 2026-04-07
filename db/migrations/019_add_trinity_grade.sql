-- Migration 019: Add Trinity grade to enrollment_batches
-- Trinity grades: Initial, Grade 1–8 (used for per-student payout calculations)

ALTER TABLE enrollment_batches
  ADD COLUMN IF NOT EXISTS trinity_grade TEXT NOT NULL DEFAULT 'Initial'
  CHECK (trinity_grade IN ('Initial','Grade 1','Grade 2','Grade 3',
                           'Grade 4','Grade 5','Grade 6','Grade 7','Grade 8','Fixed'));

COMMENT ON COLUMN enrollment_batches.trinity_grade IS
  'Trinity grade level of the student in this batch. "Fixed" is used for vocal instruments where grade does not affect rate.';
