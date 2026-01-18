#!/bin/bash
# Verify Migration 004: Authentication Tables
# Run this after applying the migration to ensure everything is set up correctly

set -e  # Exit on error

echo "=================================================="
echo "Migration 004 Verification Script"
echo "=================================================="
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "⚠️  DATABASE_URL not set. Please export it:"
    echo "   export DATABASE_URL='postgresql://user:pass@host:port/database'"
    exit 1
fi

echo "✓ DATABASE_URL is set"
echo ""

# Test 1: Check all tables exist
echo "Test 1: Checking if all 6 authentication tables exist..."
TABLE_COUNT=$(psql "$DATABASE_URL" -t -c "
    SELECT COUNT(*) 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name IN (
        'users', 'user_roles', 'teacher_users', 
        'student_guardians', 'refresh_tokens', 'login_history'
    );
" | xargs)

if [ "$TABLE_COUNT" -eq 6 ]; then
    echo "✓ All 6 tables exist"
else
    echo "✗ Expected 6 tables, found $TABLE_COUNT"
    psql "$DATABASE_URL" -c "
        SELECT tablename 
        FROM pg_tables 
        WHERE schemaname = 'public' 
        AND tablename LIKE '%user%' OR tablename LIKE '%auth%' OR tablename LIKE '%login%'
        ORDER BY tablename;
    "
    exit 1
fi
echo ""

# Test 2: Check all enums exist
echo "Test 2: Checking if all 3 enums exist..."
ENUM_COUNT=$(psql "$DATABASE_URL" -t -c "
    SELECT COUNT(*) 
    FROM pg_type 
    WHERE typname IN ('login_method', 'user_role_type', 'guardian_relationship');
" | xargs)

if [ "$ENUM_COUNT" -eq 3 ]; then
    echo "✓ All 3 enums exist"
else
    echo "✗ Expected 3 enums, found $ENUM_COUNT"
    exit 1
fi
echo ""

# Test 3: Check indexes
echo "Test 3: Checking if indexes are created..."
INDEX_COUNT=$(psql "$DATABASE_URL" -t -c "
    SELECT COUNT(*) 
    FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND tablename IN (
        'users', 'user_roles', 'teacher_users', 
        'student_guardians', 'refresh_tokens', 'login_history'
    );
" | xargs)

if [ "$INDEX_COUNT" -ge 15 ]; then
    echo "✓ Found $INDEX_COUNT indexes (expected at least 15)"
else
    echo "⚠️  Found only $INDEX_COUNT indexes (expected at least 15)"
fi
echo ""

# Test 4: Check utility functions
echo "Test 4: Checking if utility functions exist..."
FUNCTION_COUNT=$(psql "$DATABASE_URL" -t -c "
    SELECT COUNT(*) 
    FROM pg_proc 
    WHERE proname IN (
        'user_has_role', 
        'get_user_roles', 
        'get_teacher_id_from_user', 
        'get_student_ids_for_guardian'
    );
" | xargs)

if [ "$FUNCTION_COUNT" -eq 4 ]; then
    echo "✓ All 4 utility functions exist"
else
    echo "✗ Expected 4 functions, found $FUNCTION_COUNT"
    exit 1
fi
echo ""

# Test 5: Check foreign key constraints
echo "Test 5: Checking foreign key constraints..."
FK_COUNT=$(psql "$DATABASE_URL" -t -c "
    SELECT COUNT(*) 
    FROM information_schema.table_constraints 
    WHERE constraint_type = 'FOREIGN KEY' 
    AND table_name IN (
        'user_roles', 'teacher_users', 
        'student_guardians', 'refresh_tokens', 'login_history'
    );
" | xargs)

if [ "$FK_COUNT" -ge 10 ]; then
    echo "✓ Found $FK_COUNT foreign key constraints"
else
    echo "⚠️  Found only $FK_COUNT foreign key constraints"
fi
echo ""

# Test 6: Test utility functions
echo "Test 6: Testing utility functions..."

# Test user_has_role
psql "$DATABASE_URL" -t -c "
    SELECT user_has_role('00000000-0000-0000-0000-000000000000'::uuid, 'admin');
" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✓ user_has_role() function works"
else
    echo "✗ user_has_role() function failed"
    exit 1
fi

# Test get_user_roles
psql "$DATABASE_URL" -t -c "
    SELECT get_user_roles('00000000-0000-0000-0000-000000000000'::uuid);
" > /dev/null 2>&1
if [ $? -eq 0 ]; then
    echo "✓ get_user_roles() function works"
else
    echo "✗ get_user_roles() function failed"
    exit 1
fi

echo ""

# Test 7: Display table structures
echo "Test 7: Displaying table structures..."
echo ""
echo "--- Users Table ---"
psql "$DATABASE_URL" -c "\d users" | head -20
echo ""

echo "--- User Roles Table ---"
psql "$DATABASE_URL" -c "\d user_roles" | head -20
echo ""

# Test 8: Check if tables are empty (expected for new migration)
echo "Test 8: Checking table row counts..."
psql "$DATABASE_URL" -c "
    SELECT 
        'users' as table_name, 
        COUNT(*) as row_count 
    FROM users
    UNION ALL
    SELECT 'user_roles', COUNT(*) FROM user_roles
    UNION ALL
    SELECT 'teacher_users', COUNT(*) FROM teacher_users
    UNION ALL
    SELECT 'student_guardians', COUNT(*) FROM student_guardians
    UNION ALL
    SELECT 'refresh_tokens', COUNT(*) FROM refresh_tokens
    UNION ALL
    SELECT 'login_history', COUNT(*) FROM login_history;
"
echo ""

# Summary
echo "=================================================="
echo "✓ Migration 004 Verification Complete!"
echo "=================================================="
echo ""
echo "Next steps:"
echo "1. Implement backend authentication middleware"
echo "2. Add Google OAuth routes"
echo "3. Protect existing API endpoints"
echo "4. Update frontend with login flow"
echo ""
echo "For detailed implementation guide, see:"
echo "  Phase2_OAuthEnhancement_Design/PHASE2_AUTH_DESIGN.md"
echo "=================================================="
