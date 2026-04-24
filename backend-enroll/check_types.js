require('dotenv').config();
const { Pool } = require('pg');
const pool = new Pool({
    connectionString: process.env.NEON_CONNECTION
});

async function checkTypes() {
    try {
        console.log("Checking fee_structures column types...");
        const colRes = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'fee_structures'");
        colRes.rows.forEach(r => console.log(`${r.column_name}: ${r.data_type}`));

        console.log("\nChecking unique constraints...");
        const constRes = await pool.query(`
      SELECT conname, pg_get_constraintdef(c.oid)
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE conrelid = 'fee_structures'::regclass
    `);
        constRes.rows.forEach(r => console.log(`${r.conname}: ${r.pg_get_constraintdef}`));

    } catch (err) {
        console.error("Error:", err.message);
    } finally {
        pool.end();
    }
}

checkTypes();
