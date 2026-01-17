require('dotenv').config()
const express = require('express')
const cors = require('cors')
const morgan = require('morgan')
const crypto = require('crypto')
const http = require('http')
const https = require('https')
const pool = require('./db')

const app = express()

// CORS configuration - allow frontend from Vercel and localhost
const corsOptions = {
  origin: [
    'https://hsm-management.vercel.app',
    'https://hsm-management-git-main-parthoprotim-mukherjees-projects.vercel.app',
    /\.vercel\.app$/, // Allow all Vercel preview deployments
    'http://localhost:5173',
    'http://localhost:3000'
  ],
  credentials: true,
  optionsSuccessStatus: 200
}

app.use(cors(corsOptions))
app.use(express.json())
app.use(morgan('dev'))

// Conversational enrollment agent state and helpers
const enrollmentSessions = new Map()
const REQUIRED_FIELDS = ['fullName', 'dob', 'phone', 'guardianContact', 'instruments', 'dateOfJoining']
const PAYMENT_OPTIONS = ['Monthly', 'Quarterly']
const LLM_PROVIDER = process.env.LLM_PROVIDER || 'ollama'
const OLLAMA_HOST = process.env.OLLAMA_HOST || 'http://localhost:11434'
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3'

const safeJsonExtract = (text) => {
  if (!text || typeof text !== 'string') return null
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start === -1 || end === -1 || end <= start) return null
  try {
    return JSON.parse(text.slice(start, end + 1))
  } catch (err) {
    console.warn('Failed to parse JSON from LLM response')
    return null
  }
}

const postJson = (urlString, payload) => new Promise((resolve, reject) => {
  const url = new URL(urlString)
  const isHttps = url.protocol === 'https:'
  const body = JSON.stringify(payload)
  const options = {
    method: 'POST',
    hostname: url.hostname,
    port: url.port || (isHttps ? 443 : 80),
    path: url.pathname,
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(body) }
  }
  const client = isHttps ? https : http
  const req = client.request(options, (res) => {
    let data = ''
    res.on('data', (chunk) => { data += chunk })
    res.on('end', () => {
      if (res.statusCode && res.statusCode >= 400) {
        return reject(new Error(`LLM HTTP ${res.statusCode}`))
      }
      try {
        resolve(JSON.parse(data))
      } catch (err) {
        reject(new Error('Invalid JSON from LLM'))
      }
    })
  })
  req.on('error', reject)
  req.write(body)
  req.end()
})

const callOllama = async (prompt) => {
  const response = await postJson(`${OLLAMA_HOST}/api/generate`, { model: OLLAMA_MODEL, prompt, stream: false })
  return response && response.response ? response.response : ''
}

const runLLM = async (prompt) => {
  if (!prompt) return ''
  if (LLM_PROVIDER === 'ollama') return callOllama(prompt)
  return ''
}

const fallbackExtract = (message) => {
  const result = {}
  if (!message || typeof message !== 'string') return result
  const phoneMatch = message.match(/\+?\d[\d\s-]{8,}/)
  const emailMatch = message.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
  const dateMatch = message.match(/\b\d{4}-\d{2}-\d{2}\b/)
  const nameMatch = message.match(/name is ([A-Za-z\s]+)/i)
  if (phoneMatch) result.phone = phoneMatch[0].trim()
  if (emailMatch) result.email = emailMatch[0].trim()
  if (dateMatch) result.dob = dateMatch[0]
  if (nameMatch) result.fullName = nameMatch[1].trim()
  return result
}

const mergeCollected = (current, incoming) => {
  const merged = { ...current }
  if (!incoming || typeof incoming !== 'object') return merged
  for (const [key, value] of Object.entries(incoming)) {
    if (value === undefined || value === null) continue
    if (key === 'instruments' && Array.isArray(value)) {
      merged.instruments = Array.isArray(merged.instruments) ? merged.instruments : []
      value.forEach((entry) => {
        if (!entry || typeof entry !== 'object') return
        if (!entry.instrument) return
        const normalizedPayment = entry.payment_plan && PAYMENT_OPTIONS.includes(entry.payment_plan) ? entry.payment_plan : null
        const normalized = {
          instrument: entry.instrument,
          batch_preference: entry.batch_preference || entry.batch,
          payment_plan: normalizedPayment
        }
        merged.instruments.push(normalized)
      })
    } else {
      merged[key] = value
    }
  }
  return merged
}

const detectMissing = (collected) => {
  const missing = []
  if (!collected.fullName) missing.push('fullName')
  if (!collected.dob) missing.push('dob')
  if (!collected.phone) missing.push('phone')
  if (!collected.guardianContact) missing.push('guardianContact')
  if (!collected.dateOfJoining) missing.push('dateOfJoining')
  if (!Array.isArray(collected.instruments) || collected.instruments.length === 0) {
    missing.push('instruments')
  } else {
    collected.instruments.forEach((item, idx) => {
      if (!item.instrument) missing.push(`instruments[${idx}].instrument`)
      if (!item.batch_preference) missing.push(`instruments[${idx}].batch_preference`)
      if (!item.payment_plan) missing.push(`instruments[${idx}].payment_plan (Monthly/Quarterly)`)
    })
  }
  return missing
}

const buildClarification = (missing) => {
  if (!missing.length) return 'All required fields captured. Reply CONFIRM to proceed to enrollment.'
  return `Need these details: ${missing.join(', ')}. Please provide them in natural language.`
}

const buildPrompt = (message, collected) => {
  const context = collected && Object.keys(collected).length ? JSON.stringify(collected) : 'none'
  return [
    'You are an enrollment assistant for a music school.',
    'Extract structured data as JSON. Only return JSON.',
    'Fields: fullName, dob (YYYY-MM-DD), phone, guardianContact, email, address, dateOfJoining (YYYY-MM-DD), instruments [{instrument, batch_preference, payment_plan (Monthly|Quarterly)}].',
    'Keep values short and do not invent data.',
    `Existing context: ${context}`,
    `User message: ${message}`,
    'Return JSON only.'
  ].join('\n')
}

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

// GET /api/teachers/:id/batches - fetch batches for a specific teacher
app.get('/api/teachers/:id/batches', async (req, res) => {
  const { id } = req.params
  try {
    const result = await pool.query(`
      SELECT 
        b.id,
        b.recurrence,
        b.start_time,
        b.end_time,
        b.capacity,
        i.id as instrument_id,
        i.name as instrument_name
      FROM batches b
      JOIN instruments i ON b.instrument_id = i.id
      WHERE b.teacher_id = $1 AND b.is_makeup = false
      ORDER BY i.name, b.recurrence
    `, [id])
    res.json({ batches: result.rows })
  } catch (err) {
    console.error('Get teacher batches error:', err)
    res.status(500).json({ error: 'Failed to fetch teacher batches' })
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
        t.name as teacher_name,
        COUNT(DISTINCT eb.enrollment_id) as enrolled_count
      FROM batches b
      JOIN instruments i ON b.instrument_id = i.id
      LEFT JOIN teachers t ON b.teacher_id = t.id
      LEFT JOIN enrollment_batches eb ON b.id = eb.batch_id
      WHERE b.instrument_id = $1 AND b.is_makeup = false
      GROUP BY b.id, i.name, t.id, t.name
      ORDER BY b.recurrence, b.start_time
    `, [instrumentId])
    res.json({ batches: result.rows })
  } catch (err) {
    console.error('Get batches by instrument error:', err)
    res.status(500).json({ error: 'Failed to fetch batches' })
  }
})

// POST /api/agent/enroll - conversational enrollment via LLM guidance
app.post('/api/agent/enroll', async (req, res) => {
  const { sessionId, message } = req.body || {}
  if (!message) return res.status(400).json({ error: 'message is required' })

  const sid = sessionId || crypto.randomUUID()
  const session = enrollmentSessions.get(sid) || { collected: {}, history: [] }

  let llmExtract = null
  try {
    const llmResponse = await runLLM(buildPrompt(message, session.collected))
    llmExtract = safeJsonExtract(llmResponse)
  } catch (err) {
    console.warn('LLM call failed, using heuristics only', err.message)
  }

  const heuristicExtract = fallbackExtract(message)
  const merged = mergeCollected(session.collected, llmExtract)
  const mergedWithFallback = mergeCollected(merged, heuristicExtract)

  const missing = detectMissing(mergedWithFallback)
  const prompt = buildClarification(missing)

  session.collected = mergedWithFallback
  session.history.push({ user: message, extracted: mergedWithFallback, missing })
  enrollmentSessions.set(sid, session)

  res.json({
    sessionId: sid,
    collected: session.collected,
    missing,
    prompt,
    readyForSubmission: missing.length === 0
  })
})

// POST /api/students/:id/enroll - Enroll existing student in batches
app.post('/api/students/:id/enroll', async (req, res) => {
  const { id: studentId } = req.params
  const { enrollments } = req.body
  
  if (!enrollments || !Array.isArray(enrollments) || enrollments.length === 0) {
    return res.status(400).json({ error: 'enrollments array is required' })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Get first batch to determine instrument_id for enrollment record
    const firstBatch = await client.query('SELECT instrument_id FROM batches WHERE id = $1', [enrollments[0].batch_id])
    if (firstBatch.rows.length === 0) {
      throw new Error('Batch not found')
    }
    const instrumentId = firstBatch.rows[0].instrument_id
    const enrollmentDate = enrollments[0].enrollment_date || new Date().toISOString().split('T')[0]

    // Check if enrollment already exists for this student and instrument
    let enrollmentId
    const existingEnrollment = await client.query(
      'SELECT id FROM enrollments WHERE student_id = $1 AND instrument_id = $2',
      [studentId, instrumentId]
    )

    if (existingEnrollment.rows.length > 0) {
      enrollmentId = existingEnrollment.rows[0].id
    } else {
      // Create new enrollment record
      const enrollmentRes = await client.query(
        `INSERT INTO enrollments (student_id, instrument_id, status, classes_remaining, enrolled_on)
         VALUES ($1, $2, 'active', 0, $3) RETURNING id`,
        [studentId, instrumentId, enrollmentDate]
      )
      enrollmentId = enrollmentRes.rows[0].id
    }

    // Add each batch to enrollment_batches with payment frequency
    for (const enrollment of enrollments) {
      const { batch_id, payment_frequency, enrollment_date } = enrollment
      
      // Calculate initial classes based on payment frequency
      const classesMap = {
        'monthly': 8,
        'quarterly': 24,
        'half_yearly': 48,
        'yearly': 96
      }
      const initialClasses = classesMap[payment_frequency] || 8

      // Check if already enrolled in this batch
      const existing = await client.query(
        'SELECT id FROM enrollment_batches WHERE enrollment_id = $1 AND batch_id = $2',
        [enrollmentId, batch_id]
      )

      if (existing.rows.length === 0) {
        await client.query(
          `INSERT INTO enrollment_batches (enrollment_id, batch_id, payment_frequency, classes_remaining, enrolled_on)
           VALUES ($1, $2, $3, $4, $5)`,
          [enrollmentId, batch_id, payment_frequency, initialClasses, enrollment_date || enrollmentDate]
        )
      }
    }

    // Update total classes_remaining in main enrollment record
    const totalClasses = enrollments.reduce((sum, e) => {
      const classesMap = { 'monthly': 8, 'quarterly': 24, 'half_yearly': 48, 'yearly': 96 }
      return sum + (classesMap[e.payment_frequency] || 8)
    }, 0)

    await client.query(
      'UPDATE enrollments SET classes_remaining = classes_remaining + $1 WHERE id = $2',
      [totalClasses, enrollmentId]
    )

    await client.query('COMMIT')
    res.status(201).json({ ok: true, enrollment_id: enrollmentId })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Enroll student error:', err)
    res.status(500).json({ error: 'Failed to enroll student' })
  } finally {
    client.release()
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
    console.log('Starting enrollment transaction for request:', { streams: streams.map(s => ({ instrument: s.instrument, batch: s.batch, payment: s.payment })) })

    // Resolve instruments once (case-insensitive, partial fallback)
    const instrumentCache = new Map()
    const resolveInstrument = async (instrumentNameRaw) => {
      const instrumentName = (instrumentNameRaw || '').trim()
      const cacheKey = instrumentName.toLowerCase()
      if(instrumentCache.has(cacheKey)) return instrumentCache.get(cacheKey)

      const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
      let row = null

      // Allow direct UUID lookup if caller passed an ID
      if (uuidRegex.test(instrumentName)) {
        const byId = await client.query('SELECT id, name FROM instruments WHERE id = $1 LIMIT 1', [instrumentName])
        row = byId.rows[0]
        console.log('UUID lookup attempt', { instrumentName, rowsReturned: byId.rows.length, found: !!row })
      }

      if(!row){
        const byExact = await client.query(
          'SELECT id, name FROM instruments WHERE LOWER(name) = LOWER($1) LIMIT 1',
          [instrumentName]
        )
        row = byExact.rows[0]
        console.log('Exact name lookup', { instrumentName, rowsReturned: byExact.rows.length, found: !!row })
      }
      if(!row){
        const byPartial = await client.query(
          'SELECT id, name FROM instruments WHERE name ILIKE $1 LIMIT 1',
          [`%${instrumentName}%`]
        )
        row = byPartial.rows[0]
        console.log('Partial name lookup', { instrumentName, rowsReturned: byPartial.rows.length, found: !!row })
      }
      if(!row) {
        console.error('resolveInstrument: FAILED - not found after all lookup attempts', { instrumentName, strategies: 'uuid|exact|partial' })
        throw new Error(`Instrument not found: ${instrumentName}`)
      }
      instrumentCache.set(cacheKey, row)
      return row
    }

    // 1. Insert student
    const fullName = `${firstName.trim()} ${lastName.trim()}`
    const metadata = { email, address }
    const studentInsert = await client.query(
      `INSERT INTO students (name, dob, phone, guardian_contact, metadata) 
       VALUES ($1, $2, $3, $4, $5) RETURNING id`,
      [fullName, dob, telephone, guardianName, JSON.stringify(metadata)]
    )
    const studentId = studentInsert.rows[0].id

    // 2. Create ONE enrollment record per student using the first stream's instrument
    const firstStream = streams[0]
    const firstInstrument = await resolveInstrument(firstStream.instrument.trim())
    const enrollmentRes = await client.query(
      `INSERT INTO enrollments (student_id, instrument_id, status, classes_remaining, enrolled_on)
       VALUES ($1, $2, 'active', 0, $3) RETURNING id`,
      [studentId, firstInstrument.id, dateOfJoining]
    )
    const enrollmentId = enrollmentRes.rows[0].id

    let totalClasses = 0

    // 3. Process each stream and create enrollment_batch records + payments
    for(const stream of streams) {
      const instrumentName = stream.instrument.trim()
      const batchRecurrence = stream.batch.trim()
      const paymentType = stream.payment

      const instrumentRow = await resolveInstrument(instrumentName)
      const instrumentId = instrumentRow.id

      // Get package by instrument and payment type
      const packageRes = await client.query(
        'SELECT id, classes_count, price FROM packages WHERE instrument_id = $1 AND name ILIKE $2 LIMIT 1',
        [instrumentId, `%${paymentType}%`]
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
        'SELECT id FROM batches WHERE instrument_id = $1 AND recurrence ILIKE $2 LIMIT 1',
        [instrumentId, `%${batchRecurrence}%`]
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
        COALESCE(
          json_agg(
            json_build_object(
              'batch_id', b.id,
              'instrument', i.name,
              'batch_recurrence', b.recurrence,
              'teacher', t.name,
              'start_time', b.start_time,
              'end_time', b.end_time
            )
            ORDER BY i.name, b.recurrence
          ) FILTER (WHERE b.id IS NOT NULL),
          '[]'::json
        ) as batches
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

// POST /api/students/:studentId/image - upload student image
app.post('/api/students/:studentId/image', async (req, res) => {
  const { studentId } = req.params
  const { image } = req.body || {}
  if (!image || typeof image !== 'string') {
    return res.status(400).json({ error: 'image (base64 string) is required' })
  }
  try {
    const updateRes = await pool.query(
      `UPDATE students SET metadata = jsonb_set(
        COALESCE(metadata, '{}'::jsonb),
        '{image}',
        to_jsonb($1)
      ) WHERE id = $2 RETURNING id`,
      [image, studentId]
    )
    if (updateRes.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' })
    }
    res.json({ ok: true, studentId, message: 'Image uploaded successfully' })
  } catch (err) {
    console.error('Image upload error:', err)
    res.status(500).json({ error: 'Failed to upload image' })
  }
})

// ==================== STUDENTS API ====================

// GET /api/students - List all students with enrollment details
app.get('/api/students', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        s.id,
        s.name,
        s.dob,
        s.phone,
        s.guardian_contact,
        s.metadata,
        s.created_at,
        COALESCE(
          json_agg(
            jsonb_build_object(
              'enrollment_id', e.id,
              'status', e.status,
              'classes_remaining', e.classes_remaining,
              'enrolled_on', e.enrolled_on,
              'batch_id', eb.batch_id,
              'payment_frequency', eb.payment_frequency
            ) ORDER BY e.id
          ) FILTER (WHERE e.id IS NOT NULL),
          '[]'::json
        ) as enrollments
      FROM students s
      LEFT JOIN enrollments e ON s.id = e.student_id
      LEFT JOIN enrollment_batches eb ON e.id = eb.enrollment_id
      GROUP BY s.id
      ORDER BY s.created_at DESC
    `)
    res.json({ students: result.rows })
  } catch (err) {
    console.error('Get students error:', err)
    res.status(500).json({ error: 'Failed to fetch students' })
  }
})

// GET /api/students/:id - Get single student with full details
app.get('/api/students/:id', async (req, res) => {
  const { id } = req.params
  try {
    const studentRes = await pool.query('SELECT * FROM students WHERE id = $1', [id])
    if (studentRes.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' })
    }

    const enrollmentsRes = await pool.query(`
      SELECT 
        e.id as enrollment_id,
        e.status,
        e.classes_remaining,
        e.enrolled_on,
        COALESCE(
          json_agg(
            json_build_object(
              'batch_id', b.id,
              'instrument', i.name,
              'batch_recurrence', b.recurrence,
              'teacher', t.name,
              'payment_frequency', eb.payment_frequency,
              'classes_remaining', eb.classes_remaining
            )
          ) FILTER (WHERE b.id IS NOT NULL),
          '[]'::json
        ) as batches
      FROM enrollments e
      LEFT JOIN enrollment_batches eb ON e.id = eb.enrollment_id
      LEFT JOIN batches b ON eb.batch_id = b.id
      LEFT JOIN instruments i ON b.instrument_id = i.id
      LEFT JOIN teachers t ON b.teacher_id = t.id
      WHERE e.student_id = $1
      GROUP BY e.id
    `, [id])

    res.json({ 
      student: studentRes.rows[0],
      enrollments: enrollmentsRes.rows 
    })
  } catch (err) {
    console.error('Get student error:', err)
    res.status(500).json({ error: 'Failed to fetch student' })
  }
})

// POST /api/students - Create new student
app.post('/api/students', async (req, res) => {
  const { name, dob, phone, guardian_contact, metadata } = req.body
  if (!name || !phone) {
    return res.status(400).json({ error: 'name and phone are required' })
  }
  try {
    const result = await pool.query(
      `INSERT INTO students (name, dob, phone, guardian_contact, metadata) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [name, dob || null, phone, guardian_contact || null, metadata || {}]
    )
    res.status(201).json({ student: result.rows[0] })
  } catch (err) {
    console.error('Create student error:', err)
    res.status(500).json({ error: 'Failed to create student' })
  }
})

// PUT /api/students/:id - Update student
app.put('/api/students/:id', async (req, res) => {
  const { id } = req.params
  const { name, dob, phone, guardian_contact, metadata } = req.body
  try {
    const result = await pool.query(
      `UPDATE students 
       SET name = COALESCE($1, name),
           dob = COALESCE($2, dob),
           phone = COALESCE($3, phone),
           guardian_contact = COALESCE($4, guardian_contact),
           metadata = COALESCE($5, metadata),
           updated_at = now()
       WHERE id = $6 
       RETURNING *`,
      [name, dob, phone, guardian_contact, metadata, id]
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' })
    }
    res.json({ student: result.rows[0] })
  } catch (err) {
    console.error('Update student error:', err)
    res.status(500).json({ error: 'Failed to update student' })
  }
})

// DELETE /api/students/:id - Delete student (cascades to enrollments)
app.delete('/api/students/:id', async (req, res) => {
  const { id } = req.params
  try {
    const result = await pool.query('DELETE FROM students WHERE id = $1 RETURNING id', [id])
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' })
    }
    res.json({ ok: true, message: 'Student deleted successfully' })
  } catch (err) {
    console.error('Delete student error:', err)
    res.status(500).json({ error: 'Failed to delete student' })
  }
})

// ==================== TEACHERS API ====================

// GET /api/teachers - List all teachers
app.get('/api/teachers', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        t.id,
        t.name,
        t.phone,
        t.role,
        t.payout_type,
        t.rate,
        t.is_active,
        t.created_at,
        COUNT(b.id) as batch_count
      FROM teachers t
      LEFT JOIN batches b ON t.id = b.teacher_id AND b.is_makeup = false
      GROUP BY t.id
      ORDER BY t.name
    `)
    res.json({ teachers: result.rows })
  } catch (err) {
    console.error('Get teachers error:', err)
    res.status(500).json({ error: 'Failed to fetch teachers' })
  }
})

// GET /api/teachers/:id - Get single teacher with batches
app.get('/api/teachers/:id', async (req, res) => {
  const { id } = req.params
  try {
    const teacherRes = await pool.query('SELECT * FROM teachers WHERE id = $1', [id])
    if (teacherRes.rows.length === 0) {
      return res.status(404).json({ error: 'Teacher not found' })
    }

    const batchesRes = await pool.query(`
      SELECT 
        b.id,
        b.recurrence,
        b.start_time,
        b.end_time,
        b.capacity,
        i.name as instrument_name
      FROM batches b
      JOIN instruments i ON b.instrument_id = i.id
      WHERE b.teacher_id = $1 AND b.is_makeup = false
      ORDER BY i.name, b.recurrence
    `, [id])

    res.json({ 
      teacher: teacherRes.rows[0],
      batches: batchesRes.rows 
    })
  } catch (err) {
    console.error('Get teacher error:', err)
    res.status(500).json({ error: 'Failed to fetch teacher' })
  }
})

// POST /api/teachers - Create new teacher
app.post('/api/teachers', async (req, res) => {
  const { name, phone, email, payout_type, rate } = req.body
  if (!name) {
    return res.status(400).json({ error: 'name is required' })
  }
  try {
    const result = await pool.query(
      `INSERT INTO teachers (name, phone, role, payout_type, rate, payout_terms) 
       VALUES ($1, $2, 'teacher', $3, $4, jsonb_build_object('email', $5::text)) 
       RETURNING *`,
      [name, phone || null, payout_type || 'per_student_monthly', rate || 0, email || '']
    )
    res.status(201).json({ teacher: result.rows[0] })
  } catch (err) {
    console.error('Create teacher error:', err)
    res.status(500).json({ error: 'Failed to create teacher' })
  }
})// PUT /api/teachers/:id - Update teacher
app.put('/api/teachers/:id', async (req, res) => {
  const { id } = req.params
  const { name, phone, email, payout_type, rate, is_active } = req.body
  try {
    const result = await pool.query(
      `UPDATE teachers 
       SET name = COALESCE($1, name),
           phone = COALESCE($2, phone),
           payout_type = COALESCE($3, payout_type),
           rate = COALESCE($4, rate),
           is_active = COALESCE($5, is_active),
           payout_terms = CASE WHEN $6 IS NOT NULL 
             THEN jsonb_set(COALESCE(payout_terms, '{}'::jsonb), '{email}', to_jsonb($6))
             ELSE payout_terms END,
           updated_at = now()
       WHERE id = $7 
       RETURNING *`,
      [name, phone, payout_type, rate, is_active, email, id]
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Teacher not found' })
    }
    res.json({ teacher: result.rows[0] })
  } catch (err) {
    console.error('Update teacher error:', err)
    res.status(500).json({ error: 'Failed to update teacher' })
  }
})

// GET /api/teachers/:id/payouts - Calculate teacher payouts
app.get('/api/teachers/:id/payouts', async (req, res) => {
  const { id } = req.params
  const { month, year } = req.query
  
  try {
    const teacherRes = await pool.query('SELECT * FROM teachers WHERE id = $1', [id])
    if (teacherRes.rows.length === 0) {
      return res.status(404).json({ error: 'Teacher not found' })
    }
    const teacher = teacherRes.rows[0]

    // Get teacher's batches
    const batchesRes = await pool.query(
      'SELECT id FROM batches WHERE teacher_id = $1 AND is_makeup = false',
      [id]
    )
    const batchIds = batchesRes.rows.map(b => b.id)

    if (batchIds.length === 0) {
      return res.json({ 
        teacher,
        classes_taught: 0,
        total_payout: teacher.payout_type === 'fixed' ? teacher.rate : 0
      })
    }

    // Count unique class sessions (by date + batch_id)
    let attendanceQuery = `
      SELECT COUNT(DISTINCT (session_date, batch_id)) as class_count
      FROM attendance_records
      WHERE batch_id = ANY($1)
    `
    const params = [batchIds]

    if (month && year) {
      attendanceQuery += ` AND EXTRACT(MONTH FROM session_date) = $2 AND EXTRACT(YEAR FROM session_date) = $3`
      params.push(parseInt(month), parseInt(year))
    }

    const attendanceRes = await pool.query(attendanceQuery, params)
    const classCount = parseInt(attendanceRes.rows[0].class_count) || 0

    let totalPayout = 0
    if (teacher.payout_type === 'fixed') {
      totalPayout = teacher.rate
    } else {
      totalPayout = classCount * teacher.rate
    }

    res.json({
      teacher,
      classes_taught: classCount,
      total_payout: totalPayout,
      period: month && year ? `${year}-${month}` : 'all-time'
    })
  } catch (err) {
    console.error('Get teacher payouts error:', err)
    res.status(500).json({ error: 'Failed to calculate payouts' })
  }
})

// ==================== BATCHES API (Additional) ====================

// POST /api/batches - Create new batch
app.post('/api/batches', async (req, res) => {
  const { instrument_id, teacher_id, recurrence, start_time, end_time, capacity } = req.body
  if (!instrument_id || !recurrence || !capacity) {
    return res.status(400).json({ error: 'instrument_id, recurrence, and capacity are required' })
  }
  try {
    const result = await pool.query(
      `INSERT INTO batches (instrument_id, teacher_id, recurrence, start_time, end_time, capacity, is_makeup) 
       VALUES ($1, $2, $3, $4, $5, $6, false) 
       RETURNING *`,
      [instrument_id, teacher_id || null, recurrence, start_time || null, end_time || null, capacity]
    )
    res.status(201).json({ batch: result.rows[0] })
  } catch (err) {
    console.error('Create batch error:', err)
    res.status(500).json({ error: 'Failed to create batch' })
  }
})

// PUT /api/batches/:id - Update batch
app.put('/api/batches/:id', async (req, res) => {
  const { id } = req.params
  const { teacher_id, recurrence, start_time, end_time, capacity } = req.body
  try {
    const result = await pool.query(
      `UPDATE batches 
       SET teacher_id = COALESCE($1, teacher_id),
           recurrence = COALESCE($2, recurrence),
           start_time = COALESCE($3, start_time),
           end_time = COALESCE($4, end_time),
           capacity = COALESCE($5, capacity),
           updated_at = now()
       WHERE id = $6 
       RETURNING *`,
      [teacher_id, recurrence, start_time, end_time, capacity, id]
    )
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Batch not found' })
    }
    res.json({ batch: result.rows[0] })
  } catch (err) {
    console.error('Update batch error:', err)
    res.status(500).json({ error: 'Failed to update batch' })
  }
})

// GET /api/batches/:id/students - Get students in a batch
app.get('/api/batches/:id/students', async (req, res) => {
  const { id } = req.params
  try {
    const result = await pool.query(`
      SELECT 
        s.id,
        s.name,
        s.phone,
        eb.payment_frequency,
        eb.classes_remaining
      FROM enrollment_batches eb
      JOIN enrollments e ON eb.enrollment_id = e.id
      JOIN students s ON e.student_id = s.id
      WHERE eb.batch_id = $1
      ORDER BY s.name
    `, [id])
    res.json({ students: result.rows })
  } catch (err) {
    console.error('Get batch students error:', err)
    res.status(500).json({ error: 'Failed to fetch batch students' })
  }
})

// ==================== ATTENDANCE API ====================

// POST /api/attendance - Mark attendance (bulk)
app.post('/api/attendance', async (req, res) => {
  const { records } = req.body
  if (!Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ error: 'records array is required' })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const insertedRecords = []
    for (const record of records) {
      const { session_date, batch_id, student_id, status, source } = record
      
      const result = await client.query(
        `INSERT INTO attendance_records (session_date, batch_id, student_id, status, source, finalized_at)
         VALUES ($1, $2, $3, $4, $5, now())
         RETURNING *`,
        [session_date, batch_id, student_id, status || 'present', source || 'dashboard']
      )
      insertedRecords.push(result.rows[0])

      // Deduct class if present
      if (status === 'present') {
        await client.query(
          `UPDATE enrollment_batches 
           SET classes_remaining = GREATEST(0, classes_remaining - 1)
           WHERE enrollment_id = (SELECT id FROM enrollments WHERE student_id = $1 LIMIT 1)
           AND batch_id = $2`,
          [student_id, batch_id]
        )
      }
    }

    await client.query('COMMIT')
    res.status(201).json({ records: insertedRecords })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Mark attendance error:', err)
    res.status(500).json({ error: 'Failed to mark attendance' })
  } finally {
    client.release()
  }
})

// GET /api/attendance - Get attendance records
app.get('/api/attendance', async (req, res) => {
  const { batch_id, student_id, date_from, date_to } = req.query
  try {
    let query = `
      SELECT 
        a.id,
        a.session_date,
        a.status,
        a.source,
        a.finalized_at,
        s.id as student_id,
        s.name as student_name,
        b.id as batch_id,
        b.recurrence as batch_recurrence,
        i.name as instrument_name
      FROM attendance_records a
      JOIN students s ON a.student_id = s.id
      JOIN batches b ON a.batch_id = b.id
      JOIN instruments i ON b.instrument_id = i.id
      WHERE 1=1
    `
    const params = []
    let paramCount = 0

    if (batch_id) {
      paramCount++
      query += ` AND a.batch_id = $${paramCount}`
      params.push(batch_id)
    }
    if (student_id) {
      paramCount++
      query += ` AND a.student_id = $${paramCount}`
      params.push(student_id)
    }
    if (date_from) {
      paramCount++
      query += ` AND a.session_date >= $${paramCount}`
      params.push(date_from)
    }
    if (date_to) {
      paramCount++
      query += ` AND a.session_date <= $${paramCount}`
      params.push(date_to)
    }

    query += ` ORDER BY a.session_date DESC, s.name`

    const result = await pool.query(query, params)
    res.json({ attendance: result.rows })
  } catch (err) {
    console.error('Get attendance error:', err)
    res.status(500).json({ error: 'Failed to fetch attendance' })
  }
})

// GET /api/attendance/batch/:id - Get attendance for specific batch
app.get('/api/attendance/batch/:id', async (req, res) => {
  const { id } = req.params
  const { date } = req.query
  try {
    let query = `
      SELECT 
        a.id,
        a.session_date,
        a.status,
        s.id as student_id,
        s.name as student_name
      FROM attendance_records a
      JOIN students s ON a.student_id = s.id
      WHERE a.batch_id = $1
    `
    const params = [id]

    if (date) {
      query += ` AND a.session_date = $2`
      params.push(date)
    }

    query += ` ORDER BY a.session_date DESC, s.name`

    const result = await pool.query(query, params)
    res.json({ attendance: result.rows })
  } catch (err) {
    console.error('Get batch attendance error:', err)
    res.status(500).json({ error: 'Failed to fetch batch attendance' })
  }
})

// ==================== PAYMENTS API ====================

// POST /api/payments - Record payment
app.post('/api/payments', async (req, res) => {
  const { student_id, amount, classes_count, method } = req.body
  if (!student_id || !amount || !classes_count) {
    return res.status(400).json({ error: 'student_id, amount, and classes_count are required' })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Create payment record
    const paymentRes = await client.query(
      `INSERT INTO payments (student_id, amount, method, transaction_id, metadata)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [student_id, amount, method || 'manual', crypto.randomUUID(), JSON.stringify({ classes_count })]
    )

    // Add classes to enrollment_batches
    await client.query(
      `UPDATE enrollment_batches 
       SET classes_remaining = classes_remaining + $1
       WHERE enrollment_id IN (SELECT id FROM enrollments WHERE student_id = $2)`,
      [classes_count, student_id]
    )

    // Also update main enrollments table
    await client.query(
      `UPDATE enrollments 
       SET classes_remaining = classes_remaining + $1
       WHERE student_id = $2`,
      [classes_count, student_id]
    )

    await client.query('COMMIT')
    res.status(201).json({ payment: paymentRes.rows[0] })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Record payment error:', err)
    res.status(500).json({ error: 'Failed to record payment' })
  } finally {
    client.release()
  }
})

// GET /api/payments - List all payments
app.get('/api/payments', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT 
        p.id,
        p.amount,
        p.method,
        p.transaction_id,
        p.metadata,
        p.timestamp,
        s.id as student_id,
        s.name as student_name
      FROM payments p
      JOIN students s ON p.student_id = s.id
      ORDER BY p.timestamp DESC
    `)
    res.json({ payments: result.rows })
  } catch (err) {
    console.error('Get payments error:', err)
    res.status(500).json({ error: 'Failed to fetch payments' })
  }
})

// GET /api/payments/student/:id - Get payment history for student
app.get('/api/payments/student/:id', async (req, res) => {
  const { id } = req.params
  try {
    const result = await pool.query(`
      SELECT 
        p.id,
        p.amount,
        p.method,
        p.transaction_id,
        p.metadata,
        p.timestamp
      FROM payments p
      WHERE p.student_id = $1
      ORDER BY p.timestamp DESC
    `, [id])
    res.json({ payments: result.rows })
  } catch (err) {
    console.error('Get student payments error:', err)
    res.status(500).json({ error: 'Failed to fetch student payments' })
  }
})

// ==================== STATS API ====================

// GET /api/stats - Dashboard statistics
app.get('/api/stats', async (req, res) => {
  try {
    const studentsCount = await pool.query('SELECT COUNT(*) as count FROM students')
    const teachersCount = await pool.query('SELECT COUNT(*) as count FROM teachers WHERE is_active = true')
    const batchesCount = await pool.query('SELECT COUNT(*) as count FROM batches WHERE is_makeup = false')
    const totalRevenue = await pool.query('SELECT COALESCE(SUM(amount), 0) as total FROM payments')
    
    const recentPayments = await pool.query(`
      SELECT 
        p.id,
        p.amount,
        p.method,
        p.timestamp,
        s.name as student_name
      FROM payments p
      JOIN students s ON p.student_id = s.id
      ORDER BY p.timestamp DESC
      LIMIT 10
    `)

    res.json({
      students: parseInt(studentsCount.rows[0].count),
      teachers: parseInt(teachersCount.rows[0].count),
      batches: parseInt(batchesCount.rows[0].count),
      revenue: parseFloat(totalRevenue.rows[0].total),
      recent_payments: recentPayments.rows
    })
  } catch (err) {
    console.error('Get stats error:', err)
    res.status(500).json({ error: 'Failed to fetch statistics' })
  }
})

const PORT = process.env.PORT || 3000
app.listen(PORT, ()=> console.log(`Enroll API listening on http://localhost:${PORT}`))
