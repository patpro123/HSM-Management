-- Migration 033: Fix duplicate enrollments per student
-- Root cause: students with multiple enrollment rows were returned as duplicate
-- rows by the /api/enrollments query (which joined all enrollments, not just one).
-- This migration merges duplicate enrollments, keeping the active one (or the
-- most recent if no active enrollment exists), and re-parents any enrollment_batches
-- from the dropped enrollments onto the keeper.

BEGIN;

-- Step 1: Re-parent enrollment_batches from duplicate enrollments to the keeper.
-- The keeper is: active enrollment with highest id, else any enrollment with highest id.
-- Only re-parent if the keeper does not already have the same batch_id.
UPDATE enrollment_batches eb
SET enrollment_id = keeper.id
FROM (
  SELECT DISTINCT ON (student_id)
    id,
    student_id
  FROM enrollments
  ORDER BY student_id,
           CASE WHEN status = 'active' THEN 0 ELSE 1 END,
           id DESC
) AS keeper
JOIN enrollments dup ON dup.student_id = keeper.student_id AND dup.id <> keeper.id
WHERE eb.enrollment_id = dup.id
  AND NOT EXISTS (
    SELECT 1 FROM enrollment_batches eb2
    WHERE eb2.enrollment_id = keeper.id
      AND eb2.batch_id = eb.batch_id
  );

-- Step 2: Delete enrollment_batches still attached to duplicate enrollments
-- (these are batches that already exist on the keeper, so they're truly redundant).
DELETE FROM enrollment_batches eb
USING (
  SELECT DISTINCT ON (student_id)
    id AS keeper_id,
    student_id
  FROM enrollments
  ORDER BY student_id,
           CASE WHEN status = 'active' THEN 0 ELSE 1 END,
           id DESC
) AS keeper
JOIN enrollments dup ON dup.student_id = keeper.student_id AND dup.id <> keeper.keeper_id
WHERE eb.enrollment_id = dup.id;

-- Step 3: Delete the duplicate enrollment rows themselves.
DELETE FROM enrollments
WHERE id IN (
  SELECT dup.id
  FROM enrollments dup
  WHERE EXISTS (
    SELECT 1
    FROM (
      SELECT DISTINCT ON (student_id)
        id AS keeper_id,
        student_id
      FROM enrollments
      ORDER BY student_id,
               CASE WHEN status = 'active' THEN 0 ELSE 1 END,
               id DESC
    ) keeper
    WHERE keeper.student_id = dup.student_id
      AND keeper.keeper_id <> dup.id
  )
);

COMMIT;
