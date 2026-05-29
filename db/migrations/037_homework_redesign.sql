-- Migration 037: Proper homework assignment + submission workflow
-- Replaces the simple student_homework table from migration 036.

DROP TABLE IF EXISTS student_homework;

-- homework_assignments: teacher/admin assigns homework to a specific student
CREATE TABLE IF NOT EXISTS homework_assignments (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id     UUID        NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  title          TEXT        NOT NULL,
  instructions   TEXT,
  due_date       DATE,
  assigned_by    TEXT        NOT NULL DEFAULT 'teacher',  -- 'teacher' | 'admin'
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  status         TEXT        NOT NULL DEFAULT 'pending'   -- 'pending' | 'submitted' | 'reviewed'
);

-- homework_submissions: student's audio response to an assignment
CREATE TABLE IF NOT EXISTS homework_submissions (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id  UUID        NOT NULL REFERENCES homework_assignments(id) ON DELETE CASCADE,
  student_id     UUID        NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  file_name      TEXT,
  file_type      TEXT,
  file_data      TEXT,        -- base64 audio (webm/mp3/wav)
  note           TEXT,        -- student's note to teacher
  submitted_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_homework_assignments_student ON homework_assignments(student_id);
CREATE INDEX IF NOT EXISTS idx_homework_submissions_assignment ON homework_submissions(assignment_id);
