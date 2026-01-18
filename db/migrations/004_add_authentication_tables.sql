-- Migration 004: Add Authentication & Authorization Tables
-- Phase 2: Google OAuth Integration with Role-Based Access Control (RBAC)
-- Date: 2026-01-18
-- Description: Creates tables for user authentication, role management, and linking users to teachers/students

-- ==================== ENUMS ====================

-- Login methods supported
DO $$ BEGIN
    CREATE TYPE login_method AS ENUM ('google_oauth');
EXCEPTION
    WHEN duplicate_object THEN null;
END$$;

-- User roles for RBAC
DO $$ BEGIN
    CREATE TYPE user_role_type AS ENUM ('admin', 'teacher', 'parent', 'student');
EXCEPTION
    WHEN duplicate_object THEN null;
END$$;

-- Guardian relationship types
DO $$ BEGIN
    CREATE TYPE guardian_relationship AS ENUM ('parent', 'guardian', 'self');
EXCEPTION
    WHEN duplicate_object THEN null;
END$$;

-- ==================== CORE AUTHENTICATION TABLE ====================

-- Users table: Core authentication entity for all logged-in users
CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    google_id text NOT NULL UNIQUE,
    email text NOT NULL UNIQUE,
    name text NOT NULL,
    profile_picture text,
    email_verified boolean DEFAULT false,
    locale text DEFAULT 'en',
    last_login timestamptz,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    
    CONSTRAINT email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_active ON users(is_active) WHERE is_active = true;

COMMENT ON TABLE users IS 'Core user authentication table storing Google OAuth profile data';
COMMENT ON COLUMN users.google_id IS 'Google unique identifier (sub claim from JWT)';
COMMENT ON COLUMN users.email IS 'User email address from Google profile';
COMMENT ON COLUMN users.email_verified IS 'Whether email is verified by Google';
COMMENT ON COLUMN users.is_active IS 'Soft delete flag - false means user is deactivated';
COMMENT ON COLUMN users.last_login IS 'Timestamp of most recent successful login';

-- ==================== ROLE MANAGEMENT ====================

-- User Roles table: Multi-role support (one user can have multiple roles)
CREATE TABLE IF NOT EXISTS user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role user_role_type NOT NULL,
    granted_at timestamptz DEFAULT now(),
    granted_by uuid REFERENCES users(id) ON DELETE SET NULL,
    revoked_at timestamptz,
    
    CONSTRAINT unique_user_role UNIQUE(user_id, role),
    CONSTRAINT no_revoke_before_grant CHECK (revoked_at IS NULL OR revoked_at >= granted_at)
);

CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON user_roles(role);
CREATE INDEX IF NOT EXISTS idx_user_roles_active ON user_roles(user_id, role) WHERE revoked_at IS NULL;

COMMENT ON TABLE user_roles IS 'Role assignments for users - supports multiple roles per user';
COMMENT ON COLUMN user_roles.role IS 'Role type: admin, teacher, parent, or student';
COMMENT ON COLUMN user_roles.granted_by IS 'User ID of admin who granted this role (NULL for auto-assigned)';
COMMENT ON COLUMN user_roles.revoked_at IS 'Timestamp when role was revoked (NULL means active)';

-- ==================== ENTITY LINKING TABLES ====================

-- Teacher-User linking table (1:1 relationship)
CREATE TABLE IF NOT EXISTS teacher_users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    linked_at timestamptz DEFAULT now(),
    linked_by uuid REFERENCES users(id) ON DELETE SET NULL,
    is_active boolean DEFAULT true,
    
    CONSTRAINT unique_teacher_user UNIQUE(teacher_id, user_id),
    CONSTRAINT unique_teacher UNIQUE(teacher_id),
    CONSTRAINT unique_user_teacher UNIQUE(user_id)
);

CREATE INDEX IF NOT EXISTS idx_teacher_users_teacher_id ON teacher_users(teacher_id);
CREATE INDEX IF NOT EXISTS idx_teacher_users_user_id ON teacher_users(user_id);
CREATE INDEX IF NOT EXISTS idx_teacher_users_active ON teacher_users(teacher_id, user_id) WHERE is_active = true;

COMMENT ON TABLE teacher_users IS 'Links teacher records to user accounts (1:1 relationship)';
COMMENT ON COLUMN teacher_users.teacher_id IS 'Reference to teachers table';
COMMENT ON COLUMN teacher_users.user_id IS 'Reference to users table - one teacher = one user account';
COMMENT ON COLUMN teacher_users.linked_by IS 'Admin user who created this link';

-- Student-Guardian linking table (N:M relationship)
CREATE TABLE IF NOT EXISTS student_guardians (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    relationship guardian_relationship NOT NULL DEFAULT 'parent',
    is_primary boolean DEFAULT false,
    linked_at timestamptz DEFAULT now(),
    linked_by uuid REFERENCES users(id) ON DELETE SET NULL,
    is_active boolean DEFAULT true,
    
    CONSTRAINT unique_student_guardian UNIQUE(student_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_student_guardians_student_id ON student_guardians(student_id);
CREATE INDEX IF NOT EXISTS idx_student_guardians_user_id ON student_guardians(user_id);
CREATE INDEX IF NOT EXISTS idx_student_guardians_active ON student_guardians(student_id, user_id) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_student_guardians_primary ON student_guardians(student_id, is_primary) WHERE is_primary = true;

COMMENT ON TABLE student_guardians IS 'Links students to guardian user accounts (N:M relationship)';
COMMENT ON COLUMN student_guardians.relationship IS 'Type of relationship: parent, guardian, or self';
COMMENT ON COLUMN student_guardians.is_primary IS 'Primary contact guardian for this student';
COMMENT ON COLUMN student_guardians.linked_by IS 'Admin user who created this link';

-- ==================== SESSION MANAGEMENT ====================

-- Refresh Tokens table: Long-lived tokens for JWT renewal
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token text NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL,
    created_at timestamptz DEFAULT now(),
    revoked_at timestamptz,
    revoked_reason text,
    
    CONSTRAINT valid_expiry CHECK (expires_at > created_at),
    CONSTRAINT revoke_before_expiry CHECK (revoked_at IS NULL OR revoked_at <= expires_at)
);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_token ON refresh_tokens(token);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_id ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_active ON refresh_tokens(user_id, expires_at) 
    WHERE revoked_at IS NULL;

COMMENT ON TABLE refresh_tokens IS 'Refresh tokens for JWT renewal - allows revocation';
COMMENT ON COLUMN refresh_tokens.token IS 'Unique refresh token (UUID)';
COMMENT ON COLUMN refresh_tokens.expires_at IS 'Token expiration timestamp (typically 30 days)';
COMMENT ON COLUMN refresh_tokens.revoked_at IS 'When token was revoked (for security or logout)';
COMMENT ON COLUMN refresh_tokens.revoked_reason IS 'Reason for revocation: logout, security, expired';

-- ==================== AUDIT & SECURITY ====================

-- Login History table: Security audit trail
CREATE TABLE IF NOT EXISTS login_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    login_timestamp timestamptz DEFAULT now(),
    ip_address text,
    user_agent text,
    login_method login_method NOT NULL DEFAULT 'google_oauth',
    success boolean NOT NULL,
    failure_reason text,
    
    CONSTRAINT failure_requires_reason CHECK (
        (success = true AND failure_reason IS NULL) OR 
        (success = false AND failure_reason IS NOT NULL)
    )
);

CREATE INDEX IF NOT EXISTS idx_login_history_user_id ON login_history(user_id);
CREATE INDEX IF NOT EXISTS idx_login_history_timestamp ON login_history(login_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_login_history_user_time ON login_history(user_id, login_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_login_history_failed ON login_history(user_id, login_timestamp DESC) 
    WHERE success = false;

COMMENT ON TABLE login_history IS 'Audit trail of all login attempts (successful and failed)';
COMMENT ON COLUMN login_history.success IS 'Whether login attempt succeeded';
COMMENT ON COLUMN login_history.failure_reason IS 'Reason for failure: invalid_token, account_disabled, etc.';

-- ==================== AUDIT LOG ENHANCEMENTS ====================

-- Update audit_logs to support user authentication events
-- Add new action types for auth events
COMMENT ON TABLE audit_logs IS 'Audit trail for all sensitive operations including authentication events';
COMMENT ON COLUMN audit_logs.actor_id IS 'User ID who performed action (NULL for system actions)';
COMMENT ON COLUMN audit_logs.action IS 'Action performed: login, logout, grant_role, link_teacher, etc.';

-- ==================== DEFAULT DATA ====================

-- Create default admin user (will be linked to first Google login by super admin)
-- This is a placeholder - actual admin users created via Google OAuth
COMMENT ON TABLE users IS 'Core authentication table - first user to register should be promoted to admin manually';

-- ==================== UTILITY FUNCTIONS ====================

-- Function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Trigger for users table
DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Function to check if user has specific role (for use in queries)
CREATE OR REPLACE FUNCTION user_has_role(p_user_id uuid, p_role user_role_type)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM user_roles 
        WHERE user_id = p_user_id 
        AND role = p_role 
        AND revoked_at IS NULL
    );
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION user_has_role IS 'Check if user has specific active role';

-- Function to get all active roles for a user
CREATE OR REPLACE FUNCTION get_user_roles(p_user_id uuid)
RETURNS text[] AS $$
BEGIN
    RETURN ARRAY(
        SELECT role::text 
        FROM user_roles 
        WHERE user_id = p_user_id 
        AND revoked_at IS NULL
        ORDER BY role
    );
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_user_roles IS 'Get array of all active roles for a user';

-- Function to get teacher_id from user_id
CREATE OR REPLACE FUNCTION get_teacher_id_from_user(p_user_id uuid)
RETURNS uuid AS $$
BEGIN
    RETURN (
        SELECT teacher_id 
        FROM teacher_users 
        WHERE user_id = p_user_id 
        AND is_active = true
        LIMIT 1
    );
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_teacher_id_from_user IS 'Get teacher_id for a user account';

-- Function to get student_ids for a guardian user
CREATE OR REPLACE FUNCTION get_student_ids_for_guardian(p_user_id uuid)
RETURNS uuid[] AS $$
BEGIN
    RETURN ARRAY(
        SELECT student_id 
        FROM student_guardians 
        WHERE user_id = p_user_id 
        AND is_active = true
    );
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_student_ids_for_guardian IS 'Get all student_ids for a guardian/parent user';

-- ==================== SECURITY POLICIES ====================

-- Note: Row Level Security (RLS) can be enabled in future for additional security
-- For now, authorization is handled at application level in Express middleware

-- ==================== MIGRATION VERIFICATION ====================

-- Verify all tables exist
DO $$
DECLARE
    table_count integer;
BEGIN
    SELECT COUNT(*) INTO table_count
    FROM information_schema.tables
    WHERE table_schema = 'public'
    AND table_name IN (
        'users', 'user_roles', 'teacher_users', 
        'student_guardians', 'refresh_tokens', 'login_history'
    );
    
    IF table_count = 6 THEN
        RAISE NOTICE 'Migration 004 completed successfully: All 6 authentication tables created';
    ELSE
        RAISE EXCEPTION 'Migration 004 failed: Expected 6 tables, found %', table_count;
    END IF;
END $$;

-- Display summary
SELECT 
    'Migration 004: Authentication Tables' as migration_name,
    COUNT(*) as tables_created
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
    'users', 'user_roles', 'teacher_users', 
    'student_guardians', 'refresh_tokens', 'login_history'
);

-- Display table sizes (should be 0 initially)
SELECT 
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN (
    'users', 'user_roles', 'teacher_users', 
    'student_guardians', 'refresh_tokens', 'login_history'
)
ORDER BY tablename;
