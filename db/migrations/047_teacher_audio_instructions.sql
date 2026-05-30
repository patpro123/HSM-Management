-- Teacher audio instructions: teachers can record/upload audio and send to multiple students.
-- These appear on the student's Homework tab as playable audio cards.

CREATE TABLE IF NOT EXISTS teacher_audio_instructions (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title              TEXT NOT NULL,
  audio_storage_id   UUID REFERENCES file_storage(id) ON DELETE SET NULL,
  audio_url          TEXT,
  audio_data         TEXT,
  mime_type          TEXT NOT NULL DEFAULT 'audio/webm',
  created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS teacher_audio_instruction_students (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  instruction_id UUID NOT NULL REFERENCES teacher_audio_instructions(id) ON DELETE CASCADE,
  student_id     UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (instruction_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_tais_instruction ON teacher_audio_instruction_students(instruction_id);
CREATE INDEX IF NOT EXISTS idx_tais_student     ON teacher_audio_instruction_students(student_id);
CREATE INDEX IF NOT EXISTS idx_tai_created_at   ON teacher_audio_instructions(created_at DESC);
