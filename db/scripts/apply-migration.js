/**
 * Generic migration runner.
 * Usage: node db/scripts/apply-migration.js <migration-number>
 * Example: node db/scripts/apply-migration.js 007
 */
require('dotenv').config({ path: require('path').join(__dirname, '../../backend-enroll/.env') });
const fs = require('fs');
const path = require('path');
const pool = require('../../backend-enroll/db');

async function applyMigration() {
  const migrationNum = process.argv[2];
  if (!migrationNum) {
    console.error('Usage: node db/scripts/apply-migration.js <migration-number>');
    console.error('Example: node db/scripts/apply-migration.js 007');
    process.exit(1);
  }

  const migrationsDir = path.join(__dirname, '../migrations');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.startsWith(migrationNum.padStart(3, '0')) && f.endsWith('.sql'));

  if (files.length === 0) {
    console.error(`No migration file found for: ${migrationNum}`);
    process.exit(1);
  }
  if (files.length > 1) {
    console.error(`Multiple files found for ${migrationNum}:`, files);
    process.exit(1);
  }

  const migrationPath = path.join(migrationsDir, files[0]);
  console.log(`Reading: ${migrationPath}`);
  const sql = fs.readFileSync(migrationPath, 'utf8');

  try {
    console.log(`Applying migration ${migrationNum}...`);
    await pool.query(sql);
    console.log(`Migration ${migrationNum} applied successfully.`);
  } catch (error) {
    console.error('Error applying migration:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

applyMigration();
