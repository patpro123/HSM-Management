-- Migration 022: Add branches table + split Keyboard/Piano instrument
-- Branches: HSM Main, HSM Pbel City
-- Instrument split: Keyboard and Piano as separate instruments (new students only)
-- Keyboard/Piano marked deprecated — existing enrollments unaffected

-- 1. Add is_deprecated flag to instruments
ALTER TABLE instruments
  ADD COLUMN IF NOT EXISTS is_deprecated boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN instruments.is_deprecated IS
  'When true, instrument is hidden from new enrollment form but retained for historical data';

-- 2. Branches table
CREATE TABLE IF NOT EXISTS branches (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL UNIQUE,
  code       text NOT NULL UNIQUE,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz DEFAULT now()
);

INSERT INTO branches (name, code) VALUES
  ('HSM Main',      'main'),
  ('HSM Pbel City', 'pbel')
ON CONFLICT (code) DO NOTHING;

COMMENT ON TABLE branches IS
  'School branches. HSM Main offers all instruments; HSM Pbel City offers vocals only.';

-- 3. Insert Keyboard and Piano as separate instruments
INSERT INTO instruments (name, max_batch_size, online_supported) VALUES
  ('Keyboard', 10, false),
  ('Piano',    10, false)
ON CONFLICT (name) DO NOTHING;

-- 4. Deprecate the legacy combined instrument
UPDATE instruments
  SET is_deprecated = true
  WHERE name = 'Keyboard/Piano';
