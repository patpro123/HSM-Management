-- Add deactivated_at column to track when a student was deactivated.
-- Using updated_at as a best-effort backfill for existing inactive students —
-- the stats query was already using updated_at for this purpose, so this is
-- no regression. Future deactivations will set this precisely.

ALTER TABLE students ADD COLUMN IF NOT EXISTS deactivated_at timestamptz;

-- Backfill: inactive students get their current updated_at as the deactivation timestamp
UPDATE students
SET deactivated_at = updated_at
WHERE is_active = false;
