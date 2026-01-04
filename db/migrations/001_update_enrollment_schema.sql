-- Migration: Update enrollments table to support student-level enrollment (not per instrument)
-- Date: 2026-01-04

-- Make instrument_id nullable in enrollments table since enrollment is now per student
ALTER TABLE enrollments ALTER COLUMN instrument_id DROP NOT NULL;

-- Add comment to clarify the model
COMMENT ON TABLE enrollments IS 'One enrollment per student. Batches (which are instrument+teacher specific) are linked via enrollment_batches table.';
COMMENT ON COLUMN enrollments.instrument_id IS 'Deprecated - kept for backward compatibility. Use enrollment_batches to link student to specific instrument batches.';
COMMENT ON COLUMN enrollments.classes_remaining IS 'Total classes remaining across all instruments for this student.';

-- End of migration
