'use strict';

// Batch changes shared by routes/batches.js and the proposal executors.
// Functions take a transaction `client`; the caller owns BEGIN/COMMIT.

const { ServiceError } = require('./serviceError');

// Moves one enrollment from `from_batch_id` to `to_batch_id` (same instrument, with room).
async function moveStudent(client, { enrollment_batch_id, from_batch_id, to_batch_id }) {
  if (!enrollment_batch_id || !from_batch_id || !to_batch_id) {
    throw new ServiceError(400, 'Missing required fields');
  }
  if (from_batch_id === to_batch_id) {
    throw new ServiceError(400, 'Source and target batch are the same');
  }

  // Verify enrollment_batch exists and belongs to from_batch; get student info
  const ebResult = await client.query(`
    SELECT eb.id, e.student_id,
           s.name AS student_name,
           COALESCE(s.phone, s.metadata->>'phone') AS phone,
           s.guardian_contact,
           b_from.instrument_id AS from_instrument_id
    FROM enrollment_batches eb
    JOIN enrollments e ON e.id = eb.enrollment_id
    JOIN students s ON s.id = e.student_id
    JOIN batches b_from ON b_from.id = eb.batch_id
    WHERE eb.id = $1 AND eb.batch_id = $2
  `, [enrollment_batch_id, from_batch_id]);

  if (ebResult.rows.length === 0) throw new ServiceError(404, 'Enrollment not found in source batch');
  const eb = ebResult.rows[0];

  // Verify target batch: same instrument, has capacity
  const targetResult = await client.query(`
    SELECT b.id, b.instrument_id, b.capacity, b.whatsapp_group_link, b.recurrence,
           COUNT(eb2.id) FILTER (WHERE e2.status = 'active') AS current_count
    FROM batches b
    LEFT JOIN enrollment_batches eb2 ON eb2.batch_id = b.id
    LEFT JOIN enrollments e2 ON e2.id = eb2.enrollment_id
    WHERE b.id = $1
    GROUP BY b.id
  `, [to_batch_id]);

  if (targetResult.rows.length === 0) throw new ServiceError(404, 'Target batch not found');
  const target = targetResult.rows[0];

  if (target.instrument_id !== eb.from_instrument_id) {
    throw new ServiceError(400, 'Cannot move student between different instruments');
  }
  if (parseInt(target.current_count) >= target.capacity) {
    throw new ServiceError(400, 'Target batch is at full capacity');
  }

  // Check student not already in target batch
  const dupeCheck = await client.query(`
    SELECT eb.id FROM enrollment_batches eb
    JOIN enrollments e ON e.id = eb.enrollment_id
    WHERE eb.batch_id = $1 AND e.student_id = $2 AND e.status = 'active'
  `, [to_batch_id, eb.student_id]);
  if (dupeCheck.rows.length > 0) throw new ServiceError(400, 'Student is already in the target batch');

  await client.query('UPDATE enrollment_batches SET batch_id = $1 WHERE id = $2', [to_batch_id, enrollment_batch_id]);

  const fromBatch = await client.query('SELECT recurrence, whatsapp_group_link FROM batches WHERE id = $1', [from_batch_id]);

  return {
    success: true,
    student: { id: eb.student_id, name: eb.student_name, phone: eb.phone, guardian_contact: eb.guardian_contact },
    from_batch: { id: from_batch_id, recurrence: fromBatch.rows[0]?.recurrence, whatsapp_group_link: fromBatch.rows[0]?.whatsapp_group_link },
    to_batch: { id: to_batch_id, recurrence: target.recurrence, whatsapp_group_link: target.whatsapp_group_link },
  };
}

module.exports = { moveStudent };
