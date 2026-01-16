-- Migration: Add payment_frequency and classes_remaining to enrollment_batches
-- Date: 2026-01-16

-- Add payment_frequency as ENUM
DO $$ BEGIN
    CREATE TYPE payment_frequency AS ENUM ('monthly', 'quarterly');
EXCEPTION
    WHEN duplicate_object THEN null;
END$$;

-- Add columns to enrollment_batches table
ALTER TABLE enrollment_batches 
ADD COLUMN IF NOT EXISTS payment_frequency payment_frequency DEFAULT 'monthly',
ADD COLUMN IF NOT EXISTS classes_remaining integer DEFAULT 0 CHECK (classes_remaining >= 0);

-- Comment
COMMENT ON COLUMN enrollment_batches.payment_frequency IS 'Payment frequency: monthly (8 classes) or quarterly (24 classes)';
COMMENT ON COLUMN enrollment_batches.classes_remaining IS 'Classes remaining for this specific batch assignment';

-- End of migration
