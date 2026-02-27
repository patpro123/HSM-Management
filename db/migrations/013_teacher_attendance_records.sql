-- Migration 013: Teacher Attendance Records
-- Explicit per-batch attendance marking for teachers (admin-recorded).
-- Separate from student attendance_records — tracks whether teacher conducted the session.

CREATE TABLE IF NOT EXISTS teacher_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  batch_id uuid NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  session_date date NOT NULL,
  status text NOT NULL DEFAULT 'conducted'
    CHECK (status IN ('conducted', 'not_conducted')),
  notes text,
  marked_by uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  CONSTRAINT unique_teacher_batch_date UNIQUE (batch_id, session_date)
);

CREATE INDEX IF NOT EXISTS idx_teacher_attendance_teacher_date
  ON teacher_attendance (teacher_id, session_date);

CREATE INDEX IF NOT EXISTS idx_teacher_attendance_date
  ON teacher_attendance (session_date);
