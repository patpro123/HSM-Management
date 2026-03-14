-- =============================================================================
-- 013_backfill_sujoy_aniruddha.sql
-- Backfill: payments + classes_remaining for Sujoy and Aniruddha B.achenappa
-- Instrument: Keyboard/Piano | Teacher: Shiva (+ Josva for Sujoy's Wed batch)
-- Date: 2026-03-07
--
-- Sujoy         → paid 2026-01-04, expires 2026-04-04, 13 done → 11 remaining
--                 batches: SUN 10:00 (Shiva) + WED 18:30 (Josva) — same enrollment
-- Aniruddha     → "Aniruddha B.achenappa", paid 2026-02-20, expires 2026-05-20,
--                 2 done → 22 remaining
--                 batches: SUN 10:45 + FRI 18:00 (both Shiva)
-- =============================================================================

DO $$
DECLARE
  v_kb_id               uuid;
  v_kb_quarterly_pkg_id uuid;
  v_kb_quarterly_amt    numeric(10,2);

  v_student_id          uuid;
  v_enrollment_id       uuid;
  v_remaining           int;
  v_updated_count       int;

  v_student_ids         uuid[] := '{}';

BEGIN

  -- Resolve Keyboard/Piano instrument
  SELECT id INTO v_kb_id FROM instruments WHERE name ILIKE '%keyboard%' LIMIT 1;
  IF v_kb_id IS NULL THEN RAISE EXCEPTION 'Instrument Keyboard not found'; END IF;

  -- Resolve Keyboard quarterly package
  SELECT id, price INTO v_kb_quarterly_pkg_id, v_kb_quarterly_amt
    FROM packages WHERE instrument_id = v_kb_id AND name ILIKE '%quarterly%' LIMIT 1;
  IF v_kb_quarterly_pkg_id IS NULL THEN RAISE EXCEPTION 'Keyboard quarterly package not found'; END IF;

  RAISE NOTICE 'Keyboard/Piano: instrument=%, pkg=% (%)', v_kb_id, v_kb_quarterly_pkg_id, v_kb_quarterly_amt;

  -- ---------------------------------------------------------------------------
  -- Sujoy | Keyboard | Quarterly | paid 2026-01-04 | 13 done → 11 remaining
  -- Has 2 batches: SUN (Shiva) + WED (Josva) — update both as same instrument quota
  -- ---------------------------------------------------------------------------
  v_remaining := 11;
  SELECT id INTO v_student_id FROM students WHERE name ILIKE '%sujoy%' AND is_active IS NOT FALSE LIMIT 1;
  IF v_student_id IS NULL THEN RAISE EXCEPTION 'Student "Sujoy" not found'; END IF;
  SELECT id INTO v_enrollment_id FROM enrollments WHERE student_id = v_student_id LIMIT 1;

  INSERT INTO payments (student_id, package_id, amount, method, timestamp, metadata)
    VALUES (v_student_id, v_kb_quarterly_pkg_id, v_kb_quarterly_amt, 'cash',
            '2026-01-04 00:00:00+05:30',
            jsonb_build_object('instrument','Keyboard/Piano','period_start','2026-01-04',
                               'period_end','2026-04-04','classes_done',13,'backfill',true));

  -- Update ALL keyboard enrollment_batches for Sujoy (covers both Shiva + Josva slots)
  WITH ranked AS (
    SELECT eb.id, ROW_NUMBER() OVER (ORDER BY eb.id) AS rn
    FROM enrollment_batches eb
    JOIN batches b ON b.id = eb.batch_id
    WHERE eb.enrollment_id = v_enrollment_id AND b.instrument_id = v_kb_id
  )
  UPDATE enrollment_batches SET
    classes_remaining = CASE WHEN r.rn = 1 THEN (v_remaining + 1) / 2 ELSE v_remaining / 2 END,
    payment_frequency = 'quarterly'
  FROM ranked r WHERE enrollment_batches.id = r.id;
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RAISE NOTICE 'Sujoy (Keyboard): payment inserted, % enrollment_batch rows updated, remaining=%', v_updated_count, v_remaining;
  v_student_ids := array_append(v_student_ids, v_student_id);

  -- ---------------------------------------------------------------------------
  -- Aniruddha B.achenappa | Keyboard | Quarterly | paid 2026-02-20 | 2 done → 22 remaining
  -- Using "Aniruddha B.achenappa" (has Shiva batches) — not the empty "Aniruddha" record
  -- ---------------------------------------------------------------------------
  v_remaining := 22;
  SELECT id INTO v_student_id FROM students
    WHERE name ILIKE '%aniruddha%b%' AND is_active IS NOT FALSE LIMIT 1;
  IF v_student_id IS NULL THEN
    -- Fallback: pick the Aniruddha who has enrollment_batches
    SELECT s.id INTO v_student_id FROM students s
    JOIN enrollments e ON e.student_id = s.id
    JOIN enrollment_batches eb ON eb.enrollment_id = e.id
    WHERE s.name ILIKE '%aniruddha%' AND s.is_active IS NOT FALSE
    LIMIT 1;
  END IF;
  IF v_student_id IS NULL THEN RAISE EXCEPTION 'Student "Aniruddha B.achenappa" not found'; END IF;
  SELECT id INTO v_enrollment_id FROM enrollments WHERE student_id = v_student_id LIMIT 1;

  INSERT INTO payments (student_id, package_id, amount, method, timestamp, metadata)
    VALUES (v_student_id, v_kb_quarterly_pkg_id, v_kb_quarterly_amt, 'cash',
            '2026-02-20 00:00:00+05:30',
            jsonb_build_object('instrument','Keyboard/Piano','period_start','2026-02-20',
                               'period_end','2026-05-20','classes_done',2,'backfill',true));

  WITH ranked AS (
    SELECT eb.id, ROW_NUMBER() OVER (ORDER BY eb.id) AS rn
    FROM enrollment_batches eb
    JOIN batches b ON b.id = eb.batch_id
    WHERE eb.enrollment_id = v_enrollment_id AND b.instrument_id = v_kb_id
  )
  UPDATE enrollment_batches SET
    classes_remaining = CASE WHEN r.rn = 1 THEN (v_remaining + 1) / 2 ELSE v_remaining / 2 END,
    payment_frequency = 'quarterly'
  FROM ranked r WHERE enrollment_batches.id = r.id;
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RAISE NOTICE 'Aniruddha B.achenappa (Keyboard): payment inserted, % enrollment_batch rows updated, remaining=%', v_updated_count, v_remaining;
  v_student_ids := array_append(v_student_ids, v_student_id);

  -- Sync enrollments.classes_remaining
  UPDATE enrollments e
  SET classes_remaining = (
    SELECT COALESCE(SUM(eb.classes_remaining), 0)
    FROM enrollment_batches eb WHERE eb.enrollment_id = e.id
  ),
  updated_at = now()
  WHERE e.student_id = ANY(v_student_ids);

  RAISE NOTICE '=== Done. % students processed. ===', array_length(v_student_ids, 1);

END $$;
