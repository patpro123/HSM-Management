-- Migration 023: Student-facing fee structures table
-- Replaces the simple packages table for new enrollments.
-- Rates are versioned by effective_from date.
-- Old students keep their rate via the locked fee_structure_id on enrollment_batches.

CREATE TABLE IF NOT EXISTS fee_structures (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  branch_id     uuid NOT NULL REFERENCES branches(id) ON DELETE RESTRICT,
  instrument_id uuid NOT NULL REFERENCES instruments(id) ON DELETE RESTRICT,
  -- trinity_grade: standard grades, 'Fixed' for vocals (single rate), 'Trial' for trial period
  trinity_grade text NOT NULL
    CHECK (trinity_grade IN (
      'Initial', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4',
      'Grade 5', 'Grade 6', 'Grade 7', 'Grade 8', 'Fixed', 'Trial'
    )),
  classes_count integer NOT NULL CHECK (classes_count > 0),
  -- 8 = monthly, 24 = quarterly (HSM Main); 4 or 8 for Pbel City vocals
  fee_amount    numeric(10,2) NOT NULL CHECK (fee_amount >= 0),
  is_trial      boolean NOT NULL DEFAULT false,
  effective_from date NOT NULL,
  created_at    timestamptz DEFAULT now(),

  UNIQUE(branch_id, instrument_id, trinity_grade, classes_count, effective_from)
);

CREATE INDEX IF NOT EXISTS idx_fee_structures_lookup
  ON fee_structures(branch_id, instrument_id, effective_from DESC);

COMMENT ON TABLE fee_structures IS
  'Student-facing fee rates versioned by effective_from date. '
  'classes_count: 8=monthly, 24=quarterly, 4=Pbel 4-class, Trial rows use is_trial=true. '
  'trinity_grade Fixed = vocal instruments (single rate). '
  'New enrollments lock their rate via enrollment_batches.fee_structure_id.';

-- Lock rate at enrollment time: nullable so existing enrollments are unaffected
ALTER TABLE enrollment_batches
  ADD COLUMN IF NOT EXISTS fee_structure_id uuid REFERENCES fee_structures(id) ON DELETE SET NULL;

COMMENT ON COLUMN enrollment_batches.fee_structure_id IS
  'Fee rate locked at enrollment time. NULL for pre-2026 enrollments (use legacy packages).';
