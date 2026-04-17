-- db/migrations/027_create_chat_sessions.sql

CREATE TABLE IF NOT EXISTS chat_sessions (
  session_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role         TEXT NOT NULL CHECK (role IN ('admin', 'teacher', 'student', 'parent')),
  messages     JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at   TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days')
);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_id
  ON chat_sessions (user_id);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_expires_at
  ON chat_sessions (expires_at);

CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_session
  ON chat_sessions (user_id, session_id);

CREATE OR REPLACE FUNCTION update_chat_sessions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_chat_sessions_updated_at ON chat_sessions;
CREATE TRIGGER trg_chat_sessions_updated_at
  BEFORE UPDATE ON chat_sessions
  FOR EACH ROW EXECUTE FUNCTION update_chat_sessions_updated_at();

CREATE TABLE IF NOT EXISTS chat_rate_limits (
  user_id UUID  NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date    DATE  NOT NULL,
  count   INT   NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, date)
);
