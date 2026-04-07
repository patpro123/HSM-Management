-- Migration 020: School-wide instrument × grade rate table
-- For non-vocal instruments: one row per (instrument, trinity_grade)
-- For vocal instruments (Hindustani Vocals, Carnatic Vocals): one row with trinity_grade = 'Fixed'

CREATE TABLE IF NOT EXISTS instrument_grade_rates (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_id uuid NOT NULL REFERENCES instruments(id) ON DELETE CASCADE,
  trinity_grade TEXT NOT NULL
    CHECK (trinity_grade IN ('Initial','Grade 1','Grade 2','Grade 3',
                             'Grade 4','Grade 5','Grade 6','Grade 7','Grade 8','Fixed')),
  rate_per_student NUMERIC(10,2) NOT NULL DEFAULT 0 CHECK (rate_per_student >= 0),
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now(),

  UNIQUE(instrument_id, trinity_grade)
);

CREATE INDEX IF NOT EXISTS idx_instrument_grade_rates_instrument
  ON instrument_grade_rates(instrument_id);

COMMENT ON TABLE instrument_grade_rates IS
  'School-wide per-student payout rates per instrument and Trinity grade. Vocal instruments use trinity_grade = ''Fixed''.';
