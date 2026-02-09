-- Add metadata column to teachers table to store email and other details
ALTER TABLE teachers ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;