-- Migration 039: Generic Google Drive file storage tracking
-- Centralises all Drive-backed files in one audit table.
-- Old base64 columns are preserved (made nullable) for backward compatibility.

CREATE TABLE IF NOT EXISTS file_storage (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  drive_file_id   TEXT        NOT NULL,
  public_url      TEXT        NOT NULL,
  category        TEXT        NOT NULL,   -- homework_audio | student_document | profile_image
                                          -- | trinity_recording | marketing
  entity_type     TEXT        NOT NULL,   -- homework_submission | student_document | student | evaluation
  entity_id       UUID,                   -- FK-like reference to the owning entity
  file_name       TEXT        NOT NULL,
  mime_type       TEXT        NOT NULL,
  file_size_bytes BIGINT,
  uploaded_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at      TIMESTAMPTZ,            -- NULL = never expires
  deleted_at      TIMESTAMPTZ             -- NULL = still live on Drive
);

CREATE INDEX IF NOT EXISTS idx_file_storage_entity
  ON file_storage (entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_file_storage_cleanup
  ON file_storage (expires_at)
  WHERE deleted_at IS NULL AND expires_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_file_storage_drive_id
  ON file_storage (drive_file_id);

-- homework_submissions: add Drive columns; keep file_data nullable for old rows
ALTER TABLE homework_submissions
  ADD COLUMN IF NOT EXISTS file_url        TEXT,
  ADD COLUMN IF NOT EXISTS file_storage_id UUID REFERENCES file_storage(id) ON DELETE SET NULL;

-- student_documents: make file_data nullable for new Drive-backed rows
ALTER TABLE student_documents
  ALTER COLUMN file_data DROP NOT NULL;
ALTER TABLE student_documents
  ADD COLUMN IF NOT EXISTS file_url        TEXT,
  ADD COLUMN IF NOT EXISTS file_storage_id UUID REFERENCES file_storage(id) ON DELETE SET NULL;

-- students: dedicated URL columns alongside existing metadata JSONB
ALTER TABLE students
  ADD COLUMN IF NOT EXISTS profile_image_url  TEXT,
  ADD COLUMN IF NOT EXISTS profile_storage_id UUID REFERENCES file_storage(id) ON DELETE SET NULL;
