const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.NEON_CONNECTION || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const mapping = [
    { name: 'Arav', newId: 'f2d3ae5e-ab51-4782-aa69-7c6922ff5f57', oldId: '783b322f-563e-461c-8f66-9d27938daac1', freq: 'quarterly', attended: 7, missed: 1, pending: 16, start: '2026-04-03' },
    { name: 'Akshaar', newId: 'ee182870-0a1a-479a-8fd9-317e53b214f4', oldId: 'c25db73b-fa7c-4e9b-a2fd-9289382203e9', freq: 'quarterly', attended: 14, missed: 3, pending: 7, start: '2026-02-21' },
    { name: 'Joseph', newId: '2b91dd42-6a79-4db1-82d3-58156b1d785d', oldId: '3879229d-6763-459c-bbcd-405c8796dddd', freq: 'quarterly', attended: 33, missed: 10, pending: 5, start: '2025-10-11' },
    { name: 'Devis', newId: '8e94300d-2dc8-42a0-bc3d-bac08ecf098b', oldId: 'c4e3dee2-3a66-45fc-923c-8914de5704bf', freq: 'quarterly', attended: 6, missed: 2, pending: 16, start: '2026-03-26' },
    { name: 'Siddhan', newId: '682fd059-162e-4e32-97c0-4fa36c45b1a0', oldId: 'cc599657-9637-49fe-be89-632c8a240ee8', freq: 'quarterly', attended: 10, missed: 5, pending: 9, start: '2026-02-20' },
    { name: 'Rishi', newId: 'c46245c6-6784-4971-9ef7-72a257fb60d2', oldId: 'c035ef79-b014-4673-83d0-e2eb1f8b1113', freq: 'monthly', attended: 4, missed: 2, pending: 2, start: '2026-04-02' },
    { name: 'Vihan choudhuri', newId: '603a428e-860e-4bf6-8818-15c66bcb8f1f', oldId: '2f0e6df4-cc59-45da-a562-17215c6380df', freq: 'quarterly', attended: 14, missed: 2, pending: 8, start: '2026-02-21' },
    { name: 'B.john wesly', newId: '3c22f109-00b1-4c91-b7d8-ff91bdd463e1', oldId: '80d14929-0eca-4547-863d-d7e92a3c033d', freq: 'quarterly', attended: 8, missed: 0, pending: 16, start: '2026-03-26' },
    { name: 'Vishnu vardhan', newId: 'ba779f41-c185-4a50-8d57-39f12096fe52', oldId: 'f97e252e-ee8b-4625-b90e-c21ca88ae9ae', freq: 'monthly', attended: 5, missed: 2, pending: 1, start: '2026-04-02' },
    { name: 'Harini reddy', newId: '77fa18e0-840e-4cf3-b86a-7c231c682bd3', oldId: '5d85e28b-e658-4bd0-997f-dd813aa92035', freq: 'quarterly', attended: 6, missed: 0, pending: 18, start: '2026-04-04' },
    { name: 'Arush guhan', newId: 'f7b15f24-da83-4f40-88e9-7b01833ad824', oldId: '0d3542da-1022-4845-8dce-7d85e7b5dca7', freq: 'quarterly', attended: 4, missed: 1, pending: 19, start: '2026-04-09' }
];

const TEACHER_ID = '52ecec5f-a40e-43d4-bd6a-0021d0e16e87'; // Subrata Bhaduri
const INSTRUMENT_ID = '78f0b648-4113-4f59-b138-cdd48e52af78'; // Drums

async function cleanup() {
    const client = await pool.connect();
    try {
        const batchesRes = await client.query('SELECT id FROM batches WHERE teacher_id = $1 AND instrument_id = $2 LIMIT 1', [TEACHER_ID, INSTRUMENT_ID]);
        const BATCH_ID = batchesRes.rows[0].id;

        for (const m of mapping) {
            console.log(`Cleaning up ${m.name}...`);
            await client.query('BEGIN');

            // 1. Delete NEW student and everything related (cascading normally, but let's be safe)
            await client.query('DELETE FROM attendance_records WHERE student_id = $1', [m.newId]);
            await client.query('DELETE FROM payments WHERE student_id = $1', [m.newId]);
            await client.query('DELETE FROM enrollment_batches WHERE enrollment_id IN (SELECT id FROM enrollments WHERE student_id = $1)', [m.newId]);
            await client.query('DELETE FROM enrollments WHERE student_id = $1', [m.newId]);
            await client.query('DELETE FROM students WHERE id = $1', [m.newId]);

            // 2. Prepare EXISTING student
            // Update metadata
            const totalCredits = m.attended + m.missed + m.pending;
            await client.query(
                `UPDATE students 
         SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{total_credits}', $1::text::jsonb),
             student_type = 'permanent',
             is_active = true
         WHERE id = $2`,
                [totalCredits, m.oldId]
            );

            // Create new enrollment for existing student
            const enrollmentRes = await client.query(
                `INSERT INTO enrollments (student_id, instrument_id, enrolled_on, classes_remaining, status)
         VALUES ($1, $2, $3, $4, 'active')
         RETURNING id`,
                [m.oldId, INSTRUMENT_ID, m.start, m.pending]
            );
            const enrollmentId = enrollmentRes.rows[0].id;

            // Create new enrollment_batch
            await client.query(
                `INSERT INTO enrollment_batches (enrollment_id, batch_id, payment_frequency, classes_remaining, enrolled_on, trinity_grade)
         VALUES ($1, $2, $3, $4, $5, 'Initial')`,
                [enrollmentId, BATCH_ID, m.freq, m.pending, m.start]
            );

            // Create backfill payment for existing student
            await client.query(
                `INSERT INTO payments (student_id, amount, method, metadata, timestamp)
         VALUES ($1, 0, 'manual', $2::jsonb, $3)`,
                [m.oldId, JSON.stringify({
                    backfill: true,
                    credits_bought: totalCredits,
                    instrument_id: INSTRUMENT_ID,
                    payment_frequency: m.freq,
                    notes: 'Credit migration to existing record'
                }), m.start]
            );

            // Create attendance records
            const totalUsed = m.attended + m.missed;
            for (let i = 0; i < totalUsed; i++) {
                await client.query(
                    `INSERT INTO attendance_records (student_id, batch_id, session_date, status, source)
           VALUES ($1, $2, $3, 'present', 'manual')`,
                    [m.oldId, BATCH_ID, m.start]
                );
            }

            await client.query('COMMIT');
            console.log(`Success: ${m.name} merged onto ${m.oldId}`);
        }
    } catch (err) {
        console.error('Cleanup failed:', err);
        if (client) await client.query('ROLLBACK');
    } finally {
        client.release();
        pool.end();
    }
}

cleanup();
