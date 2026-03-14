-- Migration 014: Update payout_type ENUM
-- Change 'per_class' to 'per_student_monthly'

-- Step 1: Add the new value to the ENUM if it doesn't exist
ALTER TYPE payout_type ADD VALUE IF NOT EXISTS 'per_student_monthly';

-- Step 2: Update existing records to use the new value
UPDATE teachers SET payout_type = 'per_student_monthly' WHERE payout_type = 'per_class';

-- Step 3: Removing an enum value is not supported directly in standard PostgreSQL without recreating the type.
-- Since we are migrating an existing database, the safest approach for now is to change the default.
ALTER TABLE teachers ALTER COLUMN payout_type SET DEFAULT 'per_student_monthly';

