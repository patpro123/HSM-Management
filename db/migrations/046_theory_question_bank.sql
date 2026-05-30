-- Migration 046: Theory question bank + theory answer fields on habit_logs
-- theory_questions: instrument/level-scoped questions managed by teachers.
-- habit_logs: student answers a daily question when checking off a theory-type habit.

CREATE TABLE IF NOT EXISTS theory_questions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument       TEXT,                           -- NULL = all instruments
  level            TEXT        NOT NULL DEFAULT 'beginner',  -- beginner/intermediate/advanced
  question         TEXT        NOT NULL,
  answer_hint      TEXT,
  sheet_storage_id UUID        REFERENCES file_storage(id) ON DELETE SET NULL,
  created_by       UUID        REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at      TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_theory_questions_active
  ON theory_questions (instrument, level)
  WHERE archived_at IS NULL;

ALTER TABLE habit_logs
  ADD COLUMN IF NOT EXISTS theory_question_id       UUID REFERENCES theory_questions(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS theory_answer_text        TEXT,
  ADD COLUMN IF NOT EXISTS theory_answer_storage_id  UUID REFERENCES file_storage(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS theory_answer_correct     BOOLEAN;
