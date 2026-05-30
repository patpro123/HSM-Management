-- Migration 044: Optional voice note on habit log rows
-- When a student checks off a habit that is the practice target for a pending homework,
-- they may optionally leave a short voice note (<= 30 sec) as evidence.

ALTER TABLE habit_logs
  ADD COLUMN IF NOT EXISTS voice_note_url         TEXT,
  ADD COLUMN IF NOT EXISTS voice_note_data        TEXT,
  ADD COLUMN IF NOT EXISTS voice_note_storage_id  UUID REFERENCES file_storage(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS voice_note_recorded_at TIMESTAMPTZ;
