-- Migration 030: Per-student rate type for teachers
-- Allows per_student_monthly teachers to be paid either:
--   'fixed'      — a flat amount per billable student per month
--   'percentage' — (student_monthly_fee - maintenance_amount) * payout_percentage

ALTER TABLE teachers
  ADD COLUMN IF NOT EXISTS per_student_rate_type TEXT NOT NULL DEFAULT 'percentage'
    CHECK (per_student_rate_type IN ('fixed', 'percentage')),
  ADD COLUMN IF NOT EXISTS per_student_fixed_rate NUMERIC(10,2) NOT NULL DEFAULT 0
    CHECK (per_student_fixed_rate >= 0);

COMMENT ON COLUMN teachers.per_student_rate_type IS
  'How per_student_monthly teachers are paid: fixed flat rate or percentage of student fee';
COMMENT ON COLUMN teachers.per_student_fixed_rate IS
  'Fixed amount paid per billable student per month when per_student_rate_type = fixed';
