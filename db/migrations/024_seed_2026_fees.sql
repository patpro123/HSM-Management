-- Migration 024: Seed 2026 fee structure (effective from 2026-04-01)
-- Source: HSM_Revised_Fees_Structure2026-1.pdf
--
-- Grade mapping (PDF → Trinity):
--   Beginner   → Initial + Grade 1  (same rate)
--   Advanced   → Grade 2 + Grade 3  (same rate)
--   Grade 4–8  → explicit
--
-- classes_count: 8 = monthly, 24 = quarterly, 4 = Pbel 4-class package
-- Trial rate: ₹2000 flat per instrument (is_trial = true, classes_count = 4 for 2 weeks)
-- Vocals (HSM Main): monthly only (no quarterly)
-- Violin: monthly only (no quarterly)
-- Pbel City: Carnatic Vocals + Hindustani Vocals only; 4-class and 8-class packages

DO $$
DECLARE
  v_main_id   uuid;
  v_pbel_id   uuid;

  -- HSM Main instruments
  v_guitar    uuid;
  v_keyboard  uuid;
  v_piano     uuid;
  v_drums     uuid;
  v_tabla     uuid;
  v_violin    uuid;
  v_hind      uuid;  -- Hindustani Vocals
  v_carn      uuid;  -- Carnatic Vocals

  v_eff date := '2026-04-01';

BEGIN
  -- Resolve branch IDs
  SELECT id INTO v_main_id FROM branches WHERE code = 'main';
  SELECT id INTO v_pbel_id FROM branches WHERE code = 'pbel';

  -- Resolve instrument IDs
  SELECT id INTO v_guitar   FROM instruments WHERE name = 'Guitar';
  SELECT id INTO v_keyboard FROM instruments WHERE name = 'Keyboard';
  SELECT id INTO v_piano    FROM instruments WHERE name = 'Piano';
  SELECT id INTO v_drums    FROM instruments WHERE name = 'Drums';
  SELECT id INTO v_tabla    FROM instruments WHERE name = 'Tabla';
  SELECT id INTO v_violin   FROM instruments WHERE name = 'Violin';
  SELECT id INTO v_hind     FROM instruments WHERE name = 'Hindustani Vocals';
  SELECT id INTO v_carn     FROM instruments WHERE name = 'Carnatic Vocals';

  -- ============================================================
  -- GUITAR — HSM Main
  -- ============================================================
  INSERT INTO fee_structures (branch_id, instrument_id, trinity_grade, classes_count, fee_amount, effective_from) VALUES
    -- Monthly (8 classes)
    (v_main_id, v_guitar, 'Initial',  8,  4500, v_eff),
    (v_main_id, v_guitar, 'Grade 1',  8,  4500, v_eff),
    (v_main_id, v_guitar, 'Grade 2',  8,  5000, v_eff),
    (v_main_id, v_guitar, 'Grade 3',  8,  5000, v_eff),
    (v_main_id, v_guitar, 'Grade 4',  8,  5700, v_eff),
    (v_main_id, v_guitar, 'Grade 5',  8,  6300, v_eff),
    (v_main_id, v_guitar, 'Grade 6',  8,  7300, v_eff),
    (v_main_id, v_guitar, 'Grade 7',  8,  8300, v_eff),
    (v_main_id, v_guitar, 'Grade 8',  8,  9300, v_eff),
    -- Quarterly (24 classes)
    (v_main_id, v_guitar, 'Initial',  24,  8550, v_eff),
    (v_main_id, v_guitar, 'Grade 1',  24,  8550, v_eff),
    (v_main_id, v_guitar, 'Grade 2',  24, 10050, v_eff),
    (v_main_id, v_guitar, 'Grade 3',  24, 10050, v_eff),
    (v_main_id, v_guitar, 'Grade 4',  24, 12150, v_eff),
    (v_main_id, v_guitar, 'Grade 5',  24, 13950, v_eff),
    (v_main_id, v_guitar, 'Grade 6',  24, 16950, v_eff),
    (v_main_id, v_guitar, 'Grade 7',  24, 19950, v_eff),
    (v_main_id, v_guitar, 'Grade 8',  24, 22950, v_eff),
    -- Trial (2-week, grade-agnostic — stored as Grade 1 with is_trial=true)
    (v_main_id, v_guitar, 'Initial',  4,  2000, v_eff)
  ON CONFLICT (branch_id, instrument_id, trinity_grade, classes_count, effective_from) DO NOTHING;

  -- Mark the trial row
  UPDATE fee_structures SET is_trial = true
  WHERE branch_id = v_main_id AND instrument_id = v_guitar
    AND classes_count = 4 AND effective_from = v_eff;

  -- ============================================================
  -- KEYBOARD — HSM Main (Guitar-tier rates)
  -- ============================================================
  INSERT INTO fee_structures (branch_id, instrument_id, trinity_grade, classes_count, fee_amount, effective_from) VALUES
    (v_main_id, v_keyboard, 'Initial',  8,  4500, v_eff),
    (v_main_id, v_keyboard, 'Grade 1',  8,  4500, v_eff),
    (v_main_id, v_keyboard, 'Grade 2',  8,  5000, v_eff),
    (v_main_id, v_keyboard, 'Grade 3',  8,  5000, v_eff),
    (v_main_id, v_keyboard, 'Grade 4',  8,  5700, v_eff),
    (v_main_id, v_keyboard, 'Grade 5',  8,  6300, v_eff),
    (v_main_id, v_keyboard, 'Grade 6',  8,  7300, v_eff),
    (v_main_id, v_keyboard, 'Grade 7',  8,  8300, v_eff),
    (v_main_id, v_keyboard, 'Grade 8',  8,  9300, v_eff),
    (v_main_id, v_keyboard, 'Initial',  24,  8550, v_eff),
    (v_main_id, v_keyboard, 'Grade 1',  24,  8550, v_eff),
    (v_main_id, v_keyboard, 'Grade 2',  24, 10050, v_eff),
    (v_main_id, v_keyboard, 'Grade 3',  24, 10050, v_eff),
    (v_main_id, v_keyboard, 'Grade 4',  24, 12150, v_eff),
    (v_main_id, v_keyboard, 'Grade 5',  24, 13950, v_eff),
    (v_main_id, v_keyboard, 'Grade 6',  24, 16950, v_eff),
    (v_main_id, v_keyboard, 'Grade 7',  24, 19950, v_eff),
    (v_main_id, v_keyboard, 'Grade 8',  24, 22950, v_eff),
    (v_main_id, v_keyboard, 'Initial',  4,  2000, v_eff)
  ON CONFLICT (branch_id, instrument_id, trinity_grade, classes_count, effective_from) DO NOTHING;

  UPDATE fee_structures SET is_trial = true
  WHERE branch_id = v_main_id AND instrument_id = v_keyboard
    AND classes_count = 4 AND effective_from = v_eff;

  -- ============================================================
  -- PIANO — HSM Main (Piano-tier rates)
  -- ============================================================
  INSERT INTO fee_structures (branch_id, instrument_id, trinity_grade, classes_count, fee_amount, effective_from) VALUES
    (v_main_id, v_piano, 'Initial',  8,  4800, v_eff),
    (v_main_id, v_piano, 'Grade 1',  8,  4800, v_eff),
    (v_main_id, v_piano, 'Grade 2',  8,  5300, v_eff),
    (v_main_id, v_piano, 'Grade 3',  8,  5300, v_eff),
    (v_main_id, v_piano, 'Grade 4',  8,  6000, v_eff),
    (v_main_id, v_piano, 'Grade 5',  8,  6600, v_eff),
    (v_main_id, v_piano, 'Grade 6',  8,  7600, v_eff),
    (v_main_id, v_piano, 'Grade 7',  8,  8600, v_eff),
    (v_main_id, v_piano, 'Grade 8',  8,  9600, v_eff),
    (v_main_id, v_piano, 'Initial',  24,  9150, v_eff),
    (v_main_id, v_piano, 'Grade 1',  24,  9150, v_eff),
    (v_main_id, v_piano, 'Grade 2',  24, 10650, v_eff),
    (v_main_id, v_piano, 'Grade 3',  24, 10650, v_eff),
    (v_main_id, v_piano, 'Grade 4',  24, 12750, v_eff),
    (v_main_id, v_piano, 'Grade 5',  24, 14550, v_eff),
    (v_main_id, v_piano, 'Grade 6',  24, 17550, v_eff),
    (v_main_id, v_piano, 'Grade 7',  24, 20550, v_eff),
    (v_main_id, v_piano, 'Grade 8',  24, 23550, v_eff),
    (v_main_id, v_piano, 'Initial',  4,  2000, v_eff)
  ON CONFLICT (branch_id, instrument_id, trinity_grade, classes_count, effective_from) DO NOTHING;

  UPDATE fee_structures SET is_trial = true
  WHERE branch_id = v_main_id AND instrument_id = v_piano
    AND classes_count = 4 AND effective_from = v_eff;

  -- ============================================================
  -- DRUMS — HSM Main
  -- ============================================================
  INSERT INTO fee_structures (branch_id, instrument_id, trinity_grade, classes_count, fee_amount, effective_from) VALUES
    (v_main_id, v_drums, 'Initial',  8,  5400, v_eff),
    (v_main_id, v_drums, 'Grade 1',  8,  5400, v_eff),
    (v_main_id, v_drums, 'Grade 2',  8,  5800, v_eff),
    (v_main_id, v_drums, 'Grade 3',  8,  5800, v_eff),
    (v_main_id, v_drums, 'Grade 4',  8,  6500, v_eff),
    (v_main_id, v_drums, 'Grade 5',  8,  7100, v_eff),
    (v_main_id, v_drums, 'Grade 6',  8,  8100, v_eff),
    (v_main_id, v_drums, 'Grade 7',  8,  9100, v_eff),
    (v_main_id, v_drums, 'Grade 8',  8, 10100, v_eff),
    (v_main_id, v_drums, 'Initial',  24, 10845, v_eff),
    (v_main_id, v_drums, 'Grade 1',  24, 10845, v_eff),
    (v_main_id, v_drums, 'Grade 2',  24, 12045, v_eff),
    (v_main_id, v_drums, 'Grade 3',  24, 12045, v_eff),
    (v_main_id, v_drums, 'Grade 4',  24, 14145, v_eff),
    (v_main_id, v_drums, 'Grade 5',  24, 15945, v_eff),
    (v_main_id, v_drums, 'Grade 6',  24, 18945, v_eff),
    (v_main_id, v_drums, 'Grade 7',  24, 21945, v_eff),
    (v_main_id, v_drums, 'Grade 8',  24, 24945, v_eff),
    (v_main_id, v_drums, 'Initial',  4,  2000, v_eff)
  ON CONFLICT (branch_id, instrument_id, trinity_grade, classes_count, effective_from) DO NOTHING;

  UPDATE fee_structures SET is_trial = true
  WHERE branch_id = v_main_id AND instrument_id = v_drums
    AND classes_count = 4 AND effective_from = v_eff;

  -- ============================================================
  -- TABLA — HSM Main (same rates as Drums)
  -- ============================================================
  INSERT INTO fee_structures (branch_id, instrument_id, trinity_grade, classes_count, fee_amount, effective_from) VALUES
    (v_main_id, v_tabla, 'Initial',  8,  5400, v_eff),
    (v_main_id, v_tabla, 'Grade 1',  8,  5400, v_eff),
    (v_main_id, v_tabla, 'Grade 2',  8,  5800, v_eff),
    (v_main_id, v_tabla, 'Grade 3',  8,  5800, v_eff),
    (v_main_id, v_tabla, 'Grade 4',  8,  6500, v_eff),
    (v_main_id, v_tabla, 'Grade 5',  8,  7100, v_eff),
    (v_main_id, v_tabla, 'Grade 6',  8,  8100, v_eff),
    (v_main_id, v_tabla, 'Grade 7',  8,  9100, v_eff),
    (v_main_id, v_tabla, 'Grade 8',  8, 10100, v_eff),
    (v_main_id, v_tabla, 'Initial',  24, 10845, v_eff),
    (v_main_id, v_tabla, 'Grade 1',  24, 10845, v_eff),
    (v_main_id, v_tabla, 'Grade 2',  24, 12045, v_eff),
    (v_main_id, v_tabla, 'Grade 3',  24, 12045, v_eff),
    (v_main_id, v_tabla, 'Grade 4',  24, 14145, v_eff),
    (v_main_id, v_tabla, 'Grade 5',  24, 15945, v_eff),
    (v_main_id, v_tabla, 'Grade 6',  24, 18945, v_eff),
    (v_main_id, v_tabla, 'Grade 7',  24, 21945, v_eff),
    (v_main_id, v_tabla, 'Grade 8',  24, 24945, v_eff),
    (v_main_id, v_tabla, 'Initial',  4,  2000, v_eff)
  ON CONFLICT (branch_id, instrument_id, trinity_grade, classes_count, effective_from) DO NOTHING;

  UPDATE fee_structures SET is_trial = true
  WHERE branch_id = v_main_id AND instrument_id = v_tabla
    AND classes_count = 4 AND effective_from = v_eff;

  -- ============================================================
  -- VIOLIN — HSM Main (monthly only, no quarterly)
  -- ============================================================
  INSERT INTO fee_structures (branch_id, instrument_id, trinity_grade, classes_count, fee_amount, effective_from) VALUES
    (v_main_id, v_violin, 'Initial',  8,  3900, v_eff),
    (v_main_id, v_violin, 'Grade 1',  8,  3900, v_eff),
    (v_main_id, v_violin, 'Grade 2',  8,  4400, v_eff),
    (v_main_id, v_violin, 'Grade 3',  8,  4400, v_eff),
    (v_main_id, v_violin, 'Grade 4',  8,  5100, v_eff),
    (v_main_id, v_violin, 'Grade 5',  8,  5700, v_eff),
    (v_main_id, v_violin, 'Grade 6',  8,  6700, v_eff),
    (v_main_id, v_violin, 'Grade 7',  8,  7700, v_eff),
    (v_main_id, v_violin, 'Grade 8',  8,  8700, v_eff),
    -- Trial
    (v_main_id, v_violin, 'Initial',  4,  2000, v_eff)
  ON CONFLICT (branch_id, instrument_id, trinity_grade, classes_count, effective_from) DO NOTHING;

  UPDATE fee_structures SET is_trial = true
  WHERE branch_id = v_main_id AND instrument_id = v_violin
    AND classes_count = 4 AND effective_from = v_eff;

  -- ============================================================
  -- HINDUSTANI VOCALS — HSM Main (single rate, monthly only)
  -- ============================================================
  INSERT INTO fee_structures (branch_id, instrument_id, trinity_grade, classes_count, fee_amount, effective_from) VALUES
    (v_main_id, v_hind, 'Fixed',   8,  3500, v_eff),
    (v_main_id, v_hind, 'Initial', 4,  2000, v_eff)
  ON CONFLICT (branch_id, instrument_id, trinity_grade, classes_count, effective_from) DO NOTHING;

  UPDATE fee_structures SET is_trial = true
  WHERE branch_id = v_main_id AND instrument_id = v_hind
    AND classes_count = 4 AND effective_from = v_eff;

  -- ============================================================
  -- CARNATIC VOCALS — HSM Main (single rate ₹2099/month, monthly only)
  -- ============================================================
  INSERT INTO fee_structures (branch_id, instrument_id, trinity_grade, classes_count, fee_amount, effective_from) VALUES
    (v_main_id, v_carn, 'Fixed',   8,  2099, v_eff),
    (v_main_id, v_carn, 'Initial', 4,  2000, v_eff)
  ON CONFLICT (branch_id, instrument_id, trinity_grade, classes_count, effective_from) DO NOTHING;

  UPDATE fee_structures SET is_trial = true
  WHERE branch_id = v_main_id AND instrument_id = v_carn
    AND classes_count = 4 AND effective_from = v_eff;

  -- ============================================================
  -- HSM PBEL CITY — Hindustani Vocals (4-class and 8-class packages)
  -- ============================================================
  INSERT INTO fee_structures (branch_id, instrument_id, trinity_grade, classes_count, fee_amount, effective_from) VALUES
    (v_pbel_id, v_hind, 'Fixed', 4,  1600, v_eff),
    (v_pbel_id, v_hind, 'Fixed', 8,  2990, v_eff),
    -- Trial (same 2000 flat)
    (v_pbel_id, v_hind, 'Initial', 4, 2000, v_eff)
  ON CONFLICT (branch_id, instrument_id, trinity_grade, classes_count, effective_from) DO NOTHING;

  UPDATE fee_structures SET is_trial = true
  WHERE branch_id = v_pbel_id AND instrument_id = v_hind
    AND trinity_grade = 'Initial' AND classes_count = 4 AND effective_from = v_eff;

  -- ============================================================
  -- HSM PBEL CITY — Carnatic Vocals (4-class and 8-class packages)
  -- ============================================================
  INSERT INTO fee_structures (branch_id, instrument_id, trinity_grade, classes_count, fee_amount, effective_from) VALUES
    (v_pbel_id, v_carn, 'Fixed', 4,  1600, v_eff),
    (v_pbel_id, v_carn, 'Fixed', 8,  2990, v_eff),
    -- Trial
    (v_pbel_id, v_carn, 'Initial', 4, 2000, v_eff)
  ON CONFLICT (branch_id, instrument_id, trinity_grade, classes_count, effective_from) DO NOTHING;

  UPDATE fee_structures SET is_trial = true
  WHERE branch_id = v_pbel_id AND instrument_id = v_carn
    AND trinity_grade = 'Initial' AND classes_count = 4 AND effective_from = v_eff;

END $$;
