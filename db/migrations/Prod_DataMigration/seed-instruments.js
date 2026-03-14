const path = require('path');
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

const INSTRUMENTS = [
  { name: 'Guitar', max_batch_size: 5, online_supported: true },
  { name: 'Keyboard/Piano', max_batch_size: 5, online_supported: true },
  { name: 'Drums', max_batch_size: 4, online_supported: false },
  { name: 'Tabla', max_batch_size: 5, online_supported: true },
  { name: 'Hindustani Vocals', max_batch_size: 8, online_supported: true },
  { name: 'Carnatic Vocals', max_batch_size: 8, online_supported: true },
  { name: 'Violin', max_batch_size: 5, online_supported: true }
];

async function seedInstruments() {
  const client = await pool.connect();
  
  try {
    console.log('🔌 Connected to database...');
    await client.query('BEGIN');

    console.log('🎸 Seeding instruments...');
    
    for (const inst of INSTRUMENTS) {
      // Check if exists to avoid duplicates
      const check = await client.query('SELECT id FROM instruments WHERE name = $1', [inst.name]);
      
      if (check.rows.length === 0) {
        await client.query(
          'INSERT INTO instruments (name, max_batch_size, online_supported) VALUES ($1, $2, $3)',
          [inst.name, inst.max_batch_size, inst.online_supported]
        );
        console.log(`   ✅ Added: ${inst.name}`);
      } else {
        console.log(`   ⚠️  Skipped (already exists): ${inst.name}`);
      }
    }

    await client.query('COMMIT');
    console.log('\n✅ Instruments seeding completed successfully.');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run the seeder
seedInstruments();