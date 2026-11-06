// Hindustani Vocals runs once a week, on Saturday. A second batch with a bad end time
// ('SAT 16:30-16:00') duplicated the real one ('SAT 16:30-17:30'), so students were enrolled in
// both and each Saturday class was marked, and deducted, twice.
//
// This folds the duplicate batch into the real one:
//   - an enrollment in both batches keeps only the real one;
//   - an enrollment only in the duplicate is moved to the real batch;
//   - an attendance row on the duplicate is deleted when the student already has a row for that
//     date on the real batch (same status), moved to the real batch when they do not, and
//     reported, not touched, when the two disagree.
// The duplicate batch itself is left in place, empty, to be retired from the Batch Manager.
//
// Dry run by default: prints the plan and writes nothing. Pass --apply to commit it.
//   node fix_hindustani_duplicate_batch.js            # plan only
//   node fix_hindustani_duplicate_batch.js --apply    # do it, in one transaction

require('dotenv').config();
const { Pool } = require('pg');

const APPLY = process.argv.includes('--apply');
const url = process.env.NEON_CONNECTION || process.env.DATABASE_URL;
const pool = new Pool({ connectionString: url, ssl: /sslmode=require/.test(url || '') ? { rejectUnauthorized: false } : false });

const REAL = 'SAT 16:30-17:30';
const DUPLICATE = 'SAT 16:30-16:00';

async function main() {
  console.log(`Database host: ${new URL(url).host}`);
  console.log(APPLY ? 'MODE: APPLY (will commit)\n' : 'MODE: dry run (read-only, nothing is written)\n');

  const client = await pool.connect();
  try {
    await client.query(APPLY ? 'BEGIN' : 'BEGIN READ ONLY');

    const b = await client.query(
      `SELECT b.id, b.recurrence FROM batches b JOIN instruments i ON i.id = b.instrument_id
        WHERE i.name = 'Hindustani Vocals' AND b.recurrence = ANY($1)`, [[REAL, DUPLICATE]]);
    const real = b.rows.find(r => r.recurrence === REAL);
    const dup = b.rows.find(r => r.recurrence === DUPLICATE);
    if (!real || !dup) throw new Error(`Expected both batches '${REAL}' and '${DUPLICATE}' under Hindustani Vocals; found ${b.rows.map(r => r.recurrence).join(', ') || 'none'}`);

    const enr = await client.query(
      `SELECT eb.id AS eb_id, eb.enrollment_id, s.name,
              EXISTS (SELECT 1 FROM enrollment_batches r WHERE r.enrollment_id = eb.enrollment_id AND r.batch_id = $2) AS has_real
         FROM enrollment_batches eb
         JOIN enrollments e ON e.id = eb.enrollment_id JOIN students s ON s.id = e.student_id
        WHERE eb.batch_id = $1 ORDER BY s.name`, [dup.id, real.id]);
    const drop = enr.rows.filter(r => r.has_real);
    const move = enr.rows.filter(r => !r.has_real);

    const att = await client.query(
      `SELECT a.id, s.name, a.session_date::date::text AS date, a.status::text AS status, a.is_extra,
              r.id AS real_id, r.status::text AS real_status
         FROM attendance_records a JOIN students s ON s.id = a.student_id
         LEFT JOIN attendance_records r ON r.batch_id = $2 AND r.student_id = a.student_id
              AND r.session_date = a.session_date AND r.is_extra = a.is_extra
        WHERE a.batch_id = $1 ORDER BY s.name, a.session_date`, [dup.id, real.id]);
    const delRows = att.rows.filter(r => r.real_id && r.real_status === r.status);
    const conflict = att.rows.filter(r => r.real_id && r.real_status !== r.status);
    const moveRows = att.rows.filter(r => !r.real_id);

    console.log(`Enrollments on '${DUPLICATE}': ${enr.rows.length}`);
    console.log(`  also in '${REAL}', duplicate enrollment removed: ${drop.length}  [${drop.map(r => r.name).join(', ')}]`);
    console.log(`  only in the duplicate, moved to '${REAL}':        ${move.length}  [${move.map(r => r.name).join(', ')}]`);
    console.log(`Attendance rows on '${DUPLICATE}': ${att.rows.length}`);
    console.log(`  same class already on the real batch, deleted: ${delRows.length}`);
    console.log(`  not on the real batch, moved:                  ${moveRows.length}`);
    console.log(`  status disagrees, left for you to review:      ${conflict.length}`);
    for (const r of conflict) console.log(`    ${r.name} ${r.date}: duplicate says ${r.status}, real says ${r.real_status}`);

    const tt = await client.query(`SELECT to_regclass('teacher_attendance') AS t`);
    if (tt.rows[0].t) {
      const n = await client.query('SELECT count(*)::int AS n FROM teacher_attendance WHERE batch_id = $1', [dup.id]);
      console.log(`Teacher-attendance rows on the duplicate batch (not changed): ${n.rows[0].n}`);
    }

    if (APPLY) {
      if (delRows.length) await client.query('DELETE FROM attendance_records WHERE id = ANY($1)', [delRows.map(r => r.id)]);
      if (moveRows.length) await client.query('UPDATE attendance_records SET batch_id = $1 WHERE id = ANY($2)', [real.id, moveRows.map(r => r.id)]);
      if (drop.length) await client.query('DELETE FROM enrollment_batches WHERE id = ANY($1)', [drop.map(r => r.eb_id)]);
      if (move.length) await client.query('UPDATE enrollment_batches SET batch_id = $1 WHERE id = ANY($2)', [real.id, move.map(r => r.eb_id)]);
      await client.query('COMMIT');
      console.log('\nCommitted.');
    } else {
      await client.query('ROLLBACK');
      console.log('\nDry run only. Re-run with --apply to commit.');
    }
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Failed, rolled back:', err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

main();
