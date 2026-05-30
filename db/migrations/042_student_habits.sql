-- Migration 042: Student music habit tracker
-- habits: one row per practice habit per student (max 10 active)
-- habit_logs: one row per habit per day the student checked it off

CREATE TABLE IF NOT EXISTS habits (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id    UUID        NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  title         TEXT        NOT NULL,
  icon          TEXT        NOT NULL DEFAULT '🎵',
  display_order INT         NOT NULL DEFAULT 0,
  metadata      JSONB       NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  archived_at   TIMESTAMPTZ
);

-- Backfill: add metadata column if table was already created without it
ALTER TABLE habits ADD COLUMN IF NOT EXISTS metadata JSONB NOT NULL DEFAULT '{}';

CREATE TABLE IF NOT EXISTS habit_logs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  habit_id    UUID        NOT NULL REFERENCES habits(id) ON DELETE CASCADE,
  logged_date DATE        NOT NULL,
  logged_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (habit_id, logged_date)
);

CREATE INDEX IF NOT EXISTS idx_habits_student  ON habits     (student_id) WHERE archived_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_habit_logs_date ON habit_logs (habit_id, logged_date);
