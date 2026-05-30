-- Migration 045: Theory task fields on homework assignments + submissions
-- Teachers can attach a theory prompt (text + optional scanned sheet) to any assignment.
-- Students answer with text + optional scanned upload.

ALTER TABLE homework_assignments
  ADD COLUMN IF NOT EXISTS theory_prompt_text       TEXT,
  ADD COLUMN IF NOT EXISTS theory_prompt_storage_id UUID REFERENCES file_storage(id) ON DELETE SET NULL;

ALTER TABLE homework_submissions
  ADD COLUMN IF NOT EXISTS theory_answer_text       TEXT,
  ADD COLUMN IF NOT EXISTS theory_answer_storage_id UUID REFERENCES file_storage(id) ON DELETE SET NULL;
