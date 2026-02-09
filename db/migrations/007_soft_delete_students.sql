-- Add is_active flag to students table for soft delete
ALTER TABLE students ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;