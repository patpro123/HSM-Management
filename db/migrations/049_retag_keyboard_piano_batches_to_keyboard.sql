-- Migration 049: Re-tag Keyboard/Piano batches to Keyboard
-- All 14 batches (teacher: Mriganka Das) were incorrectly created under the
-- 'Keyboard/Piano' instrument. They should belong to 'Keyboard' only.

BEGIN;

-- Dry-run check: show affected batches before updating
DO $$
DECLARE
  affected integer;
BEGIN
  SELECT COUNT(*) INTO affected
  FROM batches b
  JOIN instruments i ON b.instrument_id = i.id
  WHERE i.name = 'Keyboard/Piano';

  RAISE NOTICE 'Batches to re-tag: %', affected;
END $$;

UPDATE batches
SET instrument_id = (SELECT id FROM instruments WHERE name = 'Keyboard')
WHERE instrument_id = (SELECT id FROM instruments WHERE name = 'Keyboard/Piano');

-- Verify
DO $$
DECLARE
  remaining integer;
  updated  integer;
BEGIN
  SELECT COUNT(*) INTO remaining
  FROM batches b
  JOIN instruments i ON b.instrument_id = i.id
  WHERE i.name = 'Keyboard/Piano';

  SELECT COUNT(*) INTO updated
  FROM batches b
  JOIN instruments i ON b.instrument_id = i.id
  WHERE i.name = 'Keyboard';

  RAISE NOTICE 'Keyboard/Piano batches remaining: % (should be 0)', remaining;
  RAISE NOTICE 'Keyboard batches now: %', updated;
END $$;

COMMIT;
