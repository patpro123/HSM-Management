-- 057_teaching_materials.sql
-- Shared teaching material library: teachers/admins pre-record or upload material
-- (audio/video/image/PDF) tagged by instrument, reusable across many homework/makeup
-- assignments instead of re-uploading the same file per student.

CREATE TABLE IF NOT EXISTS teaching_materials (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title               TEXT        NOT NULL,
  description         TEXT,
  instrument_id       UUID        NOT NULL REFERENCES instruments(id) ON DELETE RESTRICT,
  material_type       TEXT        NOT NULL CHECK (material_type IN ('audio', 'video', 'image', 'document')),
  file_storage_id     UUID        NOT NULL REFERENCES file_storage(id) ON DELETE RESTRICT,
  created_by_user_id  UUID        REFERENCES users(id) ON DELETE SET NULL,
  is_active           BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_teaching_materials_instrument
  ON teaching_materials (instrument_id) WHERE is_active;
CREATE INDEX IF NOT EXISTS idx_teaching_materials_type
  ON teaching_materials (material_type);
CREATE INDEX IF NOT EXISTS idx_teaching_materials_title
  ON teaching_materials (LOWER(title));

-- Traces a homework attachment back to the library item it was picked from
-- (NULL for direct uploads that never went through the library).
ALTER TABLE homework_attachments
  ADD COLUMN IF NOT EXISTS source_material_id UUID REFERENCES teaching_materials(id) ON DELETE SET NULL;
