-- Migration 029: Per-teacher payout parameters
-- Stores configurable maintenance_amount and payout_percentage used in the
-- per-student teacher pay formula: max(0, (R - maintenance_amount) * payout_percentage)

ALTER TABLE teachers
  ADD COLUMN IF NOT EXISTS maintenance_amount numeric(10,2) NOT NULL DEFAULT 1200
    CHECK (maintenance_amount >= 0),
  ADD COLUMN IF NOT EXISTS payout_percentage  numeric(5,4)  NOT NULL DEFAULT 0.70
    CHECK (payout_percentage >= 0 AND payout_percentage <= 1);

COMMENT ON COLUMN teachers.maintenance_amount IS
  'Per-student monthly overhead deducted before teacher share (default 1200)';
COMMENT ON COLUMN teachers.payout_percentage IS
  'Fraction of (R - maintenance_amount) paid to teacher (default 0.70 = 70%)';
