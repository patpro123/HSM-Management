'use strict';

// Payment recording shared by routes/payments.js and the proposal executors.
// Takes a transaction `client`; the caller owns BEGIN/COMMIT.

const { assignReceiptNumber } = require('./receiptService');
const { ServiceError } = require('./serviceError');

// What a package id stands for. It may be a packages.id or a fee_structures.id (the modern
// picker); the payments FK only references packages, so the caller needs to know which.
async function lookupPackage(db, packageId) {
  if (!packageId) return null;
  const pkg = await db.query('SELECT id, classes_count, instrument_id FROM packages WHERE id = $1', [packageId]);
  if (pkg.rows[0]) return { ...pkg.rows[0], isPackage: true };
  const fs = await db.query('SELECT id, classes_count, instrument_id FROM fee_structures WHERE id = $1', [packageId]);
  return fs.rows[0] ? { ...fs.rows[0], isPackage: false } : null;
}

// The instrument a payment is for, from the most specific hint down to the student's own
// enrollment. Null when it can't be told, e.g. a student in several instruments paying with
// no batch and no package.
async function resolveInstrumentId(client, { student_id, batch_id, instrument_id, pkg }) {
  if (batch_id) {
    const b = await client.query('SELECT instrument_id FROM batches WHERE id = $1', [batch_id]);
    if (b.rows[0]) return b.rows[0].instrument_id;
  }
  if (instrument_id) {
    const i = await client.query('SELECT id FROM instruments WHERE id = $1', [instrument_id]);
    if (i.rows[0]) return i.rows[0].id;
  }
  if (pkg?.instrument_id) return pkg.instrument_id;

  const enrolled = await client.query(`
    SELECT DISTINCT b.instrument_id
    FROM enrollments e
    JOIN enrollment_batches eb ON eb.enrollment_id = e.id
    JOIN batches b ON b.id = eb.batch_id
    WHERE e.student_id = $1 AND e.status = 'active'
  `, [student_id]);
  return enrolled.rows.length === 1 ? enrolled.rows[0].instrument_id : null;
}

async function recordPayment(client, body, recordedBy) {
  const { student_id, batch_id, instrument_id, amount, payment_method, payment_for, notes, class_credits, payment_frequency, payment_date, package_id, location } = body;

  if (!student_id || !amount) throw new ServiceError(400, 'Student and amount are required');

  const pkg = await lookupPackage(client, package_id);

  // Callers that name a package but no credit count (the chat) get the package's own class count.
  // An explicit count, including 0, is respected.
  const creditsGiven = class_credits !== undefined && class_credits !== null && class_credits !== '';
  const creditsToAdd = creditsGiven ? parseInt(class_credits) || 0 : (pkg?.classes_count || 0);
  let targetBatchId = batch_id;

  const resolvedInstrumentId = await resolveInstrumentId(client, { student_id, batch_id, instrument_id, pkg });
  if (creditsToAdd !== 0 && !resolvedInstrumentId) {
    throw new ServiceError(400, 'Which instrument is this payment for? Select a batch or a package for it.');
  }

  const metadata = {
    payment_for,
    notes,
    payment_frequency,
    credits_bought: creditsToAdd,
    ...(resolvedInstrumentId ? { instrument_id: resolvedInstrumentId } : {}),
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

  // The payments FK only references packages. A fee_structures id is kept in metadata instead,
  // so it isn't lost.
  let resolvedPackageId = null;
  if (package_id) {
    if (pkg?.isPackage) resolvedPackageId = package_id;
    else metadata.fee_structure_id = package_id;
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

module.exports = { recordPayment, lookupPackage };
