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

const CSV_FILE = 'HSM_Packages - Sheet1.csv';

async function seedPackages() {
  const client = await pool.connect();

  try {
    console.log('🔌 Connected to database...');
    await client.query('BEGIN');

    // 1. Load Instruments for mapping
    console.log('📥 Loading instruments...');
    const instrumentsRes = await client.query('SELECT * FROM instruments');
    const instruments = instrumentsRes.rows;

    // 2. Read CSV
    const csvPath = path.join(__dirname, CSV_FILE);
    if (!fs.existsSync(csvPath)) {
      throw new Error(`CSV file not found at ${csvPath}`);
    }
    const fileContent = fs.readFileSync(csvPath, 'utf-8');
    const lines = fileContent.split('\n').filter(l => l.trim().length > 0);
    const dataLines = lines.slice(1); // Skip header

    console.log(`📦 Processing ${dataLines.length} packages...`);

    for (const line of dataLines) {
      // CSV Format: Instrument,Package Name,Class Count,Price
      // Example: Guitar,Quarterly,24,8000
      const parts = line.split(',').map(p => p.trim());
      
      if (parts.length < 4) continue;

      const [instNameRaw, packageName, classCountRaw, priceRaw] = parts;
      
      // Find Instrument ID
      // Matches "Keyboard/Piano" directly or case-insensitive
      const instrument = instruments.find(i => i.name.toLowerCase() === instNameRaw.toLowerCase());
      
      if (!instrument) {
        console.warn(`⚠️  Skipping: Instrument '${instNameRaw}' not found in DB.`);
        continue;
      }

      const price = parseFloat(priceRaw);
      const classCount = parseInt(classCountRaw, 10);

      // 3. Insert Package
      // Assumes table 'packages' exists with columns: instrument_id, name, price, classes_count
      await client.query(
        `INSERT INTO packages (instrument_id, name, price, classes_count)
         VALUES ($1, $2, $3, $4)`,
        [instrument.id, packageName, price, classCount]
      );
      
      console.log(`✅ Inserted: ${instrument.name} - ${packageName} (${classCount} classes) @ ${price}`);
    }

    await client.query('COMMIT');
    console.log('\n🎉 Packages seeded successfully!');

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('❌ Seeding Failed:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seedPackages();