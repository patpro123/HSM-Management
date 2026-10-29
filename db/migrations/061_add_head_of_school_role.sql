-- Migration: 061_add_head_of_school_role
-- Description: Adds the head_of_school role (operations and curriculum, no finance).
-- Note: ADD VALUE cannot be used in the same transaction that adds it, so run this file
--       on its own before any statement that grants the new role.

ALTER TYPE user_role_type ADD VALUE IF NOT EXISTS 'head_of_school';

COMMENT ON COLUMN user_roles.role IS 'Role type: admin, head_of_school, teacher, parent, or student';

-- Admins provision users by email before their first login; allow the new role there.
ALTER TABLE provisioned_users
  DROP CONSTRAINT IF EXISTS provisioned_users_entity_type_check,
  ADD CONSTRAINT provisioned_users_entity_type_check
    CHECK (entity_type IN ('student', 'teacher', 'admin', 'head_of_school')),
  DROP CONSTRAINT IF EXISTS provisioned_users_role_check,
  ADD CONSTRAINT provisioned_users_role_check
    CHECK (role IN ('student', 'teacher', 'admin', 'head_of_school'));

-- Chat sessions record the persona; without this the first Head of School message fails.
ALTER TABLE chat_sessions
  DROP CONSTRAINT IF EXISTS chat_sessions_role_check,
  ADD CONSTRAINT chat_sessions_role_check
    CHECK (role IN ('admin', 'head_of_school', 'teacher', 'student', 'parent'));
