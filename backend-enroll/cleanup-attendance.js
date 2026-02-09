require('dotenv').config();
const pool = require('./db');

async function cleanupAttendance() {
  try {
    console.log('🗑️  Cleaning up attendance records...');
    const result = await pool.query('DELETE FROM attendance_records');
    console.log(`✅ Successfully deleted ${result.rowCount} records from attendance_records table.`);
  } catch (error) {
    console.error('❌ Error cleaning up attendance records:', error);
  } finally {
    await pool.end();
  }
}

cleanupAttendance();