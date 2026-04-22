-- Add location to packages to distinguish HSM vs PBEL packages
-- NULL = applies to all locations (backwards compatible)
ALTER TABLE packages ADD COLUMN IF NOT EXISTS location text;
