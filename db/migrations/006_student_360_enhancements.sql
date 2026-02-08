-- Migration: Enhance schema for Student 360 View
-- 1. Promote email to a top-level column for efficient lookup
ALTER TABLE students ADD COLUMN IF NOT EXISTS email text;
CREATE UNIQUE INDEX IF NOT EXISTS idx_students_email ON students(email);

-- Backfill email from metadata for existing records
UPDATE students SET email = metadata->>'email' WHERE email IS NULL;

-- 2. Create student_evaluations table (supports Reviews, Certificates, Homework)
CREATE TABLE IF NOT EXISTS student_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
    evaluation_date date DEFAULT CURRENT_DATE,
    feedback text,
    rating integer,
    attachment_url text,
    type text DEFAULT 'review', -- values: review, certificate, homework
    title text,
    created_at timestamptz DEFAULT now()
);