-- Migration 015: Add provisioned_users table for user access control
-- An admin must provision a student or teacher by email before they can log in.
-- Existing users with roles are unaffected (grandfathered in).

CREATE TABLE provisioned_users (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email          TEXT UNIQUE NOT NULL,
  entity_type    TEXT NOT NULL CHECK (entity_type IN ('student', 'teacher')),
  entity_id      UUID NOT NULL,
  role           TEXT NOT NULL CHECK (role IN ('student', 'teacher')),
  provisioned_by UUID REFERENCES users(id),
  provisioned_at TIMESTAMPTZ DEFAULT NOW(),
  used_at        TIMESTAMPTZ  -- populated on the user's first successful login
);
