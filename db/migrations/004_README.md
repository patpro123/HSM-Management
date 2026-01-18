# Migration 004: Authentication & Authorization Tables

## Overview
This migration adds support for Google OAuth authentication and role-based access control (RBAC) to the HSM Management System.

## What's Added

### New Tables (6)
1. **`users`** - Core authentication table
   - Stores Google OAuth profile data
   - Primary identity for all authenticated users
   
2. **`user_roles`** - Multi-role support
   - Links users to roles (admin, teacher, parent, student)
   - Supports role granting/revocation with audit trail
   
3. **`teacher_users`** - Teacher account linking (1:1)
   - Links teacher records to user accounts
   - One teacher = one user account
   
4. **`student_guardians`** - Parent/guardian linking (N:M)
   - Links students to guardian user accounts
   - One student can have multiple guardians
   - One user can be guardian of multiple students
   
5. **`refresh_tokens`** - Session management
   - Long-lived tokens for JWT renewal
   - Supports revocation for security
   
6. **`login_history`** - Security audit trail
   - Tracks all login attempts (success/failure)
   - IP address and user agent logging

### New Enums (3)
- `login_method`: google_oauth
- `user_role_type`: admin, teacher, parent, student
- `guardian_relationship`: parent, guardian, self

### Utility Functions (4)
- `user_has_role(user_id, role)` - Check if user has specific role
- `get_user_roles(user_id)` - Get all active roles for user
- `get_teacher_id_from_user(user_id)` - Get teacher_id from user_id
- `get_student_ids_for_guardian(user_id)` - Get student_ids for parent

## How to Apply

### Option 1: Using psql (Recommended)
```bash
# Connect to your database
psql -U your_username -d hsm_management -f db/migrations/004_add_authentication_tables.sql
```

### Option 2: Using Docker Compose
```bash
# If using local Docker PostgreSQL
docker exec -i hsm_postgres psql -U postgres -d hsm_management < db/migrations/004_add_authentication_tables.sql
```

### Option 3: Using Neon (Production)
```bash
# Export your Neon connection string
export DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"

# Apply migration
psql $DATABASE_URL -f db/migrations/004_add_authentication_tables.sql
```

### Option 4: Using Node.js
```javascript
const { Client } = require('pg');
const fs = require('fs');

async function applyMigration() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  
  await client.connect();
  const sql = fs.readFileSync('./db/migrations/004_add_authentication_tables.sql', 'utf8');
  await client.query(sql);
  await client.end();
  
  console.log('Migration 004 applied successfully!');
}

applyMigration().catch(console.error);
```

## Verification

After applying the migration, verify it succeeded:

```sql
-- Check that all 6 tables were created
SELECT tablename 
FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN (
  'users', 'user_roles', 'teacher_users',
  'student_guardians', 'refresh_tokens', 'login_history'
)
ORDER BY tablename;

-- Expected output: 6 rows

-- Check indexes were created
SELECT tablename, indexname 
FROM pg_indexes 
WHERE schemaname = 'public' 
AND tablename IN (
  'users', 'user_roles', 'teacher_users',
  'student_guardians', 'refresh_tokens', 'login_history'
)
ORDER BY tablename, indexname;

-- Expected output: ~20 indexes

-- Test utility functions
SELECT user_has_role('00000000-0000-0000-0000-000000000000'::uuid, 'admin');
-- Expected: false (no users yet)

SELECT get_user_roles('00000000-0000-0000-0000-000000000000'::uuid);
-- Expected: {}
```

## Post-Migration Steps

### 1. Create First Admin User
After migration, the first user to log in via Google OAuth will have `parent` role by default. You need to manually promote them to `admin`:

```sql
-- Find the user
SELECT id, email, name FROM users LIMIT 1;

-- Grant admin role
INSERT INTO user_roles (user_id, role, granted_by)
VALUES ('<user-id>', 'admin', NULL);
```

### 2. Link Existing Teachers
If you have existing teacher records, you need to link them to user accounts:

```sql
-- After teacher logs in with Google
INSERT INTO teacher_users (teacher_id, user_id, linked_by)
VALUES (
  '<existing-teacher-id>',
  '<new-user-id>',
  '<admin-user-id>'
);

-- Also grant teacher role
INSERT INTO user_roles (user_id, role, granted_by)
VALUES ('<new-user-id>', 'teacher', '<admin-user-id>')
ON CONFLICT (user_id, role) DO NOTHING;
```

### 3. Link Existing Students to Parents
When parents register, link them to their children:

```sql
INSERT INTO student_guardians (student_id, user_id, relationship, is_primary, linked_by)
VALUES (
  '<student-id>',
  '<parent-user-id>',
  'parent',
  true,
  '<admin-user-id>'
);

-- Grant parent role
INSERT INTO user_roles (user_id, role, granted_by)
VALUES ('<parent-user-id>', 'parent', '<admin-user-id>')
ON CONFLICT (user_id, role) DO NOTHING;
```

## Rollback (if needed)

If you need to rollback this migration:

```sql
-- WARNING: This will delete all authentication data

-- Drop utility functions
DROP FUNCTION IF EXISTS get_student_ids_for_guardian(uuid);
DROP FUNCTION IF EXISTS get_teacher_id_from_user(uuid);
DROP FUNCTION IF EXISTS get_user_roles(uuid);
DROP FUNCTION IF EXISTS user_has_role(uuid, user_role_type);

-- Drop tables (in reverse order due to foreign keys)
DROP TABLE IF EXISTS login_history CASCADE;
DROP TABLE IF EXISTS refresh_tokens CASCADE;
DROP TABLE IF EXISTS student_guardians CASCADE;
DROP TABLE IF EXISTS teacher_users CASCADE;
DROP TABLE IF EXISTS user_roles CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Drop enums
DROP TYPE IF EXISTS guardian_relationship CASCADE;
DROP TYPE IF EXISTS user_role_type CASCADE;
DROP TYPE IF EXISTS login_method CASCADE;

-- Verify rollback
SELECT tablename FROM pg_tables 
WHERE schemaname = 'public' 
AND tablename IN (
  'users', 'user_roles', 'teacher_users',
  'student_guardians', 'refresh_tokens', 'login_history'
);
-- Expected: 0 rows
```

## Impact on Existing Data

This migration is **additive only** and does NOT modify any existing tables:
- ✅ All existing student, teacher, enrollment data is preserved
- ✅ All existing attendance and payment records remain unchanged
- ✅ No data loss or corruption risk
- ✅ System continues to function with existing data

## Next Steps

After applying this migration:
1. ✅ Update backend to implement authentication middleware
2. ✅ Add Google OAuth routes (`/api/auth/google`, `/api/auth/google/callback`)
3. ✅ Protect existing API endpoints with JWT verification
4. ✅ Implement role-based authorization middleware
5. ✅ Update frontend to add Google login button
6. ✅ Create role-specific dashboards

## Schema Status

Update your `db/SCHEMA_STATUS.md` after applying:

```markdown
## Migration History
- [x] 001_update_enrollment_schema.sql (2026-01-04)
- [x] 002_add_teacher_payout_columns.sql (2026-01-04)
- [x] 003_add_enrollment_batches_columns.sql (2026-01-04)
- [x] 004_add_authentication_tables.sql (2026-01-18) ← NEW
```

## Troubleshooting

### Issue: "relation already exists"
**Solution:** Some tables may already exist. This is safe - the script uses `CREATE TABLE IF NOT EXISTS`.

### Issue: "type already exists"
**Solution:** Enums may already exist. The script handles this with `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object ...`.

### Issue: "permission denied"
**Solution:** Ensure your database user has CREATE privileges:
```sql
GRANT CREATE ON SCHEMA public TO your_username;
```

### Issue: Migration verification fails
**Solution:** Check which tables are missing:
```sql
SELECT 'users' as expected WHERE NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'users')
UNION ALL
SELECT 'user_roles' WHERE NOT EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'user_roles')
-- ... repeat for other tables
```

## Support

For issues or questions about this migration, refer to:
- [PHASE2_AUTH_DESIGN.md](../Phase2_OAuthEnhancement_Design/PHASE2_AUTH_DESIGN.md) - Design decisions
- [er_diagram_phase2.png](../Phase2_OAuthEnhancement_Design/er_diagram_phase2.png) - Visual schema
- [PHASE2_AUTH_SEQUENCES.md](../Phase2_OAuthEnhancement_Design/PHASE2_AUTH_SEQUENCES.md) - Flow diagrams
