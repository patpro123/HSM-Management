-- Migration 025: Migrate Keyboard/Piano instrument data to Keyboard
-- Moves all batches, packages, and enrollment references from the
-- deprecated 'Keyboard/Piano' instrument to the active 'Keyboard' instrument.
-- Marks 'Keyboard/Piano' as deprecated when done.

BEGIN;

DO $$
DECLARE
  v_old_id UUID;
  v_new_id UUID;
  v_count INT;
BEGIN
  -- Resolve instrument IDs
  SELECT id INTO v_old_id FROM instruments WHERE name = 'Keyboard/Piano';
  SELECT id INTO v_new_id FROM instruments WHERE name = 'Keyboard' AND (is_deprecated IS NULL OR is_deprecated = false);

  IF v_old_id IS NULL THEN
    RAISE EXCEPTION 'Keyboard/Piano instrument not found';
  END IF;

  IF v_new_id IS NULL THEN
    RAISE EXCEPTION 'Active Keyboard instrument not found';
  END IF;

  RAISE NOTICE 'Migrating from % (Keyboard/Piano) → % (Keyboard)', v_old_id, v_new_id;

  -- 1. Migrate batches
  UPDATE batches SET instrument_id = v_new_id WHERE instrument_id = v_old_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Migrated % batch(es)', v_count;

  -- 2. Migrate packages
  UPDATE packages SET instrument_id = v_new_id WHERE instrument_id = v_old_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Migrated % package(s)', v_count;

  -- 3. Migrate enrollment instrument_id references (if column exists)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'enrollments' AND column_name = 'instrument_id'
  ) THEN
    UPDATE enrollments SET instrument_id = v_new_id WHERE instrument_id = v_old_id;
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RAISE NOTICE 'Migrated % enrollment(s)', v_count;
  ELSE
    RAISE NOTICE 'enrollments.instrument_id column does not exist — skipping';
  END IF;

  -- 4. Migrate fee_structures (in case any remain)
  UPDATE fee_structures SET instrument_id = v_new_id WHERE instrument_id = v_old_id;
  GET DIAGNOSTICS v_count = ROW_COUNT;
  RAISE NOTICE 'Migrated % fee_structure(s)', v_count;

  -- 5. Mark Keyboard/Piano as deprecated
  UPDATE instruments SET is_deprecated = true WHERE id = v_old_id;
  RAISE NOTICE 'Marked Keyboard/Piano (%) as deprecated', v_old_id;

END $$;

COMMIT;
