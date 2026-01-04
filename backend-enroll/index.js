require('dotenv').config()
const express = require('express')
const cors = require('cors')
const morgan = require('morgan')
const pool = require('./db')

const app = express()
app.use(cors())
app.use(express.json())
app.use(morgan('dev'))

// GET /api/instruments - fetch all instruments for checkbox display
app.get('/api/instruments', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM instruments ORDER BY name')
    res.json({ instruments: result.rows })
  } catch (err) {
    console.error('Get instruments error:', err)
    res.status(500).json({ error: 'Failed to fetch instruments' })
  }
})

// GET /api/batches - fetch all batches with instrument and teacher details
app.get('/api/batches', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        b.id,
        b.recurrence,
        b.start_time,
        b.end_time,
        b.capacity,
        b.is_makeup,
        i.id as instrument_id,
        i.name as instrument_name,
        t.id as teacher_id,
        t.name as teacher_name
      FROM batches b
      JOIN instruments i ON b.instrument_id = i.id
      LEFT JOIN teachers t ON b.teacher_id = t.id
      WHERE b.is_makeup = false
      ORDER BY i.name, b.recurrence
    `)
    res.json({ batches: result.rows })
  } catch (err) {
    console.error('Get batches error:', err)
    res.status(500).json({ error: 'Failed to fetch batches' })
  }
})

// GET /api/batches/:instrumentId - fetch batches for a specific instrument
app.get('/api/batches/:instrumentId', async (req, res) => {
  const { instrumentId } = req.params
  // UUID v4 regex (simple check)
  const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
  if (!instrumentId || !uuidRegex.test(instrumentId)) {
    console.warn('Invalid instrumentId param:', instrumentId)
    return res.status(400).json({ error: 'Invalid instrumentId parameter' })
  }
  try {
    console.log('Fetching batches for instrumentId:', instrumentId)
    const result = await pool.query(`
      SELECT 
        b.id,
        b.recurrence,
        b.start_time,
        b.end_time,
        b.capacity,
        b.is_makeup,
        i.name as instrument_name,
        t.id as teacher_id,
        t.name as teacher_name
      FROM batches b
      JOIN instruments i ON b.instrument_id = i.id
      LEFT JOIN teachers t ON b.teacher_id = t.id
      WHERE b.instrument_id = $1 AND b.is_makeup = false
      ORDER BY b.recurrence
    `, [instrumentId])
    res.json({ batches: result.rows })
  } catch (err) {
    console.error('Get batches by instrument error:', err)
    res.status(500).json({ error: 'Failed to fetch batches' })
  }
})

app.post('/api/enroll', async (req, res) => {
  const payload = req.body
  if(!payload || !payload.answers) return res.status(400).json({error: 'invalid payload'})

  // Basic validation (required fields)
  const { firstName, lastName, email, dob, address, guardianName, telephone, streams, dateOfJoining } = payload.answers
  if(!firstName || !lastName || !email || !dob || !address || !guardianName || !telephone || !Array.isArray(streams) || streams.length === 0 || !dateOfJoining) {
    return res.status(422).json({ error: 'missing required fields' })
  }
  if(!/^\S+@\S+\.\S+$/.test(email)){
    return res.status(422).json({ error: 'invalid email' })
  }
  if(!/^\+?[1-9]\d{0,2}[\s-]?\(?\d{1,4}\)?[\s-]?\d{1,4}[\s-]?\d{1,4}[\s-]?\d{1,9}$/.test(telephone)){
    return res.status(422).json({ error: 'invalid telephone number' })
  }
  
  const allowedPayments = ['Monthly','Quarterly']
  for(const s of streams){
    if(!s || typeof s.instrument !== 'string') return res.status(422).json({ error: 'invalid stream object' })
    if(!s.batch || typeof s.batch !== 'string') return res.status(422).json({ error: 'invalid batch' })
    if(!s.payment || !allowedPayments.includes(s.payment)) return res.status(422).json({ error: 'invalid payment option' })
  }

  const client = await pool.connect()
  try{
    await client.query('BEGIN')

    // 1. Insert student
    const fullName = `${firstName.trim()} ${lastName.trim()}`
    const metadata = { email, address }
    const studentInsert = await client.query(
      `INSERT INTO students (name, dob, phone, guardian_contact, metadata) 
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [fullName, dob, telephone, guardianName, JSON.stringify(metadata)]
    )
    const studentId = studentInsert.rows[0].id

    // 2. Create ONE enrollment record per student (not per instrument)
    const enrollmentRes = await client.query(
      `INSERT INTO enrollments (student_id, instrument_id, status, classes_remaining, enrolled_on)
       VALUES ($1, NULL, 'active', 0, $2) RETURNING id`,
      [studentId, dateOfJoining]
    )
    const enrollmentId = enrollmentRes.rows[0].id

    let totalClasses = 0

    // 3. Process each stream and create enrollment_batch records + payments
    for(const stream of streams) {
      const instrumentName = stream.instrument.trim()
      const batchRecurrence = stream.batch.trim()
      const paymentType = stream.payment

      // Get instrument_id by name
      const instrumentRes = await client.query(
        'SELECT id FROM instruments WHERE name = $1',
        [instrumentName]
      )
      if(instrumentRes.rows.length === 0) {
        throw new Error(`Instrument not found: ${instrumentName}`)
      }
      const instrumentId = instrumentRes.rows[0].id

      // Get package by instrument and payment type
      const packagePattern = `${instrumentName} - ${paymentType}%`
      const packageRes = await client.query(
        'SELECT id, classes_count, price FROM packages WHERE name LIKE $1',
        [packagePattern]
      )
      if(packageRes.rows.length === 0) {
        throw new Error(`Package not found for: ${instrumentName} - ${paymentType}`)
      }
      const packageId = packageRes.rows[0].id
      const classesCount = packageRes.rows[0].classes_count
      const amount = packageRes.rows[0].price

      totalClasses += classesCount

      // Find batch by recurrence matching
      const batchRes = await client.query(
        'SELECT id FROM batches WHERE instrument_id = $1 AND recurrence = $2',
        [instrumentId, batchRecurrence]
      )
      if(batchRes.rows.length === 0) {
        throw new Error(`Batch not found for ${instrumentName} with recurrence: ${batchRecurrence}`)
      }
      const batchId = batchRes.rows[0].id

      // Link enrollment to batch (creates enrollment_batch record)
      await client.query(
        'INSERT INTO enrollment_batches (enrollment_id, batch_id) VALUES ($1, $2)',
        [enrollmentId, batchId]
      )

      // Create payment record
      await client.query(
        `INSERT INTO payments (student_id, package_id, amount, method, transaction_id, metadata)
         VALUES ($1, $2, $3, 'pending', NULL, $4)`,
        [studentId, packageId, amount, JSON.stringify({ instrument: instrumentName, payment_type: paymentType })]
      )
    }

    // 4. Update enrollment classes_remaining to total
    await client.query(
      'UPDATE enrollments SET classes_remaining = $1 WHERE id = $2',
      [totalClasses, enrollmentId]
    )

    await client.query('COMMIT')
    return res.status(201).json({ ok: true, studentId, enrollmentId, message: 'Enrollment successful' })
  }catch(err){
    await client.query('ROLLBACK')
    console.error('Enrollment error:', err)
    return res.status(500).json({ error: err.message || 'Failed to store enrollment' })
  }finally{
    client.release()
  }
})

app.get('/api/enrollments', async (req, res)=>{
  try{
    const result = await pool.query(`
      SELECT 
        s.id as student_id,
        s.name,
        s.dob,
        s.phone,
        s.guardian_contact,
        s.metadata,
        e.id as enrollment_id,
        e.status,
        e.classes_remaining,
        e.enrolled_on,
        json_agg(json_build_object(
          'batch_id', b.id,
          'instrument', i.name,
          'batch_recurrence', b.recurrence,
          'teacher', t.name,
          'start_time', b.start_time,
          'end_time', b.end_time
        )) as batches
      FROM students s
      JOIN enrollments e ON s.id = e.student_id
      LEFT JOIN enrollment_batches eb ON e.id = eb.enrollment_id
      LEFT JOIN batches b ON eb.batch_id = b.id
      LEFT JOIN instruments i ON b.instrument_id = i.id
      LEFT JOIN teachers t ON b.teacher_id = t.id
      GROUP BY s.id, s.name, s.dob, s.phone, s.guardian_contact, s.metadata, e.id, e.status, e.classes_remaining, e.enrolled_on
      ORDER BY e.created_at DESC
    `)
    res.json({ enrollments: result.rows })
  }catch(err){
    console.error('Get enrollments error:', err)
    res.status(500).json({ error: 'Failed to fetch enrollments' })
  }
})

const PORT = process.env.PORT || 3000
app.listen(PORT, ()=> console.log(`Enroll API listening on http://localhost:${PORT}`))
