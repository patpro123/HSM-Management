const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.NEON_CONNECTION || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const enrollmentsToMerge = [
    { student: 'Vihan', oldE: '25377226-5a6a-4b41-a898-2f7fb22d03d3', newE: 'f2b624c4-e8d1-4ba4-b4dd-e4ed8debfd4a' },
    { student: 'Joseph A', oldE: 'cd67b6ff-e2bb-4595-87b6-74ea83015acc', newE: 'b85d7d3d-4755-4c4f-aaf6-91d287242278' },
    { student: 'HARINI REDDY', oldE: '58d0c577-8c1e-4c84-92d1-5e02f17ae087', newE: '664517d9-0c78-4ee4-897d-0c4c82eaa748' },
    { student: 'B.John wesly', oldE: 'c2f59a9c-32b7-4e4e-942d-55278c60c9db', newE: 'b8e2e426-3935-4daa-adcb-2d47a665db56' },
    { student: 'Devis feby', oldE: '8f8d4c1b-f159-44c0-a607-bf5ffe8b96a5', newE: 'cfc53b91-507f-4dc2-847e-9454dc9dad7d' },
    { student: 'Siddhan Erumala', oldE: 'c4110702-e86f-4dc6-b395-5755e36f92be', newE: '447c681e-c778-4e8a-b101-dcd7550794ab' }
];

async function fixEnrollments() {
    const client = await pool.connect();
    try {
        for (const m of enrollmentsToMerge) {
            console.log(`Fixing duplicate enrollments for ${m.student}...`);
            await client.query('BEGIN');

            // 1. Get classes remaining and instrument from NEW
            const newERes = await client.query('SELECT classes_remaining, instrument_id FROM enrollments WHERE id = $1', [m.newE]);
            if (newERes.rows.length === 0) continue;
            const { classes_remaining, instrument_id } = newERes.rows[0];

            // 2. Update OLD enrollment to hold the correct data
            await client.query(
                'UPDATE enrollments SET classes_remaining = $1, instrument_id = $2 WHERE id = $3',
                [classes_remaining, instrument_id, m.oldE]
            );

            // 3. Move the correct enrollment_batch from NEW to OLD
            // First, capture the batch id we are moving so we don't delete it
            const newBatchRes = await client.query('SELECT id FROM enrollment_batches WHERE enrollment_id = $1', [m.newE]);
            const newBatchId = newBatchRes.rows[0].id;

            await client.query(
                'UPDATE enrollment_batches SET enrollment_id = $1 WHERE id = $2',
                [m.oldE, newBatchId]
            );

            // 4. Delete the other enrollment batches belonging to OLD that are obsolete
            await client.query(
                'DELETE FROM enrollment_batches WHERE enrollment_id = $1 AND id != $2',
                [m.oldE, newBatchId]
            );

            // 5. Delete the NEW enrollment entirely
            await client.query('DELETE FROM enrollments WHERE id = $1', [m.newE]);

            await client.query('COMMIT');
            console.log(`Success: Fixed enrollments for ${m.student}`);
        }
    } catch (err) {
        console.error('Fix enrollments failed:', err);
        if (client) await client.query('ROLLBACK');
    } finally {
        client.release();
        pool.end();
    }
}

fixEnrollments();
