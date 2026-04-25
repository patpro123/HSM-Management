const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.NEON_CONNECTION || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const TEACHER_ID = '52ecec5f-a40e-43d4-bd6a-0021d0e16e87'; // Subrata Bhaduri
const INSTRUMENT_ID = '78f0b648-4113-4f59-b138-cdd48e52af78'; // Drums
const BRANCH_ID = 'a7c91e4e-4e50-46dc-96f1-45832e786e2f'; // HSM Main (main)

const studentsData = [
    { name: 'Arav', frequency: 'quarterly', attended: 7, missed: 1, pending: 16, start: '2026-04-03', end: '2026-07-03' },
    { name: 'Akshaar', frequency: 'quarterly', attended: 14, missed: 3, pending: 7, start: '2026-02-21', end: '2026-05-21' },
    { name: 'Joseph', frequency: 'quarterly', attended: 33, missed: 10, pending: 5, start: '2025-10-11', end: '2026-04-11' },
    { name: 'Devis', frequency: 'quarterly', attended: 6, missed: 2, pending: 16, start: '2026-03-26', end: '2026-06-26' },
    { name: 'Siddhan', frequency: 'quarterly', attended: 10, missed: 5, pending: 9, start: '2026-02-20', end: '2026-05-20' },
    { name: 'Rishi', frequency: 'monthly', attended: 4, missed: 2, pending: 2, start: '2026-04-02', end: '2026-05-02' },
    { name: 'Vihan choudhuri', frequency: 'quarterly', attended: 14, missed: 2, pending: 8, start: '2026-02-21', end: '2026-05-21' },
    { name: 'B.john wesly', frequency: 'quarterly', attended: 8, missed: 0, pending: 16, start: '2026-03-26', end: '2026-07-01' },
    { name: 'Vishnu vardhan', frequency: 'monthly', attended: 5, missed: 2, pending: 1, start: '2026-04-02', end: '2026-05-02' },
    { name: 'Harini reddy', frequency: 'quarterly', attended: 6, missed: 0, pending: 18, start: '2026-04-04', end: '2026-07-04' },
    { name: 'Arush guhan', frequency: 'quarterly', attended: 4, missed: 1, pending: 19, start: '2026-04-09', end: '2026-07-09' }
];

async function migrate() {
    const client = await pool.connect();
    try {
        const batchesRes = await client.query('SELECT id FROM batches WHERE teacher_id = $1 AND instrument_id = $2 LIMIT 1', [TEACHER_ID, INSTRUMENT_ID]);
        if (batchesRes.rows.length === 0) {
            throw new Error('No batches found for teacher/instrument');
        }
        const BATCH_ID = batchesRes.rows[0].id;

        for (const data of studentsData) {
            console.log(`Processing student: ${data.name}...`);
            await client.query('BEGIN');

            // 1. Create student (Simplified schema)
            const studentRes = await client.query(
                `INSERT INTO students (name, created_at, is_active, student_type)
         VALUES ($1, now(), true, 'permanent')
         RETURNING id`,
                [data.name]
            );
            const studentId = studentRes.rows[0].id;

            // 2. Create enrollment
            const enrollmentRes = await client.query(
                `INSERT INTO enrollments (student_id, instrument_id, enrolled_on, classes_remaining, status)
         VALUES ($1, $2, $3, $4, 'active')
         RETURNING id`,
                [studentId, INSTRUMENT_ID, data.start, data.pending]
            );
            const enrollmentId = enrollmentRes.rows[0].id;

            // 3. Create enrollment_batch
            await client.query(
                `INSERT INTO enrollment_batches (enrollment_id, batch_id, payment_frequency, classes_remaining, enrolled_on, trinity_grade)
         VALUES ($1, $2, $3, $4, $5, 'Initial')`,
                [enrollmentId, BATCH_ID, data.frequency, data.pending, data.start]
            );

            // 4. Create backfill payment
            // For the dynamic calc (total - present = pending), we need:
            // total = attended + missed + pending
            const totalCredits = data.attended + data.missed + data.pending;
            await client.query(
                `INSERT INTO payments (student_id, amount, method, metadata, timestamp)
         VALUES ($1, 0, 'manual', $2::jsonb, $3)`,
                [studentId, JSON.stringify({
                    backfill: true,
                    credits_bought: totalCredits,
                    instrument_id: INSTRUMENT_ID,
                    payment_frequency: data.frequency,
                    notes: 'Initial migration from Bhaduri sir list'
                }), data.start]
            );

            // 5. Create attendance records
            // NOTE: We mark both 'attended' and 'missed' as 'present' in the DB 
            // so the dynamic credit calculation (total - present) correctly results in 'pending'.
            // In HSM system, missed classes are counted as consumed credits.
            const totalUsed = data.attended + data.missed;
            for (let i = 0; i < totalUsed; i++) {
                await client.query(
                    `INSERT INTO attendance_records (student_id, batch_id, session_date, status, source)
           VALUES ($1, $2, $3, 'present', 'manual')`,
                    [studentId, BATCH_ID, data.start]
                );
            }

            // Update student metadata total_credits
            await client.query(
                `UPDATE students 
         SET metadata = jsonb_build_object('total_credits', $1::int)
         WHERE id = $2`,
                [totalCredits, studentId]
            );

            await client.query('COMMIT');
            console.log(`Success: ${data.name} migrated.`);
        }
    } catch (err) {
        console.error('Migration failed:', err);
        if (client) await client.query('ROLLBACK');
    } finally {
        client.release();
        pool.end();
    }
}

migrate();
