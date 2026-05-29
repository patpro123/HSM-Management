-- Migration 036: student homework audio submissions
CREATE TABLE IF NOT EXISTS student_homework (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id     UUID        NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  title          TEXT        NOT NULL,
  note           TEXT,
  file_name      TEXT,
  file_type      TEXT,
  file_data      TEXT,
  uploaded_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  uploaded_by_role TEXT      NOT NULL DEFAULT 'student'
);

CREATE INDEX IF NOT EXISTS idx_student_homework_student_id
  ON student_homework(student_id);
