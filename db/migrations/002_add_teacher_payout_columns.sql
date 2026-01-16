-- Migration: Add payout_type and rate columns to teachers table
-- Date: 2026-01-16

-- Add payout_type as ENUM
DO $$ BEGIN
    CREATE TYPE payout_type AS ENUM ('fixed', 'per_class');
EXCEPTION
    WHEN duplicate_object THEN null;
END$$;

-- Add columns to teachers table
ALTER TABLE teachers 
ADD COLUMN IF NOT EXISTS payout_type payout_type DEFAULT 'per_class',
ADD COLUMN IF NOT EXISTS rate numeric(10,2) DEFAULT 0 CHECK (rate >= 0);

-- Comment
COMMENT ON COLUMN teachers.payout_type IS 'Type of payout: fixed (monthly salary) or per_class (per session)';
COMMENT ON COLUMN teachers.rate IS 'Rate amount: monthly salary for fixed, per-class amount for per_class';

-- End of migration
