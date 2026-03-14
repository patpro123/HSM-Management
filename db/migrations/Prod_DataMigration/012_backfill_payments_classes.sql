-- =============================================================================
-- 012_backfill_payments_classes.sql
-- Backfill: Insert payments and update classes_remaining for Shiva's students
-- Teacher: Shiva | Instruments: Keyboard/Piano, Guitar, Drums
-- Date: 2026-03-07
--
-- Skipped students (not in DB): Sujay, Anirudha
-- K.yashwant  → DB name: "Yashwant K"
-- Arav        → DB name: "Aarav Roy choudhuri"
-- Pavan kadari→ DB name: "Kadari pavan" (enrolled in both Keyboard & Guitar)
-- Siddhan     → DB name: "Siddhan Erumala" (new Drums batches will be created)
--
-- classes_remaining split evenly across 2 batches per student per instrument:
--   batch1 = CEIL(total/2), batch2 = FLOOR(total/2)
-- =============================================================================

DO $$
DECLARE
  v_shiva_id            uuid;
  v_kb_id               uuid;
  v_gt_id               uuid;
  v_dr_id               uuid;

  v_kb_quarterly_pkg_id uuid;  v_kb_quarterly_amt  numeric(10,2);
  v_kb_monthly_pkg_id   uuid;  v_kb_monthly_amt    numeric(10,2);
  v_gt_quarterly_pkg_id uuid;  v_gt_quarterly_amt  numeric(10,2);
  v_dr_quarterly_pkg_id uuid;  v_dr_quarterly_amt  numeric(10,2);

  v_dr_fri_batch_id     uuid;
  v_dr_sun_batch_id     uuid;

  v_student_id          uuid;
  v_enrollment_id       uuid;
  v_remaining           int;
  v_updated_count       int;

  v_student_ids         uuid[] := '{}';

BEGIN

  -- =========================================================================
  -- STEP 1: Resolve shared IDs
  -- =========================================================================

  SELECT id INTO v_shiva_id FROM teachers WHERE name ILIKE '%shiva%' LIMIT 1;
  IF v_shiva_id IS NULL THEN RAISE EXCEPTION 'Teacher "Shiva" not found'; END IF;
  RAISE NOTICE 'Teacher Shiva: %', v_shiva_id;

  SELECT id INTO v_kb_id FROM instruments WHERE name ILIKE '%keyboard%' LIMIT 1;
  SELECT id INTO v_gt_id FROM instruments WHERE name ILIKE '%guitar%'   LIMIT 1;
  SELECT id INTO v_dr_id FROM instruments WHERE name ILIKE '%drum%'     LIMIT 1;
  IF v_kb_id IS NULL THEN RAISE EXCEPTION 'Instrument Keyboard not found'; END IF;
  IF v_gt_id IS NULL THEN RAISE EXCEPTION 'Instrument Guitar not found';   END IF;
  IF v_dr_id IS NULL THEN RAISE EXCEPTION 'Instrument Drums not found';    END IF;
  RAISE NOTICE 'Instruments — KB: %, GT: %, DR: %', v_kb_id, v_gt_id, v_dr_id;

  -- Packages: distinguish by name (both monthly and quarterly have classes_count=24 in this DB)
  SELECT id, price INTO v_kb_quarterly_pkg_id, v_kb_quarterly_amt
    FROM packages WHERE instrument_id = v_kb_id AND name ILIKE '%quarterly%' LIMIT 1;
  SELECT id, price INTO v_kb_monthly_pkg_id, v_kb_monthly_amt
    FROM packages WHERE instrument_id = v_kb_id AND name ILIKE '%monthly%' LIMIT 1;
  SELECT id, price INTO v_gt_quarterly_pkg_id, v_gt_quarterly_amt
    FROM packages WHERE instrument_id = v_gt_id AND name ILIKE '%quarterly%' LIMIT 1;
  SELECT id, price INTO v_dr_quarterly_pkg_id, v_dr_quarterly_amt
    FROM packages WHERE instrument_id = v_dr_id AND name ILIKE '%quarterly%' LIMIT 1;

  IF v_kb_quarterly_pkg_id IS NULL THEN RAISE EXCEPTION 'Keyboard quarterly package not found'; END IF;
  IF v_kb_monthly_pkg_id   IS NULL THEN RAISE EXCEPTION 'Keyboard monthly package not found';   END IF;
  IF v_gt_quarterly_pkg_id IS NULL THEN RAISE EXCEPTION 'Guitar quarterly package not found';   END IF;
  IF v_dr_quarterly_pkg_id IS NULL THEN RAISE EXCEPTION 'Drums quarterly package not found';    END IF;
  RAISE NOTICE 'Packages resolved: KB-Q=% (%), KB-M=% (%), GT-Q=% (%), DR-Q=% (%)',
    v_kb_quarterly_pkg_id, v_kb_quarterly_amt,
    v_kb_monthly_pkg_id,   v_kb_monthly_amt,
    v_gt_quarterly_pkg_id, v_gt_quarterly_amt,
    v_dr_quarterly_pkg_id, v_dr_quarterly_amt;

  -- =========================================================================
  -- STEP 2: Create new Drums batches for Shiva (for Siddhan)
  -- =========================================================================

  INSERT INTO batches (instrument_id, teacher_id, recurrence, start_time, end_time, capacity, is_makeup)
    VALUES (v_dr_id, v_shiva_id, 'FRI 17:00-17:45', '17:00', '17:45', 5, false)
    RETURNING id INTO v_dr_fri_batch_id;

  INSERT INTO batches (instrument_id, teacher_id, recurrence, start_time, end_time, capacity, is_makeup)
    VALUES (v_dr_id, v_shiva_id, 'SUN 10:45-11:30', '10:45', '11:30', 5, false)
    RETURNING id INTO v_dr_sun_batch_id;

  RAISE NOTICE 'Created Drums batches for Shiva — FRI: %, SUN: %', v_dr_fri_batch_id, v_dr_sun_batch_id;

  RAISE NOTICE '=== Starting per-student backfill ===';

  -- =========================================================================
  -- KEYBOARD STUDENTS
  -- =========================================================================

  -- Pattern per student:
  --   1. Find student_id
  --   2. Find enrollment_id
  --   3. Insert payment
  --   4. UPDATE enrollment_batches for this student+Shiva+instrument,
  --      splitting remaining as CEIL/FLOOR across 2 batches
  --   5. Append student_id to v_student_ids

  -- ---------------------------------------------------------------------------
  -- Menaja | Keyboard | Quarterly | paid 2025-12-05 | 11 done → 13 remaining
  -- ---------------------------------------------------------------------------
  v_remaining := 13;
  SELECT id INTO v_student_id FROM students WHERE name ILIKE '%menaja%' AND is_active IS NOT FALSE LIMIT 1;
  IF v_student_id IS NULL THEN RAISE EXCEPTION 'Student "Menaja" not found'; END IF;
  SELECT id INTO v_enrollment_id FROM enrollments WHERE student_id = v_student_id LIMIT 1;

  INSERT INTO payments (student_id, package_id, amount, method, timestamp, metadata)
    VALUES (v_student_id, v_kb_quarterly_pkg_id, v_kb_quarterly_amt, 'cash',
            '2025-12-05 00:00:00+05:30',
            jsonb_build_object('instrument','Keyboard/Piano','period_start','2025-12-05',
                               'period_end','2026-03-05','classes_done',11,'backfill',true));

  WITH ranked AS (
    SELECT eb.id, ROW_NUMBER() OVER (ORDER BY eb.id) AS rn
    FROM enrollment_batches eb JOIN batches b ON b.id = eb.batch_id
    WHERE eb.enrollment_id = v_enrollment_id AND b.teacher_id = v_shiva_id AND b.instrument_id = v_kb_id
  )
  UPDATE enrollment_batches SET
    classes_remaining = CASE WHEN r.rn = 1 THEN (v_remaining + 1) / 2 ELSE v_remaining / 2 END,
    payment_frequency = 'quarterly'
  FROM ranked r WHERE enrollment_batches.id = r.id;
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RAISE NOTICE 'Menaja (Keyboard): payment inserted, % enrollment_batch rows updated, remaining=%', v_updated_count, v_remaining;
  v_student_ids := array_append(v_student_ids, v_student_id);

  -- ---------------------------------------------------------------------------
  -- Anish | Keyboard | Quarterly | paid 2026-02-20 | 2 done → 22 remaining
  -- ---------------------------------------------------------------------------
  v_remaining := 22;
  SELECT id INTO v_student_id FROM students WHERE name ILIKE '%anish%' AND is_active IS NOT FALSE LIMIT 1;
  IF v_student_id IS NULL THEN RAISE EXCEPTION 'Student "Anish" not found'; END IF;
  SELECT id INTO v_enrollment_id FROM enrollments WHERE student_id = v_student_id LIMIT 1;

  INSERT INTO payments (student_id, package_id, amount, method, timestamp, metadata)
    VALUES (v_student_id, v_kb_quarterly_pkg_id, v_kb_quarterly_amt, 'cash',
            '2026-02-20 00:00:00+05:30',
            jsonb_build_object('instrument','Keyboard/Piano','period_start','2026-02-20',
                               'period_end','2026-05-20','classes_done',2,'backfill',true));

  WITH ranked AS (
    SELECT eb.id, ROW_NUMBER() OVER (ORDER BY eb.id) AS rn
    FROM enrollment_batches eb JOIN batches b ON b.id = eb.batch_id
    WHERE eb.enrollment_id = v_enrollment_id AND b.teacher_id = v_shiva_id AND b.instrument_id = v_kb_id
  )
  UPDATE enrollment_batches SET
    classes_remaining = CASE WHEN r.rn = 1 THEN (v_remaining + 1) / 2 ELSE v_remaining / 2 END,
    payment_frequency = 'quarterly'
  FROM ranked r WHERE enrollment_batches.id = r.id;
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RAISE NOTICE 'Anish (Keyboard): payment inserted, % enrollment_batch rows updated, remaining=%', v_updated_count, v_remaining;
  v_student_ids := array_append(v_student_ids, v_student_id);

  -- ---------------------------------------------------------------------------
  -- Arav (Aarav Roy choudhuri) | Keyboard | Quarterly | paid 2025-11-16 | 21 done → 3 remaining
  -- ---------------------------------------------------------------------------
  v_remaining := 3;
  SELECT id INTO v_student_id FROM students WHERE name ILIKE '%arav%roy%' AND is_active IS NOT FALSE LIMIT 1;
  IF v_student_id IS NULL THEN
    SELECT id INTO v_student_id FROM students WHERE name ILIKE '%aarav%roy%' AND is_active IS NOT FALSE LIMIT 1;
  END IF;
  IF v_student_id IS NULL THEN RAISE EXCEPTION 'Student "Arav / Aarav Roy choudhuri" not found'; END IF;
  SELECT id INTO v_enrollment_id FROM enrollments WHERE student_id = v_student_id LIMIT 1;

  INSERT INTO payments (student_id, package_id, amount, method, timestamp, metadata)
    VALUES (v_student_id, v_kb_quarterly_pkg_id, v_kb_quarterly_amt, 'cash',
            '2025-11-16 00:00:00+05:30',
            jsonb_build_object('instrument','Keyboard/Piano','period_start','2025-11-16',
                               'period_end','2026-02-16','classes_done',21,'backfill',true));

  WITH ranked AS (
    SELECT eb.id, ROW_NUMBER() OVER (ORDER BY eb.id) AS rn
    FROM enrollment_batches eb JOIN batches b ON b.id = eb.batch_id
    WHERE eb.enrollment_id = v_enrollment_id AND b.teacher_id = v_shiva_id AND b.instrument_id = v_kb_id
  )
  UPDATE enrollment_batches SET
    classes_remaining = CASE WHEN r.rn = 1 THEN (v_remaining + 1) / 2 ELSE v_remaining / 2 END,
    payment_frequency = 'quarterly'
  FROM ranked r WHERE enrollment_batches.id = r.id;
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RAISE NOTICE 'Arav/Aarav Roy choudhuri (Keyboard): payment inserted, % enrollment_batch rows updated, remaining=%', v_updated_count, v_remaining;
  v_student_ids := array_append(v_student_ids, v_student_id);

  -- ---------------------------------------------------------------------------
  -- Kadari Pavan | Keyboard | Quarterly | paid 2025-11-21 | 22 done → 2 remaining
  -- ---------------------------------------------------------------------------
  v_remaining := 2;
  SELECT id INTO v_student_id FROM students WHERE name ILIKE '%kadari%' AND is_active IS NOT FALSE LIMIT 1;
  IF v_student_id IS NULL THEN RAISE EXCEPTION 'Student "Kadari Pavan" not found'; END IF;
  SELECT id INTO v_enrollment_id FROM enrollments WHERE student_id = v_student_id LIMIT 1;

  INSERT INTO payments (student_id, package_id, amount, method, timestamp, metadata)
    VALUES (v_student_id, v_kb_quarterly_pkg_id, v_kb_quarterly_amt, 'cash',
            '2025-11-21 00:00:00+05:30',
            jsonb_build_object('instrument','Keyboard/Piano','period_start','2025-11-21',
                               'period_end','2026-02-21','classes_done',22,'backfill',true));

  WITH ranked AS (
    SELECT eb.id, ROW_NUMBER() OVER (ORDER BY eb.id) AS rn
    FROM enrollment_batches eb JOIN batches b ON b.id = eb.batch_id
    WHERE eb.enrollment_id = v_enrollment_id AND b.teacher_id = v_shiva_id AND b.instrument_id = v_kb_id
  )
  UPDATE enrollment_batches SET
    classes_remaining = CASE WHEN r.rn = 1 THEN (v_remaining + 1) / 2 ELSE v_remaining / 2 END,
    payment_frequency = 'quarterly'
  FROM ranked r WHERE enrollment_batches.id = r.id;
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RAISE NOTICE 'Kadari Pavan (Keyboard): payment inserted, % enrollment_batch rows updated, remaining=%', v_updated_count, v_remaining;
  v_student_ids := array_append(v_student_ids, v_student_id);

  -- ---------------------------------------------------------------------------
  -- Y.Ashok | Keyboard | Quarterly | paid 2026-01-11 | 11 done → 13 remaining
  -- ---------------------------------------------------------------------------
  v_remaining := 13;
  SELECT id INTO v_student_id FROM students WHERE name ILIKE '%ashok%' AND is_active IS NOT FALSE LIMIT 1;
  IF v_student_id IS NULL THEN RAISE EXCEPTION 'Student "Y.Ashok" not found'; END IF;
  SELECT id INTO v_enrollment_id FROM enrollments WHERE student_id = v_student_id LIMIT 1;

  INSERT INTO payments (student_id, package_id, amount, method, timestamp, metadata)
    VALUES (v_student_id, v_kb_quarterly_pkg_id, v_kb_quarterly_amt, 'cash',
            '2026-01-11 00:00:00+05:30',
            jsonb_build_object('instrument','Keyboard/Piano','period_start','2026-01-11',
                               'period_end','2026-04-11','classes_done',11,'backfill',true));

  WITH ranked AS (
    SELECT eb.id, ROW_NUMBER() OVER (ORDER BY eb.id) AS rn
    FROM enrollment_batches eb JOIN batches b ON b.id = eb.batch_id
    WHERE eb.enrollment_id = v_enrollment_id AND b.teacher_id = v_shiva_id AND b.instrument_id = v_kb_id
  )
  UPDATE enrollment_batches SET
    classes_remaining = CASE WHEN r.rn = 1 THEN (v_remaining + 1) / 2 ELSE v_remaining / 2 END,
    payment_frequency = 'quarterly'
  FROM ranked r WHERE enrollment_batches.id = r.id;
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RAISE NOTICE 'Y.Ashok (Keyboard): payment inserted, % enrollment_batch rows updated, remaining=%', v_updated_count, v_remaining;
  v_student_ids := array_append(v_student_ids, v_student_id);

  -- ---------------------------------------------------------------------------
  -- Yashwant K | Keyboard | Monthly | paid 2026-01-30 | 6 done → 2 remaining
  -- ---------------------------------------------------------------------------
  v_remaining := 2;
  SELECT id INTO v_student_id FROM students WHERE name ILIKE '%yashwant k%' AND is_active IS NOT FALSE LIMIT 1;
  IF v_student_id IS NULL THEN RAISE EXCEPTION 'Student "Yashwant K" not found'; END IF;
  SELECT id INTO v_enrollment_id FROM enrollments WHERE student_id = v_student_id LIMIT 1;

  INSERT INTO payments (student_id, package_id, amount, method, timestamp, metadata)
    VALUES (v_student_id, v_kb_monthly_pkg_id, v_kb_monthly_amt, 'cash',
            '2026-01-30 00:00:00+05:30',
            jsonb_build_object('instrument','Keyboard/Piano','period_start','2026-01-30',
                               'period_end','2026-03-02','classes_done',6,'backfill',true));

  WITH ranked AS (
    SELECT eb.id, ROW_NUMBER() OVER (ORDER BY eb.id) AS rn
    FROM enrollment_batches eb JOIN batches b ON b.id = eb.batch_id
    WHERE eb.enrollment_id = v_enrollment_id AND b.teacher_id = v_shiva_id AND b.instrument_id = v_kb_id
  )
  UPDATE enrollment_batches SET
    classes_remaining = CASE WHEN r.rn = 1 THEN (v_remaining + 1) / 2 ELSE v_remaining / 2 END,
    payment_frequency = 'monthly'
  FROM ranked r WHERE enrollment_batches.id = r.id;
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RAISE NOTICE 'Yashwant K (Keyboard): payment inserted, % enrollment_batch rows updated, remaining=%', v_updated_count, v_remaining;
  v_student_ids := array_append(v_student_ids, v_student_id);

  -- =========================================================================
  -- GUITAR STUDENTS (Shiva)
  -- =========================================================================

  -- ---------------------------------------------------------------------------
  -- Achintya | Guitar | Quarterly | paid 2026-02-20 | 2 done → 22 remaining
  -- ---------------------------------------------------------------------------
  v_remaining := 22;
  SELECT id INTO v_student_id FROM students WHERE name ILIKE '%achintya%' AND is_active IS NOT FALSE LIMIT 1;
  IF v_student_id IS NULL THEN RAISE EXCEPTION 'Student "Achintya" not found'; END IF;
  SELECT id INTO v_enrollment_id FROM enrollments WHERE student_id = v_student_id LIMIT 1;

  INSERT INTO payments (student_id, package_id, amount, method, timestamp, metadata)
    VALUES (v_student_id, v_gt_quarterly_pkg_id, v_gt_quarterly_amt, 'cash',
            '2026-02-20 00:00:00+05:30',
            jsonb_build_object('instrument','Guitar','period_start','2026-02-20',
                               'period_end','2026-05-20','classes_done',2,'backfill',true));

  WITH ranked AS (
    SELECT eb.id, ROW_NUMBER() OVER (ORDER BY eb.id) AS rn
    FROM enrollment_batches eb JOIN batches b ON b.id = eb.batch_id
    WHERE eb.enrollment_id = v_enrollment_id AND b.teacher_id = v_shiva_id AND b.instrument_id = v_gt_id
  )
  UPDATE enrollment_batches SET
    classes_remaining = CASE WHEN r.rn = 1 THEN (v_remaining + 1) / 2 ELSE v_remaining / 2 END,
    payment_frequency = 'quarterly'
  FROM ranked r WHERE enrollment_batches.id = r.id;
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RAISE NOTICE 'Achintya (Guitar): payment inserted, % enrollment_batch rows updated, remaining=%', v_updated_count, v_remaining;
  v_student_ids := array_append(v_student_ids, v_student_id);

  -- ---------------------------------------------------------------------------
  -- Amrik Shaw | Guitar | Quarterly | paid 2026-01-25 | 8 done → 16 remaining
  -- ---------------------------------------------------------------------------
  v_remaining := 16;
  SELECT id INTO v_student_id FROM students WHERE name ILIKE '%amrik%' AND is_active IS NOT FALSE LIMIT 1;
  IF v_student_id IS NULL THEN RAISE EXCEPTION 'Student "Amrik Shaw" not found'; END IF;
  SELECT id INTO v_enrollment_id FROM enrollments WHERE student_id = v_student_id LIMIT 1;

  INSERT INTO payments (student_id, package_id, amount, method, timestamp, metadata)
    VALUES (v_student_id, v_gt_quarterly_pkg_id, v_gt_quarterly_amt, 'cash',
            '2026-01-25 00:00:00+05:30',
            jsonb_build_object('instrument','Guitar','period_start','2026-01-25',
                               'period_end','2026-04-25','classes_done',8,'backfill',true));

  WITH ranked AS (
    SELECT eb.id, ROW_NUMBER() OVER (ORDER BY eb.id) AS rn
    FROM enrollment_batches eb JOIN batches b ON b.id = eb.batch_id
    WHERE eb.enrollment_id = v_enrollment_id AND b.teacher_id = v_shiva_id AND b.instrument_id = v_gt_id
  )
  UPDATE enrollment_batches SET
    classes_remaining = CASE WHEN r.rn = 1 THEN (v_remaining + 1) / 2 ELSE v_remaining / 2 END,
    payment_frequency = 'quarterly'
  FROM ranked r WHERE enrollment_batches.id = r.id;
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RAISE NOTICE 'Amrik Shaw (Guitar): payment inserted, % enrollment_batch rows updated, remaining=%', v_updated_count, v_remaining;
  v_student_ids := array_append(v_student_ids, v_student_id);

  -- ---------------------------------------------------------------------------
  -- Kadari Pavan | Guitar | Quarterly | paid 2025-11-21 | 22 done → 2 remaining
  -- (same student as Keyboard block above — different instrument batches)
  -- ---------------------------------------------------------------------------
  v_remaining := 2;
  SELECT id INTO v_student_id FROM students WHERE name ILIKE '%kadari%' AND is_active IS NOT FALSE LIMIT 1;
  IF v_student_id IS NULL THEN RAISE EXCEPTION 'Student "Kadari Pavan" not found (Guitar block)'; END IF;
  SELECT id INTO v_enrollment_id FROM enrollments WHERE student_id = v_student_id LIMIT 1;

  INSERT INTO payments (student_id, package_id, amount, method, timestamp, metadata)
    VALUES (v_student_id, v_gt_quarterly_pkg_id, v_gt_quarterly_amt, 'cash',
            '2025-11-21 00:00:00+05:30',
            jsonb_build_object('instrument','Guitar','period_start','2025-11-21',
                               'period_end','2026-02-21','classes_done',22,'backfill',true));

  WITH ranked AS (
    SELECT eb.id, ROW_NUMBER() OVER (ORDER BY eb.id) AS rn
    FROM enrollment_batches eb JOIN batches b ON b.id = eb.batch_id
    WHERE eb.enrollment_id = v_enrollment_id AND b.teacher_id = v_shiva_id AND b.instrument_id = v_gt_id
  )
  UPDATE enrollment_batches SET
    classes_remaining = CASE WHEN r.rn = 1 THEN (v_remaining + 1) / 2 ELSE v_remaining / 2 END,
    payment_frequency = 'quarterly'
  FROM ranked r WHERE enrollment_batches.id = r.id;
  GET DIAGNOSTICS v_updated_count = ROW_COUNT;
  RAISE NOTICE 'Kadari Pavan (Guitar): payment inserted, % enrollment_batch rows updated, remaining=%', v_updated_count, v_remaining;
  -- student_id already in v_student_ids from Keyboard block

  -- =========================================================================
  -- DRUMS STUDENT (Shiva — new batches created in Step 2)
  -- =========================================================================

  -- ---------------------------------------------------------------------------
  -- Siddhan Erumala | Drums | Quarterly | paid 2026-02-15 | 2 done → 22 remaining
  -- New enrollment_batches added to existing enrollment (student also has Keyboard/Piano)
  -- ---------------------------------------------------------------------------
  v_remaining := 22;
  SELECT id INTO v_student_id FROM students WHERE name ILIKE '%siddhan%' AND is_active IS NOT FALSE LIMIT 1;
  IF v_student_id IS NULL THEN RAISE EXCEPTION 'Student "Siddhan Erumala" not found'; END IF;
  SELECT id INTO v_enrollment_id FROM enrollments WHERE student_id = v_student_id LIMIT 1;

  INSERT INTO enrollment_batches (enrollment_id, batch_id, classes_remaining, payment_frequency, enrolled_on, assigned_on)
    VALUES (v_enrollment_id, v_dr_fri_batch_id, (v_remaining + 1) / 2, 'quarterly', '2026-02-15', '2026-02-15');
  INSERT INTO enrollment_batches (enrollment_id, batch_id, classes_remaining, payment_frequency, enrolled_on, assigned_on)
    VALUES (v_enrollment_id, v_dr_sun_batch_id, v_remaining / 2,       'quarterly', '2026-02-15', '2026-02-15');

  INSERT INTO payments (student_id, package_id, amount, method, timestamp, metadata)
    VALUES (v_student_id, v_dr_quarterly_pkg_id, v_dr_quarterly_amt, 'cash',
            '2026-02-15 00:00:00+05:30',
            jsonb_build_object('instrument','Drums','period_start','2026-02-15',
                               'period_end','2026-05-15','classes_done',2,'backfill',true));

  RAISE NOTICE 'Siddhan Erumala (Drums): 2 enrollment_batches added, payment inserted, remaining=%', v_remaining;
  v_student_ids := array_append(v_student_ids, v_student_id);

  -- =========================================================================
  -- STEP 3: Sync enrollments.classes_remaining = SUM of all enrollment_batches
  -- =========================================================================

  UPDATE enrollments e
  SET classes_remaining = (
    SELECT COALESCE(SUM(eb.classes_remaining), 0)
    FROM enrollment_batches eb
    WHERE eb.enrollment_id = e.id
  ),
  updated_at = now()
  WHERE e.student_id = ANY(v_student_ids);

  RAISE NOTICE '=== Backfill complete. % students processed. ===', array_length(v_student_ids, 1);
  RAISE NOTICE 'Skipped: Sujay (not in DB), Anirudha (not in DB)';
  RAISE NOTICE '';
  RAISE NOTICE 'Verify payments:   SELECT s.name, p.timestamp, p.metadata->>''instrument'', p.amount FROM payments p JOIN students s ON s.id=p.student_id WHERE p.metadata->>''backfill''=''true'' ORDER BY s.name;';
  RAISE NOTICE 'Verify batches:    SELECT s.name, i.name, b.recurrence, eb.classes_remaining, eb.payment_frequency FROM enrollment_batches eb JOIN enrollments e ON e.id=eb.enrollment_id JOIN students s ON s.id=e.student_id JOIN batches b ON b.id=eb.batch_id JOIN instruments i ON i.id=b.instrument_id WHERE s.id=ANY(ARRAY[%]::uuid[]) ORDER BY s.name,i.name;', v_student_ids;

END $$;
