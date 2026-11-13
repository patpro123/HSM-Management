'use strict';

// Creating a student with their enrollment, batch assignments and first payment. Shared by
// POST /api/students and the enroll.student proposal executor, so both do exactly the same thing.
// The caller owns the transaction.

const { ServiceError } = require('./serviceError');

async function createStudentWithEnrollment(client, body) {
  const { first_name, last_name, email, dob, phone, guardian_name, guardian_phone, address, batches, payment, metadata } = body || {};
  if (!first_name || !last_name) throw new ServiceError(400, 'Missing required fields (first_name, last_name)');

  // Calculate total credits from batches
  let totalCredits = 0;
  if (Array.isArray(batches)) {
    const instrumentFreqs = new Map();
    batches.forEach(b => {
      const key = b.instrument_id || b.batch_id;
      const freq = (b.payment_frequency || 'monthly').toLowerCase();
      instrumentFreqs.set(key, freq);
    });

    instrumentFreqs.forEach(freq => {
      if (freq === 'pbel_4') totalCredits += 4;
      else if (freq === 'trial') totalCredits += 4;
      else if (freq === 'pbel_8') totalCredits += 8;
      else if (freq === 'monthly') totalCredits += 8;
      else if (freq === 'quarterly') totalCredits += 24;
      else if (freq === 'half_yearly') totalCredits += 48;
      else if (freq === 'yearly') totalCredits += 96;
    });
  }

  // Prepare metadata
  const studentMetadata = {
    ...metadata,
    email: email || metadata?.email,
    address: address || metadata?.address,
    guardian_name: guardian_name || metadata?.guardian_name,
    guardian_phone: guardian_phone || metadata?.guardian_phone,
    total_credits: totalCredits
  };

  // Insert student
  const studentResult = await client.query(
    'INSERT INTO students (name, dob, phone, guardian_contact, metadata) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    [
      `${first_name} ${last_name}`,
      dob || null,
      phone || null,
      guardian_name || null,
      JSON.stringify(studentMetadata)
    ]
  );
  const student = studentResult.rows[0];

  // Insert enrollment
  const enrollmentResult = await client.query(
    'INSERT INTO enrollments (student_id, status) VALUES ($1, $2) RETURNING *',
    [student.id, 'active']
  );
  const enrollment = enrollmentResult.rows[0];

  // Validate: max 2 batches per instrument
  if (Array.isArray(batches) && batches.length > 0) {
    const batchIdList = batches.map(b => String(b.batch_id));
    const batchInstrRes = await client.query(
      'SELECT id, instrument_id FROM batches WHERE id = ANY($1)',
      [batchIdList]
    );
    const instrCount = new Map();
    for (const row of batchInstrRes.rows) {
      const iid = String(row.instrument_id);
      instrCount.set(iid, (instrCount.get(iid) || 0) + 1);
    }
    for (const [iid, count] of instrCount) {
      if (count > 2) {
        throw new ServiceError(400, 'A student can be assigned to at most 2 batches per instrument');
      }
    }
  }

  // Insert enrollment_batches
  let enrollmentBatchRows = [];
  if (Array.isArray(batches)) {
    for (const batch of batches) {
      const { batch_id, payment_frequency, classes_remaining, enrolled_on, trinity_grade, fee_structure_id } = batch;

      let initialCredits = classes_remaining || 0;
      let freq = (payment_frequency || 'monthly').toLowerCase();

      if (freq === 'pbel_4') { initialCredits = initialCredits || 4; }
      else if (freq === 'pbel_8') { initialCredits = initialCredits || 8; }
      else if (freq === 'trial') { initialCredits = initialCredits || 4; freq = 'monthly'; }
      else if (!initialCredits && freq === 'monthly') initialCredits = 8;
      else if (!initialCredits && freq === 'quarterly') initialCredits = 24;
      else if (!initialCredits && freq === 'half_yearly') initialCredits = 48;
      else if (!initialCredits && freq === 'yearly') initialCredits = 96;

      const batchResult = await client.query(
        `INSERT INTO enrollment_batches
           (enrollment_id, batch_id, payment_frequency, classes_remaining, enrolled_on, trinity_grade, fee_structure_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
        [
          enrollment.id, batch_id, freq, initialCredits,
          enrolled_on || new Date(),
          trinity_grade || 'Initial',
          fee_structure_id || null
        ]
      );
      enrollmentBatchRows.push(batchResult.rows[0]);
    }
  }

  // Insert payment
  let paymentRow = null;
  if (payment && payment.amount && payment.method) {
    const { amount, method, package_id, transaction_id } = payment;
    const payResult = await client.query(
      'INSERT INTO payments (student_id, package_id, amount, method, transaction_id) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [student.id, package_id || null, amount, method, transaction_id || null]
    );
    paymentRow = payResult.rows[0];
  }

  return { student, enrollment, enrollment_batches: enrollmentBatchRows, payment: paymentRow };
}

module.exports = { createStudentWithEnrollment };
