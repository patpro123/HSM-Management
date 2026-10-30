'use strict';

// Payment recording shared by routes/payments.js and the proposal executors.
// Takes a transaction `client`; the caller owns BEGIN/COMMIT.

const { assignReceiptNumber } = require('./receiptService');
const { ServiceError } = require('./serviceError');

async function recordPayment(client, body, recordedBy) {
  const { student_id, batch_id, amount, payment_method, payment_for, notes, class_credits, payment_frequency, payment_date, package_id, location } = body;

  if (!student_id || !amount) throw new ServiceError(400, 'Student and amount are required');

  const creditsToAdd = class_credits ? parseInt(class_credits) : 0;
  let targetBatchId = batch_id;

  const metadata = {
    payment_for,
    notes,
    payment_frequency,
    credits_bought: creditsToAdd,
    ...(location ? { location } : {}),
  };

  // Auto-detect batch if not provided and we have credits to add
  if (creditsToAdd !== 0 && !targetBatchId) {
    const batchRes = await client.query(`
      SELECT eb.batch_id
      FROM enrollment_batches eb
      JOIN enrollments e ON eb.enrollment_id = e.id
      WHERE e.student_id = $1 AND e.status = 'active'
    `, [student_id]);

    if (batchRes.rows.length === 1) {
      targetBatchId = batchRes.rows[0].batch_id;
      console.log(`[Payment] Auto-detected batch ${targetBatchId} for student ${student_id}`);
    }
  }

  // Record which batch this payment was for, so receipts can show instrument + teacher later
  if (targetBatchId) metadata.batch_id = targetBatchId;

  // package_id may be a fee_structures.id (from the modern packages endpoint) rather than
  // a packages.id. The payments FK only references packages, so we must verify before inserting.
  let resolvedPackageId = null;
  if (package_id) {
    const pkgCheck = await client.query('SELECT id FROM packages WHERE id = $1', [package_id]);
    if (pkgCheck.rows.length > 0) {
      resolvedPackageId = package_id;
    } else {
      // It came from fee_structures — store the reference in metadata so it isn't lost
      metadata.fee_structure_id = package_id;
    }
  }

  const paymentRes = await client.query(
    `INSERT INTO payments (student_id, package_id, amount, method, metadata, timestamp, recorded_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING *`,
    [student_id, resolvedPackageId, amount, payment_method, JSON.stringify(metadata), payment_date || new Date(), recordedBy || null]
  );

  // Auto-assign a financial-year-scoped receipt number right away
  const receiptNumber = await assignReceiptNumber(client, paymentRes.rows[0].id, paymentRes.rows[0].timestamp);

  // Add purchased credits to the student's total
  if (creditsToAdd !== 0) {
    await client.query(
      `UPDATE students
       SET metadata = jsonb_set(
         COALESCE(metadata, '{}'::jsonb),
         '{total_credits}',
         (COALESCE((metadata->>'total_credits')::int, 0) + $1)::text::jsonb
       )
       WHERE id = $2`,
      [creditsToAdd, student_id]
    );
  }

  // Add them to the batch balance too, when a batch is known
  if (creditsToAdd !== 0 && targetBatchId) {
    const updateRes = await client.query(
      `UPDATE enrollment_batches eb
       SET classes_remaining = COALESCE(eb.classes_remaining, 0) + $1
       FROM enrollments e
       WHERE eb.enrollment_id = e.id AND e.student_id = $2 AND eb.batch_id = $3
       RETURNING eb.classes_remaining`,
      [creditsToAdd, student_id, targetBatchId]
    );
    console.log(`[Payment] Updated batch ${targetBatchId} credits. New balance:`, updateRes.rows[0]?.classes_remaining);
  }

  return { payment: { ...paymentRes.rows[0], receipt_number: receiptNumber, recorded_by: recordedBy || null } };
}

module.exports = { recordPayment };
