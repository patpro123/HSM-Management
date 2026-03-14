const path = require('path');
const readline = require('readline');
// Point to the .env file in backend-enroll
require('dotenv').config({ path: path.join(__dirname, '../../../backend-enroll/.env') });

let pool;

// Check for production mode
const isProd = process.env.NODE_ENV === 'production';

// Configure environment for db.js to pick up
if (process.argv[2] && process.argv[2].startsWith('postgres')) {
  console.log('🌐 Connecting to remote database (CLI argument)...');
  process.env.DATABASE_URL = process.argv[2];
} else if (isProd && process.env.NEON_CONNECTION) {
  console.log('🌐 Connecting to remote database (NEON_CONNECTION from .env)...');
  process.env.DATABASE_URL = process.env.NEON_CONNECTION;
}

// Use the backend's db configuration which has access to 'pg' module
pool = require('../../../backend-enroll/db');

/**
 * ROLLBACK SCRIPT
 * Triggered automatically if the cleanup process encounters any error.
 */
async function triggerRollback(client, error) {
  console.error('\n❌ CLEANUP FAILED:', error.message);
  console.log('🔄 Triggering Rollback Script...');
  try {
    await client.query('ROLLBACK');
    console.log('✅ Rollback successful. Database state has been restored to pre-cleanup snapshot.');
    console.log('   No records were deleted.');
  } catch (rollbackError) {
    console.error('💥 CRITICAL: Rollback failed!', rollbackError);
  }
}

async function cleanupDatabase() {
  if (isProd) {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    const answer = await new Promise(resolve => {
      rl.question('⚠️  WARNING: You are about to TRUNCATE all tables in PRODUCTION. Are you sure? (yes/no): ', resolve);
    });
    rl.close();

    if (answer.toLowerCase() !== 'yes') {
      console.log('❌ Operation cancelled.');
      process.exit(0);
    }
  }

  const client = await pool.connect();
  
  try {
    console.log('🔌 Connected to database...');
    
    // 1. Start Transaction
    // This ensures that if anything fails, we can revert to this exact state
    await client.query('BEGIN');
    console.log('📝 Transaction started.');

    // 2. Identify all tables in the public schema
    // We fetch this dynamically to ensure we don't miss any new tables added in future migrations
    const res = await client.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename NOT IN ('spatial_ref_sys', 'users', 'user_roles', 'refresh_tokens', 'login_history')
    `);

    const tables = res.rows.map(row => `"${row.tablename}"`);

    if (tables.length === 0) {
      console.log('⚠️  No tables found to clean.');
      await client.query('ROLLBACK');
      return;
    }

    console.log(`🔍 Found ${tables.length} tables to clean:`);
    console.log(`   ${tables.join(', ')}`);

    // 3. Execute Comprehensive Cleanup
    // TRUNCATE is faster than DELETE and reclaims disk space immediately
    // RESTART IDENTITY: Resets auto-increment counters to 1
    // CASCADE: Automatically truncates dependent tables (Foreign Keys)
    const truncateQuery = `TRUNCATE TABLE ${tables.join(', ')} RESTART IDENTITY CASCADE;`;
    
    console.log('\n🧹 Executing batch cleanup...');
    await client.query(truncateQuery);

    // 4. Commit Transaction
    // Only reaches here if TRUNCATE was successful
    await client.query('COMMIT');
    console.log('\n✅ CLEANUP SUCCESSFUL');
    console.log('   - All records removed');
    console.log('   - Sequences reset');
    console.log('   - Transaction committed');

  } catch (error) {
    // 5. Trigger Rollback on Failure
    await triggerRollback(client, error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the cleanup
cleanupDatabase();