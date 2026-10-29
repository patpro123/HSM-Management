-- Migration: 061_add_head_of_school_role
-- Description: Adds the head_of_school role (operations and curriculum, no finance).
-- Note: ADD VALUE cannot be used in the same transaction that adds it, so run this file
--       on its own before any statement that grants the new role.

ALTER TYPE user_role_type ADD VALUE IF NOT EXISTS 'head_of_school';

COMMENT ON COLUMN user_roles.role IS 'Role type: admin, head_of_school, teacher, parent, or student';
