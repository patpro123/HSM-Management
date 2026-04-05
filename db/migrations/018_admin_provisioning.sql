-- Migration 016: Allow admin users to be provisioned without a linked entity
-- Admins don't have a student/teacher profile, so entity_id is now nullable
-- and entity_type/role constraints are expanded to include 'admin'.

ALTER TABLE provisioned_users
  DROP CONSTRAINT provisioned_users_entity_type_check,
  ADD CONSTRAINT provisioned_users_entity_type_check
    CHECK (entity_type IN ('student', 'teacher', 'admin')),
  ALTER COLUMN entity_id DROP NOT NULL,
  DROP CONSTRAINT provisioned_users_role_check,
  ADD CONSTRAINT provisioned_users_role_check
    CHECK (role IN ('student', 'teacher', 'admin'));
