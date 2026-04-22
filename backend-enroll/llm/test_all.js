require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
    connectionString: process.env.NEON_CONNECTION
});
const { skills } = require('./skills');

async function testAll() {
    console.log("=== Testing ALL skills ===");

    // Try stats.unpaid again
    try {
        await skills['stats.unpaid']();
        console.log("stats.unpaid OK!");
    } catch (e) {
        console.error("stats.unpaid FAILED:", e.message);
    }

    // Try student.credits with a dummy valid name or random UUID
    try {
        const res = await pool.query('SELECT name FROM students LIMIT 1');
        if (res.rows.length) {
            await skills['student.credits']({ params: { name: res.rows[0].name } });
            console.log("student.credits OK!");
        }
    } catch (e) {
        console.error("student.credits FAILED:", e.message);
    }

    // Try batch.roster with a valid instrument name or query
    try {
        const res = await pool.query('SELECT b.id FROM batches b JOIN instruments i ON b.instrument_id = i.id WHERE i.name ILIKE $1 LIMIT 1', ['%vocal%']);
        if (res.rows.length) {
            await skills['batch.roster']({ params: { batch_id: res.rows[0].id } });
            console.log("batch.roster OK!");
        } else {
            await skills['batch.roster']({ params: { batch_id: 'vocal' } });
            console.log("batch.roster (text) OK!");
        }
    } catch (e) {
        console.error("batch.roster FAILED:", e.message);
    }

    pool.end();
}
testAll();
