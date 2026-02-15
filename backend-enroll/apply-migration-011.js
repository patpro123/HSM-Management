require('dotenv').config();
const fs = require('fs');
const path = require('path');
const pool = require('./db');

async function applyMigration() {
  try {
    const migrationPath = path.join(__dirname, '../db/migrations/011_add_finance_tables.sql');
    console.log(`📖 Reading migration file: ${migrationPath}`);
    
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('🚀 Applying migration 011 (Finance tables)...');
    await pool.query(sql);
    
    console.log('✅ Migration 011 applied successfully!');
  } catch (error) {
    console.error('❌ Error applying migration:', error);
  } finally {
    await pool.end();
  }
}

applyMigration();