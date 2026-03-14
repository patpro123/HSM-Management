const fs = require('fs');
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

const CSV_FILE = 'HSM_Batches.csv';

const DAY_MAP = {
  'Monday': 'MON',
  'Tuesday': 'TUE',
  'Wednesday': 'WED',
  'Thursday': 'THU',
  'Friday': 'FRI',
  'Saturday': 'SAT',
  'Sunday': 'SUN'
};

// Map CSV instrument names to Database instrument names if they differ
const INSTRUMENT_ALIASES = {
  'Keyboard': 'Keyboard/Piano'
};

function convertTo24Hour(timeStr) {
  if (!timeStr) return '00:00';
  const [time, modifier] = timeStr.trim().split(' ');
  let [hours, minutes] = time.split(':');
  let h = parseInt(hours, 10);
  
  if (h === 12) {
    h = 0;
  }
  if (modifier === 'PM') {
    h += 12;
  }
  
  return `${h.toString().padStart(2, '0')}:${minutes}`;
}

async function seedBatches() {
  const client = await pool.connect();
  
  try {
    console.log('🔌 Connected to database...');
    await client.query('BEGIN');

    const csvPath = path.join(__dirname, CSV_FILE);
    if (!fs.existsSync(csvPath)) {
      throw new Error(`CSV file not found at ${csvPath}`);
    }

    console.log(`📖 Reading batches from ${CSV_FILE}...`);
    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    // Split by newline and filter empty lines
    const lines = fileContent.split('\n').filter(l => l.trim().length > 0);
    
    // Skip header row
    const dataLines = lines.slice(1);
    console.log(`📦 Found ${dataLines.length} batches to process...`);

    for (const line of dataLines) {
      // Simple CSV split (assuming no commas in fields)
      const parts = line.split(',').map(p => p.trim());
      if (parts.length < 6) continue;

      const [rawInst, teacherName, day, startStr, endStr, sizeStr] = parts;
      
      // 1. Resolve Instrument
      let instName = INSTRUMENT_ALIASES[rawInst] || rawInst;
      const instRes = await client.query('SELECT id FROM instruments WHERE name = $1', [instName]);
      
      if (instRes.rows.length === 0) {
        console.warn(`⚠️  Instrument not found: "${instName}" (Raw: "${rawInst}"). Skipping batch.`);
        continue;
      }
      const instrumentId = instRes.rows[0].id;

      // 2. Resolve Teacher (Create if not exists)
      let teacherId;
      const teacherRes = await client.query('SELECT id FROM teachers WHERE name = $1', [teacherName]);
      if (teacherRes.rows.length > 0) {
        teacherId = teacherRes.rows[0].id;
      } else {
        const newTeacher = await client.query(
          "INSERT INTO teachers (name, phone, role, payout_type, rate) VALUES ($1, '0000000000', 'teacher', 'fixed', 0) RETURNING id",
          [teacherName]
        );
        teacherId = newTeacher.rows[0].id;
        console.log(`   👨‍🏫 Created new teacher: ${teacherName}`);
      }

      // 3. Format Data
      const startTime24 = convertTo24Hour(startStr);
      const endTime24 = convertTo24Hour(endStr);
      const shortDay = DAY_MAP[day] || day.substring(0, 3).toUpperCase();
      const recurrence = `${shortDay} ${startTime24}-${endTime24}`;
      const capacity = parseInt(sizeStr, 10) || 5;

      // 4. Insert Batch (Check duplicates)
      const check = await client.query(
        `SELECT id FROM batches 
         WHERE instrument_id = $1 
         AND teacher_id = $2 
         AND recurrence = $3`,
        [instrumentId, teacherId, recurrence]
      );

      if (check.rows.length === 0) {
        await client.query(
          `INSERT INTO batches (instrument_id, teacher_id, recurrence, start_time, end_time, capacity, is_makeup)
           VALUES ($1, $2, $3, $4, $5, $6, false)`,
          [instrumentId, teacherId, recurrence, startTime24, endTime24, capacity]
        );
        console.log(`   ✅ Added: ${instName.padEnd(15)} | ${teacherName.padEnd(15)} | ${recurrence}`);
      } else {
        console.log(`   ⚠️  Skipped (exists): ${instName} | ${recurrence}`);
      }
    }

    await client.query('COMMIT');
    console.log('\n✅ Batch seeding completed successfully.');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Seeding failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seedBatches();