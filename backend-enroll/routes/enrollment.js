const express = require('express');
const router = express.Router();
const pool = require('../db');
const rbac = require('../auth/rbacMiddleware');

// POST /api/enroll - atomic enrollment (student + enrollment + batch assignments + payments)
router.post('/enroll', async (req, res) => {
  console.log('--- NEW ENROLLMENT REQUEST ---');
  console.log('Received payload:', JSON.stringify(req.body, null, 2));

  const payload = req.body;
  if (!payload || !payload.answers) return res.status(400).json({ error: 'invalid payload' });

  const { firstName, lastName, email, dob, address, guardianName, telephone, streams, dateOfJoining } = payload.answers;
  if (!firstName || !lastName || !email || !dob || !address || !guardianName || !telephone || !Array.isArray(streams) || streams.length === 0 || !dateOfJoining) {
    return res.status(422).json({ error: 'missing required fields' });
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(422).json({ error: 'invalid email' });
  }
  if (!/^\+?[1-9]\d{0,2}[\s-]?\(?\d{1,4}\)?[\s-]?\d{1,4}[\s-]?\d{1,4}[\s-]?\d{1,9}$/.test(telephone)) {
    return res.status(422).json({ error: 'invalid telephone number' });
  }

  const allowedPayments = ['Monthly', 'Quarterly'];
  for (const s of streams) {
    if (!s || typeof s.instrument !== 'string') return res.status(422).json({ error: 'invalid stream object' });
    if (!s.batch || typeof s.batch !== 'string') return res.status(422).json({ error: 'invalid batch' });
    if (!s.payment || !allowedPayments.includes(s.payment)) return res.status(422).json({ error: 'invalid payment option' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const instrumentCache = new Map();
    const resolveInstrument = async (instrumentNameRaw) => {
      const instrumentName = (instrumentNameRaw || '').trim();
      const cacheKey = instrumentName.toLowerCase();
      if (instrumentCache.has(cacheKey)) return instrumentCache.get(cacheKey);

      const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
      let row = null;

      if (uuidRegex.test(instrumentName)) {
        const byId = await client.query('SELECT id, name FROM instruments WHERE id = $1 LIMIT 1', [instrumentName]);
        row = byId.rows[0];
      }

      if (!row) {
        const byExact = await client.query(
          'SELECT id, name FROM instruments WHERE LOWER(name) = LOWER($1) LIMIT 1',
          [instrumentName]
        );
        row = byExact.rows[0];
      }
      if (!row) {
        const byPartial = await client.query(
          'SELECT id, name FROM instruments WHERE name ILIKE $1 LIMIT 1',
          [`%${instrumentName}%`]
        );
        row = byPartial.rows[0];
      }
      if (!row) {
        throw new Error(`Instrument not found: ${instrumentName}`);
      }
      instrumentCache.set(cacheKey, row);
      return row;
    };

    // 1. Insert student
    const fullName = `${firstName.trim()} ${lastName.trim()}`;
    const metadata = { email, address };
    const studentInsert = await client.query(
      `INSERT INTO students (name, dob, phone, guardian_contact, email, metadata)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [fullName, dob, telephone, guardianName, email, JSON.stringify(metadata)]
    );
    const studentId = studentInsert.rows[0].id;

    // 2. Create one enrollment record per student
    const firstStream = streams[0];
    const firstInstrument = await resolveInstrument(firstStream.instrument.trim());
    const enrollmentRes = await client.query(
      `INSERT INTO enrollments (student_id, instrument_id, status, classes_remaining, enrolled_on)
       VALUES ($1, $2, 'active', 0, $3) RETURNING id`,
      [studentId, firstInstrument.id, dateOfJoining]
    );
    const enrollmentId = enrollmentRes.rows[0].id;

    let totalClasses = 0;

    // 3. Process each stream and create enrollment_batch records + payments
    for (const stream of streams) {
      const instrumentName = stream.instrument.trim();
      const batchRecurrence = stream.batch.trim();
      const paymentType = stream.payment;

      const instrumentRow = await resolveInstrument(instrumentName);
      const instrumentId = instrumentRow.id;

      const packageRes = await client.query(
        'SELECT id, classes_count, price FROM packages WHERE instrument_id = $1 AND name ILIKE $2 LIMIT 1',
        [instrumentId, `%${paymentType}%`]
      );
      if (packageRes.rows.length === 0) {
        throw new Error(`Package not found for: ${instrumentName} - ${paymentType}`);
      }
      const packageId = packageRes.rows[0].id;
      const classesCount = packageRes.rows[0].classes_count;
      const amount = packageRes.rows[0].price;

      totalClasses += classesCount;

      const batchRes = await client.query(
        'SELECT id FROM batches WHERE instrument_id = $1 AND recurrence ILIKE $2 LIMIT 1',
        [instrumentId, `%${batchRecurrence}%`]
      );
      if (batchRes.rows.length === 0) {
        throw new Error(`Batch not found for ${instrumentName} with recurrence: ${batchRecurrence}`);
      }
      const batchId = batchRes.rows[0].id;

      await client.query(
        'INSERT INTO enrollment_batches (enrollment_id, batch_id, classes_remaining, payment_frequency) VALUES ($1, $2, $3, $4)',
        [enrollmentId, batchId, classesCount, paymentType]
      );

      await client.query(
        `INSERT INTO payments (student_id, package_id, amount, method, transaction_id, metadata)
         VALUES ($1, $2, $3, 'pending', NULL, $4)`,
        [studentId, packageId, amount, JSON.stringify({ instrument: instrumentName, payment_type: paymentType })]
      );
    }

    // 4. Update enrollment classes_remaining to total
    await client.query(
      'UPDATE enrollments SET classes_remaining = $1 WHERE id = $2',
      [totalClasses, enrollmentId]
    );

    // 5. Update student metadata with total_credits
    await client.query(
      `UPDATE students
       SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{total_credits}', to_jsonb($1::int))
       WHERE id = $2`,
      [totalClasses, studentId]
    );

    await client.query('COMMIT');
    return res.status(201).json({ ok: true, studentId, enrollmentId, message: 'Enrollment successful' });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Enrollment error:', err);
    return res.status(500).json({ error: err.message || 'Failed to store enrollment' });
  } finally {
    client.release();
  }
});

// GET /api/enrollments - all enrollments with batch details
router.get('/enrollments', rbac.filterTeacherData, async (req, res) => {
  try {
    let queryArgs = [];
    let teacherFilter = '';
    let teacherJoin = '';

    if (req.dataFilter && req.dataFilter.isTeacher) {
      if (!req.dataFilter.teacherId) {
        return res.json({ enrollments: [] });
      }
      teacherJoin = `
        INNER JOIN enrollment_batches eb_filter ON e.id = eb_filter.enrollment_id
        INNER JOIN batches b_filter ON eb_filter.batch_id = b_filter.id
      `;
      teacherFilter = `AND b_filter.teacher_id = $1`;
      queryArgs.push(req.dataFilter.teacherId);
    }

    const result = await pool.query(`
      WITH student_credits AS (
        SELECT p.student_id,
          SUM(
            CASE
              WHEN (p.metadata->>'credits_bought') IS NOT NULL
                   AND (p.metadata->>'credits_bought')::int > 0
                THEN (p.metadata->>'credits_bought')::int
              WHEN pkg.classes_count IS NOT NULL THEN pkg.classes_count
              ELSE 0
            END
          ) AS total_credits
        FROM payments p
        LEFT JOIN packages pkg ON p.package_id = pkg.id
        GROUP BY p.student_id
      ),
      student_attended AS (
        SELECT student_id, COUNT(*) AS total
        FROM attendance_records WHERE status = 'present'
        GROUP BY student_id
      )
      SELECT
        s.id as student_id,
        s.name,
        s.dob,
        s.phone,
        s.guardian_contact,
        s.metadata,
        s.is_active,
        e.id as enrollment_id,
        e.status,
        GREATEST(0, COALESCE(sc.total_credits, 0) - COALESCE(sa.total, 0)) AS classes_remaining,
        e.enrolled_on,
        COALESCE(
          json_agg(
            json_build_object(
              'batch_id', b.id,
              'instrument_id', i.id,
              'instrument', i.name,
              'batch_recurrence', b.recurrence,
              'teacher_id', t.id,
              'teacher', t.name,
              'start_time', b.start_time,
              'end_time', b.end_time,
              'payment_frequency', eb.payment_frequency,
              'enrolled_on', COALESCE(eb.enrolled_on, e.enrolled_on)
            )
            ORDER BY i.name, b.recurrence
          ) FILTER (WHERE b.id IS NOT NULL),
          '[]'::json
        ) as batches
      FROM students s
      LEFT JOIN enrollments e ON s.id = e.student_id
      ${teacherJoin}
      LEFT JOIN enrollment_batches eb ON e.id = eb.enrollment_id
      LEFT JOIN batches b ON eb.batch_id = b.id
      LEFT JOIN instruments i ON b.instrument_id = i.id
      LEFT JOIN teachers t ON b.teacher_id = t.id
      LEFT JOIN student_credits sc ON sc.student_id = s.id
      LEFT JOIN student_attended sa ON sa.student_id = s.id
      WHERE (s.student_type = 'permanent' OR s.student_type IS NULL) ${teacherFilter}
      GROUP BY s.id, s.name, s.dob, s.phone, s.guardian_contact, s.metadata, s.is_active, e.id, e.status, sc.total_credits, sa.total, e.enrolled_on
      ORDER BY s.name ASC
    `, queryArgs);
    res.json({ enrollments: result.rows });
  } catch (err) {
    console.error('Get enrollments error:', err);
    res.status(500).json({ error: 'Failed to fetch enrollments' });
  }
});

module.exports = router;
