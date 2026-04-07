-- Migration 021: Teacher-level rate overrides
-- When a teacher's rate for a specific instrument+grade differs from the school-wide rate,
-- store the override here. Takes precedence over instrument_grade_rates at payslip time.

CREATE TABLE IF NOT EXISTS teacher_grade_rate_overrides (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id    uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  instrument_id uuid NOT NULL REFERENCES instruments(id) ON DELETE CASCADE,
  trinity_grade TEXT NOT NULL
    CHECK (trinity_grade IN ('Initial','Grade 1','Grade 2','Grade 3',
                             'Grade 4','Grade 5','Grade 6','Grade 7','Grade 8','Fixed')),
  rate_per_student NUMERIC(10,2) NOT NULL CHECK (rate_per_student >= 0),
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),

  UNIQUE(teacher_id, instrument_id, trinity_grade)
);

CREATE INDEX IF NOT EXISTS idx_teacher_grade_overrides_teacher
  ON teacher_grade_rate_overrides(teacher_id);

COMMENT ON TABLE teacher_grade_rate_overrides IS
  'Teacher-specific overrides for per-student payout rates. Supersedes instrument_grade_rates when present.';
