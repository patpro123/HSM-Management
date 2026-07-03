-- 015_attendance_dashboard_makeup.sql
-- Adds makeup material support to homework assignments and a table for multi-file attachments.

ALTER TABLE homework_assignments
  ADD COLUMN IF NOT EXISTS batch_id     UUID REFERENCES batches(id),
  ADD COLUMN IF NOT EXISTS session_date DATE,
  ADD COLUMN IF NOT EXISTS is_makeup    BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS homework_attachments (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id   UUID        NOT NULL REFERENCES homework_assignments(id) ON DELETE CASCADE,
  file_storage_id UUID        REFERENCES file_storage(id),
  label           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_homework_assignments_is_makeup
  ON homework_assignments (is_makeup) WHERE is_makeup = TRUE;

CREATE INDEX IF NOT EXISTS idx_homework_attachments_assignment
  ON homework_attachments (assignment_id);
