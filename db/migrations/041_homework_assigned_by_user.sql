-- Store the user_id of whoever assigned the homework so we can target notifications.
ALTER TABLE homework_assignments
  ADD COLUMN IF NOT EXISTS assigned_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
