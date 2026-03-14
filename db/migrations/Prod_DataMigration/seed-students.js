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

// Use the backend's db configuration
pool = require('../../../backend-enroll/db');

const CSV_FILE = 'active_HSM.csv';
const REPORT_FILE = 'migration_report.json';

// --- HEURISTICS & MAPPINGS ---

const DAY_MAP = {
  'MON': 'MON', 'MONDAY': 'MON', 'MO': 'MON',
  'TUE': 'TUE', 'TUESDAY': 'TUE', 'TU': 'TUE',
  'WED': 'WED', 'WEDNESDAY': 'WED', 'WE': 'WED',
  'THU': 'THU', 'THURSDAY': 'THU', 'TH': 'THU',
  'FRI': 'FRI', 'FRIDAY': 'FRI', 'FR': 'FRI',
  'SAT': 'SAT', 'SATURDAY': 'SAT', 'SA': 'SAT',
  'SUN': 'SUN', 'SUNDAY': 'SUN', 'SU': 'SUN'
};

const INSTRUMENT_ALIASES = {
  'Keyboard': 'Keyboard/Piano',
  'Piano': 'Keyboard/Piano',
  'Vocals': 'Hindustani Vocals', // Defaulting generic vocals to Hindustani if not specified
  'Carnatik': 'Carnatic Vocals'
};

function parseDayFromBatchString(str) {
  const upper = str.toUpperCase();
  for (const [key, val] of Object.entries(DAY_MAP)) {
    if (upper.includes(key)) return val;
  }
  return null;
}

function findBestBatchMatch(batchStr, instrumentId, allBatches) {
  if (!batchStr || batchStr.trim() === '' || batchStr.trim() === '-') return null;

  const targetDay = parseDayFromBatchString(batchStr);
  if (!targetDay) return null;

  // Filter candidates by instrument and day
  const candidates = allBatches.filter(b => 
    b.instrument_id === instrumentId && 
    b.recurrence.includes(targetDay)
  );

  // Sort by start_time to get the first available
  candidates.sort((a, b) => a.start_time.localeCompare(b.start_time));

  return candidates.length > 0 ? candidates[0] : null;
}

async function seedStudents() {
  const client = await pool.connect();
  const report = { success: [], failed: [], skipped: [] };

  try {
    console.log('🔌 Connected to database...');
    await client.query('BEGIN');

    // 1. Load Reference Data
    console.log('📥 Loading reference data...');
    const instrumentsRes = await client.query('SELECT * FROM instruments');
    const teachersRes = await client.query('SELECT * FROM teachers');
    const batchesRes = await client.query('SELECT * FROM batches WHERE is_makeup = false');
    
    const instruments = instrumentsRes.rows;
    const teachers = teachersRes.rows;
    const batches = batchesRes.rows;

    // 2. Read CSV
    const csvPath = path.join(__dirname, CSV_FILE);
    if (!fs.existsSync(csvPath)) {
      throw new Error(`CSV file not found at ${csvPath}`);
    }
    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = fileContent.split('\n').filter(l => l.trim().length > 0);
    const dataLines = lines.slice(1); // Skip header

    console.log(`📦 Processing ${dataLines.length} students...`);

    for (const line of dataLines) {
      // Regex split for CSV (handling quoted commas)
      const parts = line.split(/,(?=(?:(?:[^"]*"){2})*[^"]*$)/).map(p => p.trim().replace(/^"|"$/g, ''));
      
      // 0: Name, 1: Headshot, 2: Email, 3: Phone, 4: Locality, 5: Age, 6: Profession, 
      // 7: Course, 8: Day1, 9: Day2, 10: PaymentCycle, 11: DateOfAdmission, 12: PayStart, 13: PayEnd, 14: LEFT, 15: Leaving, 16: ClassesCovered
      const [name, headshot, email, phone, locality, age, profession, course, day1, day2, paymentCycle, dateOfAdmission, payStart, payEnd, leftStatus, leavingDate, classesCovered] = parts;

      if (!name || !course) {
        report.skipped.push({ line, reason: 'Missing Name or Course' });
        continue;
      }

      // --- A. Resolve Instrument ---
      let instName = INSTRUMENT_ALIASES[course] || course;
      const instrument = instruments.find(i => i.name.toLowerCase() === instName.toLowerCase()) || 
                         instruments.find(i => i.name.toLowerCase().includes(instName.toLowerCase()));
      
      if (!instrument) {
        report.failed.push({ name, reason: `Instrument not found: ${course}` });
        continue;
      }

      // --- B. Create/Update Student ---
      // Check existence by email or phone
      let studentId;
      const existingStudent = await client.query(
        'SELECT id FROM students WHERE email = $1 OR phone = $2', 
        [email || 'placeholder', phone || '0000000000']
      );

      const isActive = !(leftStatus && (leftStatus.toUpperCase() === 'YES' || leftStatus.toUpperCase() === 'TRUE'));
      const metadata = {
        address: locality,
        age: age,
        profession: profession,
        legacy_image: headshot
      };

      if (existingStudent.rows.length > 0) {
        studentId = existingStudent.rows[0].id;
        // Optional: Update existing student? Skipping to preserve current data, or update metadata?
        // Let's update metadata and active status
        await client.query(
          'UPDATE students SET is_active = $1, metadata = metadata || $2::jsonb WHERE id = $3',
          [isActive, JSON.stringify(metadata), studentId]
        );
      } else {
        const newStudent = await client.query(
          `INSERT INTO students (name, email, phone, guardian_contact, dob, is_active, metadata)
           VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
          [
            name, 
            email || `${name.replace(/\s/g,'.').toLowerCase()}@example.com`, // Fallback email
            phone || '0000000000', 
            'Unknown', // Guardian
            '2000-01-01', // Default DOB
            isActive,
            JSON.stringify(metadata)
          ]
        );
        studentId = newStudent.rows[0].id;
      }

      // --- C. Create Enrollment ---
      // Only if active or has history
      const enrolledOn = dateOfAdmission ? new Date(dateOfAdmission) : new Date();
      const classesRemaining = parseInt(classesCovered, 10) || 0;

      // Check if already enrolled in this instrument
      // (We assume 1 enrollment per student for now based on schema, but we can check enrollment_batches)
      let enrollmentId;
      const existEnroll = await client.query(
        'SELECT id FROM enrollments WHERE student_id = $1',
        [studentId]
      );

      if (existEnroll.rows.length > 0) {
        enrollmentId = existEnroll.rows[0].id;
      } else {
        const newEnroll = await client.query(
          `INSERT INTO enrollments (student_id, status, classes_remaining, enrolled_on)
           VALUES ($1, $2, $3, $4) RETURNING id`,
          [studentId, isActive ? 'active' : 'completed', classesRemaining, enrolledOn]
        );
        enrollmentId = newEnroll.rows[0].id;
      }

      // --- D. Map Batches ---
      const batchesToLink = [];
      
      // Try Day 1
      const batch1 = findBestBatchMatch(day1, instrument.id, batches);
      if (batch1) batchesToLink.push(batch1);
      else if (day1 && day1.length > 2) report.failed.push({ name, reason: `Could not map Day 1 Batch: ${day1}` });

      // Try Day 2
      const batch2 = findBestBatchMatch(day2, instrument.id, batches);
      if (batch2) batchesToLink.push(batch2);
      else if (day2 && day2.length > 2) report.failed.push({ name, reason: `Could not map Day 2 Batch: ${day2}` });

      // Link Batches
      const paymentFreq = (paymentCycle && paymentCycle.toLowerCase().includes('quarterly')) ? 'quarterly' : 'monthly';

      for (const b of batchesToLink) {
        // Check if already linked
        const checkLink = await client.query(
          'SELECT id FROM enrollment_batches WHERE enrollment_id = $1 AND batch_id = $2',
          [enrollmentId, b.id]
        );
        
        if (checkLink.rows.length === 0) {
          await client.query(
            `INSERT INTO enrollment_batches (enrollment_id, batch_id, payment_frequency, classes_remaining, enrolled_on)
             VALUES ($1, $2, $3, $4, $5)`,
            [enrollmentId, b.id, paymentFreq, classesRemaining, enrolledOn] // Assigning full credits to batch for visibility
          );
        }
      }

      report.success.push({ name, instrument: instrument.name, batchesMapped: batchesToLink.length });
    }

    await client.query('COMMIT');
    fs.writeFileSync(path.join(__dirname, REPORT_FILE), JSON.stringify(report, null, 2));
    console.log(`\n✅ Migration Complete. Report saved to ${REPORT_FILE}`);
    console.log(`   Success: ${report.success.length}, Failed Mappings: ${report.failed.length}, Skipped: ${report.skipped.length}`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Migration Failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seedStudents();