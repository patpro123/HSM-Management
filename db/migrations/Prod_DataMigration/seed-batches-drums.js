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

const TEACHER_NAME = 'Bhaduri sir';
const INSTRUMENT_NAME = 'Drums';

const BATCHES = [
  // Saturday Batches
  { recurrence: 'SAT 17:00-17:45', start_time: '17:00', end_time: '17:45' },
  { recurrence: 'SAT 17:45-18:30', start_time: '17:45', end_time: '18:30' },
  { recurrence: 'SAT 18:30-19:15', start_time: '18:30', end_time: '19:15' },
  // Thursday Batches
  { recurrence: 'THU 18:30-19:15', start_time: '18:30', end_time: '19:15' },
  { recurrence: 'THU 19:15-20:30', start_time: '19:15', end_time: '20:30' },
  { recurrence: 'THU 20:30-21:15', start_time: '20:30', end_time: '21:15' }
];

async function seedDrumsBatches() {
  const client = await pool.connect();
  
  try {
    console.log('🔌 Connected to database...');
    await client.query('BEGIN');

    // 1. Get or Create Teacher
    let teacherId;
    const teacherRes = await client.query('SELECT id FROM teachers WHERE name = $1', [TEACHER_NAME]);
    if (teacherRes.rows.length > 0) {
      teacherId = teacherRes.rows[0].id;
      console.log(`👨‍🏫 Found teacher: ${TEACHER_NAME}`);
    } else {
      const newTeacher = await client.query(
        "INSERT INTO teachers (name, phone, role, payout_type, rate) VALUES ($1, '0000000000', 'teacher', 'fixed', 0) RETURNING id",
        [TEACHER_NAME]
      );
      teacherId = newTeacher.rows[0].id;
      console.log(`👨‍🏫 Created teacher: ${TEACHER_NAME}`);
    }

    // 2. Get Instrument ID
    const instRes = await client.query('SELECT id, max_batch_size FROM instruments WHERE name = $1', [INSTRUMENT_NAME]);
    if (instRes.rows.length === 0) {
      throw new Error(`Instrument '${INSTRUMENT_NAME}' not found. Please run seed-instruments.js first.`);
    }
    const instrumentId = instRes.rows[0].id;
    const capacity = instRes.rows[0].max_batch_size || 4; // Default to 4 for drums if not set
    console.log(`🥁 Found instrument: ${INSTRUMENT_NAME} (ID: ${instrumentId})`);

    // 3. Create Batches
    console.log('📦 Seeding batches...');
    for (const batch of BATCHES) {
      // Check for existing batch to avoid duplicates
      const check = await client.query(
        `SELECT id FROM batches 
         WHERE instrument_id = $1 
         AND teacher_id = $2 
         AND recurrence = $3 
         AND start_time = $4::time 
         AND end_time = $5::time`,
        [instrumentId, teacherId, batch.recurrence, batch.start_time, batch.end_time]
      );

      if (check.rows.length === 0) {
        await client.query(
          `INSERT INTO batches (instrument_id, teacher_id, recurrence, start_time, end_time, capacity, is_makeup)
           VALUES ($1, $2, $3, $4, $5, $6, false)`,
          [instrumentId, teacherId, batch.recurrence, batch.start_time, batch.end_time, capacity]
        );
        console.log(`   ✅ Added: ${batch.recurrence} ${batch.start_time}-${batch.end_time}`);
      } else {
        console.log(`   ⚠️  Skipped (exists): ${batch.recurrence} ${batch.start_time}-${batch.end_time}`);
      }
    }

    await client.query('COMMIT');
    console.log('\n✅ Drums batches seeding completed successfully.');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seedDrumsBatches();