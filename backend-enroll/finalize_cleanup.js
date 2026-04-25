const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
    connectionString: process.env.NEON_CONNECTION || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

const merges = [
    {
        student: 'Raj praneeth A', keepId: 'da20af29-cc58-4d4a-9f43-999e4b481857', deleteIds: [
            '20ff818b-0c78-40bf-a1ff-8752b8560311', '42e821cc-f79c-4ce0-8f51-fa51cbbb5f73', 'cc2ed6bd-c5be-4afa-aff8-e4552e0f0ec1',
            'e3e4b831-c08a-479a-ab09-2fd0deef7387', 'e7cd12c4-f039-4870-b29d-d88f727dc2fc', '221c6235-98c9-448a-ac52-d424315f6610',
            '3a0b8f94-f35d-494a-8bc7-317e2231682a', '0f466a04-f3cd-4a41-b222-8c223132d083', '9a4c63c6-b23d-4307-9890-e4f3e8344b0a'
        ]
    },
    {
        student: 'Arav bhatra', keepId: '783b322f-563e-461c-8f66-9d27938daac1', deleteIds: [
            '2f98aca9-a276-4a44-957d-9e1cee1eea78' // Aarav bhatra
        ]
    },
    {
        student: 'Aarush Guhan', keepId: '0d3542da-1022-4845-8dce-7d85e7b5dca7', deleteIds: [
            'b29da33b-af68-4843-a49a-a9c929f9996a', // Aarush Ghuhan
            '4060e43c-68d7-4c58-a25c-4d45375715f2', // Sai arush
            '06f64902-8d3c-4193-9e15-8ce19353d7be'  // Sai arush y
        ]
    },
    {
        student: 'B.VishnuVardhan B', keepId: 'f97e252e-ee8b-4625-b90e-c21ca88ae9ae', deleteIds: [
            '8d4d19a4-9268-4c56-a873-5dc08a5dd737' // Vishnuvardhana A
        ]
    }
];

async function finalizeCleanup() {
    const client = await pool.connect();
    try {
        for (const m of merges) {
            console.log(`Finalizing merge for ${m.student}...`);
            await client.query('BEGIN');

            for (const delId of m.deleteIds) {
                console.log(`  Merging ${delId} into ${m.keepId}...`);

                // Move data
                await client.query('UPDATE payments SET student_id = $1 WHERE student_id = $2', [m.keepId, delId]);
                await client.query('UPDATE attendance_records SET student_id = $1 WHERE student_id = $2', [m.keepId, delId]);
                await client.query('UPDATE student_documents SET student_id = $1 WHERE student_id = $2', [m.keepId, delId]);
                await client.query('UPDATE student_evaluations SET student_id = $1 WHERE student_id = $2', [m.keepId, delId]);
                await client.query('UPDATE student_guardians SET student_id = $1 WHERE student_id = $2', [m.keepId, delId]);

                // Delete enrollments and student record
                await client.query('DELETE FROM enrollment_batches WHERE enrollment_id IN (SELECT id FROM enrollments WHERE student_id = $1)', [delId]);
                await client.query('DELETE FROM enrollments WHERE student_id = $1', [delId]);
                await client.query('DELETE FROM students WHERE id = $1', [delId]);
            }

            // Recalculate total_credits for the keepId student from their merged payments
            const creditsRes = await client.query(`
        SELECT SUM(
          COALESCE((p.metadata->>'credits_bought')::int, 
          COALESCE(pkg.classes_count, 0))
        ) as total
        FROM payments p
        LEFT JOIN packages pkg ON p.package_id = pkg.id
        WHERE p.student_id = $1
      `, [m.keepId]);
            const newTotal = parseInt(creditsRes.rows[0].total) || 0;

            await client.query(
                `UPDATE students 
         SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{total_credits}', $1::text::jsonb)
         WHERE id = $2`,
                [newTotal, m.keepId]
            );

            await client.query('COMMIT');
            console.log(`Success: Merged ${m.student}`);
        }
    } catch (err) {
        console.error('Finalize cleanup failed:', err);
        if (client) await client.query('ROLLBACK');
    } finally {
        client.release();
        pool.end();
    }
}

finalizeCleanup();
