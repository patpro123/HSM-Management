-- Migration 015: Add prospect_notes table for communications log
-- Each note records a contact attempt or update on a prospect

CREATE TABLE IF NOT EXISTS prospect_notes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  prospect_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  note        TEXT NOT NULL,
  created_by  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_prospect_notes_prospect_id ON prospect_notes(prospect_id);
