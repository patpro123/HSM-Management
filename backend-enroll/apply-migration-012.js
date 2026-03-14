const pool = require('./db');

async function migrate() {
    const client = await pool.connect();
    try {
        console.log('Running Migration 012: Add student_type to students table');
        await client.query('BEGIN');

        await client.query(`
      ALTER TABLE students 
      ADD COLUMN IF NOT EXISTS student_type VARCHAR(50) DEFAULT 'permanent';
    `);

        // Ensure all existing students are marked as permanent
        await client.query(`
      UPDATE students 
      SET student_type = 'permanent' 
      WHERE student_type IS NULL;
    `);

        await client.query('COMMIT');
        console.log('Migration 012 successful! Added student_type column.');
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('Migration failed:', err);
    } finally {
        client.release();
        pool.end();
    }
}

migrate();
