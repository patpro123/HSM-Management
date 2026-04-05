// Verify Migration 004: Authentication Tables
const { Client } = require('pg')
require('dotenv').config({ path: './backend-enroll/.env' })

async function verifyMigration() {
  // Use DATABASE_URL from .env, fallback to localhost
  const connectionString = process.env.DATABASE_URL
  
  const client = connectionString 
    ? new Client({
        connectionString,
        ssl: { rejectUnauthorized: false }
      })
    : new Client({
        host: 'localhost',
        port: 5432,
        database: 'hsm_dev',
        user: 'hsm_admin',
        password: 'secret'
      })

  try {
    console.log('==================================================')
    console.log('Migration 004 Verification Script')
    console.log('==================================================\n')

    console.log(connectionString ? 'Connecting to Neon database...' : 'Connecting to localhost...')
    await client.connect()
    console.log('✓ Connected to database\n')

    // Test 1: Check all tables exist
    console.log('Test 1: Checking if all 6 authentication tables exist...')
    const tablesResult = await client.query(`
      SELECT COUNT(*) as count
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name IN (
        'users', 'user_roles', 'teacher_users',
        'student_guardians', 'refresh_tokens', 'login_history'
      );
    `)

    const tableCount = parseInt(tablesResult.rows[0].count)
    if (tableCount === 6) {
      console.log('✓ All 6 tables exist\n')
    } else {
      console.log(`✗ Expected 6 tables, found ${tableCount}\n`)
      process.exit(1)
    }

    // Test 2: Check all enums exist
    console.log('Test 2: Checking if all 3 enums exist...')
    const enumsResult = await client.query(`
      SELECT COUNT(*) as count
      FROM pg_type
      WHERE typname IN ('login_method', 'user_role_type', 'guardian_relationship');
    `)

    const enumCount = parseInt(enumsResult.rows[0].count)
    if (enumCount === 3) {
      console.log('✓ All 3 enums exist\n')
    } else {
      console.log(`✗ Expected 3 enums, found ${enumCount}\n`)
      process.exit(1)
    }

    // Test 3: Check indexes
    console.log('Test 3: Checking if indexes are created...')
    const indexesResult = await client.query(`
      SELECT COUNT(*) as count
      FROM pg_indexes
      WHERE schemaname = 'public'
      AND tablename IN (
        'users', 'user_roles', 'teacher_users',
        'student_guardians', 'refresh_tokens', 'login_history'
      );
    `)

    const indexCount = parseInt(indexesResult.rows[0].count)
    if (indexCount >= 15) {
      console.log(`✓ Found ${indexCount} indexes (expected at least 15)\n`)
    } else {
      console.log(`⚠️  Found only ${indexCount} indexes (expected at least 15)\n`)
    }

    // Test 4: Check utility functions
    console.log('Test 4: Checking if utility functions exist...')
    const functionsResult = await client.query(`
      SELECT COUNT(*) as count
      FROM pg_proc
      WHERE proname IN (
        'user_has_role',
        'get_user_roles',
        'get_teacher_id_from_user',
        'get_student_ids_for_guardian'
      );
    `)

    const functionCount = parseInt(functionsResult.rows[0].count)
    if (functionCount === 4) {
      console.log('✓ All 4 utility functions exist\n')
    } else {
      console.log(`✗ Expected 4 functions, found ${functionCount}\n`)
      process.exit(1)
    }

    // Test 5: Check foreign key constraints
    console.log('Test 5: Checking foreign key constraints...')
    const fkResult = await client.query(`
      SELECT COUNT(*) as count
      FROM information_schema.table_constraints
      WHERE constraint_type = 'FOREIGN KEY'
      AND table_name IN (
        'user_roles', 'teacher_users',
        'student_guardians', 'refresh_tokens', 'login_history'
      );
    `)

    const fkCount = parseInt(fkResult.rows[0].count)
    console.log(`✓ Found ${fkCount} foreign key constraints\n`)

    // Test 6: Test utility functions
    console.log('Test 6: Testing utility functions...')
    
    try {
      await client.query(`
        SELECT user_has_role('00000000-0000-0000-0000-000000000000'::uuid, 'admin');
      `)
      console.log('✓ user_has_role() function works')
    } catch (err) {
      console.log('✗ user_has_role() function failed:', err.message)
      process.exit(1)
    }

    try {
      await client.query(`
        SELECT get_user_roles('00000000-0000-0000-0000-000000000000'::uuid);
      `)
      console.log('✓ get_user_roles() function works\n')
    } catch (err) {
      console.log('✗ get_user_roles() function failed:', err.message)
      process.exit(1)
    }

    // Test 7: Display table list
    console.log('Test 7: Listing all authentication tables...')
    const tableListResult = await client.query(`
      SELECT tablename
      FROM pg_tables
      WHERE schemaname = 'public'
      AND tablename IN (
        'users', 'user_roles', 'teacher_users',
        'student_guardians', 'refresh_tokens', 'login_history'
      )
      ORDER BY tablename;
    `)

    console.log('Tables created:')
    tableListResult.rows.forEach(row => {
      console.log(`  - ${row.tablename}`)
    })
    console.log('')

    // Test 8: Check table row counts
    console.log('Test 8: Checking table row counts...')
    const rowCountsResult = await client.query(`
      SELECT 'users' as table_name, COUNT(*) as row_count FROM users
      UNION ALL
      SELECT 'user_roles', COUNT(*) FROM user_roles
      UNION ALL
      SELECT 'teacher_users', COUNT(*) FROM teacher_users
      UNION ALL
      SELECT 'student_guardians', COUNT(*) FROM student_guardians
      UNION ALL
      SELECT 'refresh_tokens', COUNT(*) FROM refresh_tokens
      UNION ALL
      SELECT 'login_history', COUNT(*) FROM login_history
      ORDER BY table_name;
    `)

    console.log('┌─────────────────────┬────────────┐')
    console.log('│ Table Name          │ Row Count  │')
    console.log('├─────────────────────┼────────────┤')
    rowCountsResult.rows.forEach(row => {
      const tableName = row.table_name.padEnd(19)
      const rowCount = row.row_count.toString().padStart(10)
      console.log(`│ ${tableName} │ ${rowCount} │`)
    })
    console.log('└─────────────────────┴────────────┘\n')

    // Summary
    console.log('==================================================')
    console.log('✓ Migration 004 Verification Complete!')
    console.log('==================================================\n')
    console.log('Next steps:')
    console.log('1. Implement backend authentication middleware')
    console.log('2. Add Google OAuth routes')
    console.log('3. Protect existing API endpoints')
    console.log('4. Update frontend with login flow\n')
    console.log('For detailed implementation guide, see:')
    console.log('  Phase2_OAuthEnhancement_Design/PHASE2_AUTH_DESIGN.md')
    console.log('==================================================\n')

  } catch (error) {
    console.error('✗ Verification failed:')
    console.error(error.message)
    process.exit(1)
  } finally {
    await client.end()
  }
}

verifyMigration()
