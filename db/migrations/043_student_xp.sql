-- Migration 043: XP gamification system
-- xp_events: audit log of every XP award (source of truth)
-- students.total_xp: denormalized total for fast leaderboard reads
-- homework_assignments: habit target fields for teacher-set practice goals

CREATE TABLE IF NOT EXISTS xp_events (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID        NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  event_type TEXT        NOT NULL,
  points     INT         NOT NULL,
  ref_id     UUID,
  metadata   JSONB       NOT NULL DEFAULT '{}',
  awarded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_xp_events_student ON xp_events (student_id, awarded_at DESC);
CREATE INDEX IF NOT EXISTS idx_xp_events_ref     ON xp_events (ref_id) WHERE ref_id IS NOT NULL;

ALTER TABLE students ADD COLUMN IF NOT EXISTS total_xp INT NOT NULL DEFAULT 0;

ALTER TABLE homework_assignments
  ADD COLUMN IF NOT EXISTS habit_target_habit_id UUID REFERENCES habits(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS habit_target_count     INT;
