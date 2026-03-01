require('dotenv').config()
const express = require('express')
const cors = require('cors')
const morgan = require('morgan')
const crypto = require('crypto')
const http = require('http')
const https = require('https')
const passport = require('passport')
const pool = require('./db')

const app = express()
app.use(cors())
app.use(express.json({ limit: '50mb' }))
app.use(morgan('dev'))

// Initialize Passport and Strategies
app.use(passport.initialize())
require('./auth/googleStrategy')

// --- AUTHENTICATION BYPASS (LOCAL DEV) ---
const IS_DEV = process.env.NODE_ENV !== 'production'
const DISABLE_AUTH = IS_DEV && process.env.DISABLE_AUTH === 'true'
const DEV_PROFILE = process.env.DEV_PROFILE || 'admin'

app.use((req, res, next) => {
  if (DISABLE_AUTH) {
    // Strip auth header to prevent passport from overwriting our dev user with a token
    delete req.headers.authorization

    if (DEV_PROFILE === 'admin') {
      req.user = {
        id: '11111111-1111-1111-1111-111111111111',
        email: 'admin@local.dev',
        name: 'Local Admin',
        roles: ['admin']
      }
    } else if (DEV_PROFILE === 'teacher') {
      req.user = {
        id: '22222222-2222-2222-2222-222222222222',
        email: 'teacher@local.dev',
        name: 'Local Teacher',
        roles: ['teacher']
      }
    } else {
      req.user = {
        id: '33333333-3333-3333-3333-333333333333',
        email: 'student@local.dev',
        name: 'Local Student',
        roles: ['student']
      }
    }
  }
  next()
})

// GET /api/auth/config - Expose auth state to frontend
app.get('/api/auth/config', (req, res) => {
  res.json({
    authDisabled: DISABLE_AUTH,
    user: req.user || null,
    profile: DEV_PROFILE
  })
})
// -----------------------------------------

// Register students and teachers routes
app.use('/api/notifications', require('./routes/notifications'));
app.use('/api/prospects', require('./routes/prospects'));
app.use('/api/students', require('./routes/students'));
app.use('/api/students', require('./routes/students-put'));
app.use('/api/teachers', require('./routes/teachers'));
app.use('/api/teachers', require('./routes/teacher360'));
const { router: student360Router, fetchStudent360Data } = require('./routes/student360');
app.use('/api/students', student360Router);
app.use('/api/payments', require('./routes/payments'));
app.use('/api/users', require('./routes/users'));
app.use('/api/finance', require('./routes/finance'));
app.use('/api', require('./routes/documents'));
app.use('/api/auth', require('./routes/auth'));

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
        t.name as teacher_name,
        COUNT(eb.id) FILTER (WHERE e.status = 'active') AS student_count
      FROM batches b
      JOIN instruments i ON b.instrument_id = i.id
      LEFT JOIN teachers t ON b.teacher_id = t.id
      LEFT JOIN enrollment_batches eb ON eb.batch_id = b.id
      LEFT JOIN enrollments e ON e.id = eb.enrollment_id
      WHERE b.is_makeup = false
      GROUP BY b.id, i.id, i.name, t.id, t.name
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

// POST /api/batches - Create a new batch
app.post('/api/batches', async (req, res) => {
  const { instrument_id, teacher_id, recurrence, start_time, end_time, capacity } = req.body

  if (!instrument_id || !recurrence || !start_time || !end_time) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  try {
    const result = await pool.query(
      `INSERT INTO batches (instrument_id, teacher_id, recurrence, start_time, end_time, capacity)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [instrument_id, teacher_id || null, recurrence, start_time, end_time, capacity || 8]
    )
    res.status(201).json({ batch: result.rows[0] })
  } catch (err) {
    console.error('Create batch error:', err)
    res.status(500).json({ error: 'Failed to create batch' })
  }
})

// PUT /api/batches/:id - Update a batch
app.put('/api/batches/:id', async (req, res) => {
  const { id } = req.params
  const { teacher_id, recurrence, start_time, end_time, capacity } = req.body

  try {
    const result = await pool.query(
      `UPDATE batches 
       SET teacher_id = $1, recurrence = $2, start_time = $3, end_time = $4, capacity = $5, updated_at = NOW()
       WHERE id = $6 RETURNING *`,
      [teacher_id || null, recurrence, start_time, end_time, capacity, id]
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

// DELETE /api/batches/:id - Delete a batch
app.delete('/api/batches/:id', async (req, res) => {
  const { id } = req.params
  try {
    const result = await pool.query('DELETE FROM batches WHERE id = $1 RETURNING *', [id])
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Batch not found' })
    }
    res.json({ message: 'Batch deleted successfully', batch: result.rows[0] })
  } catch (err) {
    console.error('Delete batch error:', err)
    if (err.code === '23503') {
      return res.status(400).json({ error: 'Cannot delete batch with active enrollments or attendance records.' })
    }
    res.status(500).json({ error: 'Failed to delete batch' })
  }
})

// GET /api/batches/:batchId/students - fetch students for a specific batch
app.get('/api/batches/:batchId/students', async (req, res) => {
  const { batchId } = req.params
  const { date } = req.query

  try {
    let query = `
      SELECT 
        s.id as student_id,
        s.name as student_name,
        s.phone,
        s.guardian_contact,
        s.metadata->>'phone' as meta_phone,
        s.metadata->>'guardian_phone' as guardian_phone,
        eb.classes_remaining
    `
    const params = [batchId]

    if (date) {
      query += `, ar.status as attendance_status `
    }

    query += `
      FROM students s
      JOIN enrollments e ON s.id = e.student_id
      JOIN enrollment_batches eb ON e.id = eb.enrollment_id
    `

    if (date) {
      query += ` LEFT JOIN attendance_records ar ON ar.student_id = s.id AND ar.batch_id = eb.batch_id AND ar.session_date = $2 `
      params.push(date)
    }

    query += ` WHERE eb.batch_id = $1 AND e.status = 'active' ORDER BY s.name`

    const result = await pool.query(query, params)
    res.json({ students: result.rows })
  } catch (err) {
    console.error('Get batch students error:', err)
    res.status(500).json({ error: 'Failed to fetch students for batch' })
  }
})

// GET /api/attendance - Fetch attendance records
app.get('/api/attendance', async (req, res) => {
  const { student_id, batch_id, start_date, end_date } = req.query
  try {
    let query = `
      SELECT ar.*, s.name as student_name 
      FROM attendance_records ar
      JOIN students s ON ar.student_id = s.id
      WHERE 1=1
    `
    const params = []
    let pIdx = 1

    if (student_id) {
      query += ` AND ar.student_id = $${pIdx++}`
      params.push(student_id)
    }
    if (batch_id) {
      query += ` AND ar.batch_id = $${pIdx++}`
      params.push(batch_id)
    }
    if (start_date) {
      query += ` AND ar.session_date >= $${pIdx++}`
      params.push(start_date)
    }
    if (end_date) {
      query += ` AND ar.session_date <= $${pIdx++}`
      params.push(end_date)
    }

    query += ' ORDER BY ar.session_date DESC'

    const result = await pool.query(query, params)
    res.json({ attendance: result.rows })
  } catch (err) {
    console.error('Get attendance error:', err)
    res.status(500).json({ error: 'Failed to fetch attendance' })
  }
})

// POST /api/attendance - Mark attendance
app.post('/api/attendance', async (req, res) => {
  const { records } = req.body
  if (!Array.isArray(records) || records.length === 0) {
    return res.status(400).json({ error: 'No attendance records provided' })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    for (const record of records) {
      const { batch_id, student_id, date, status } = record

      // Check if record exists
      const checkRes = await client.query(
        'SELECT id, status FROM attendance_records WHERE batch_id = $1 AND student_id = $2 AND session_date = $3',
        [batch_id, student_id, date]
      )

      if (checkRes.rows.length > 0) {
        const oldStatus = checkRes.rows[0].status
        // Update
        await client.query(
          'UPDATE attendance_records SET status = $1, source = $2, finalized_at = NOW() WHERE id = $3',
          [status, 'manual', checkRes.rows[0].id]
        )

        // Handle credit adjustment on status change
        if (oldStatus !== 'present' && status === 'present') {
          // Changed to Present: Decrement credit
          await client.query(`
            UPDATE enrollment_batches eb
            SET classes_remaining = COALESCE(eb.classes_remaining, 0) - 1
            FROM enrollments e
            WHERE eb.enrollment_id = e.id AND e.student_id = $1 AND eb.batch_id = $2
          `, [student_id, batch_id])
        } else if (oldStatus === 'present' && status !== 'present') {
          // Changed from Present to Absent/Excused: Refund credit
          await client.query(`
            UPDATE enrollment_batches eb
            SET classes_remaining = COALESCE(eb.classes_remaining, 0) + 1
            FROM enrollments e
            WHERE eb.enrollment_id = e.id AND e.student_id = $1 AND eb.batch_id = $2
          `, [student_id, batch_id])
        }
      } else {
        // Insert
        await client.query(
          'INSERT INTO attendance_records (batch_id, student_id, session_date, status, source, finalized_at) VALUES ($1, $2, $3, $4, $5, NOW())',
          [batch_id, student_id, date, status, 'manual']
        )

        // If new record is Present, decrement credit
        if (status === 'present') {
          await client.query(`
            UPDATE enrollment_batches eb
            SET classes_remaining = COALESCE(eb.classes_remaining, 0) - 1
            FROM enrollments e
            WHERE eb.enrollment_id = e.id AND e.student_id = $1 AND eb.batch_id = $2
          `, [student_id, batch_id])
        }
      }
    }

    await client.query('COMMIT')
    res.json({ message: 'Attendance saved successfully' })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Attendance save error:', err)
    res.status(500).json({ error: 'Failed to save attendance' })
  } finally {
    client.release()
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

app.post('/api/enroll', async (req, res) => {
  console.log('--- NEW ENROLLMENT REQUEST ---');
  console.log('Received payload:', JSON.stringify(req.body, null, 2));

  const payload = req.body
  if (!payload || !payload.answers) return res.status(400).json({ error: 'invalid payload' })

  // Basic validation (required fields)
  const { firstName, lastName, email, dob, address, guardianName, telephone, streams, dateOfJoining } = payload.answers
  if (!firstName || !lastName || !email || !dob || !address || !guardianName || !telephone || !Array.isArray(streams) || streams.length === 0 || !dateOfJoining) {
    return res.status(422).json({ error: 'missing required fields' })
  }
  if (!/^\S+@\S+\.\S+$/.test(email)) {
    return res.status(422).json({ error: 'invalid email' })
  }
  if (!/^\+?[1-9]\d{0,2}[\s-]?\(?\d{1,4}\)?[\s-]?\d{1,4}[\s-]?\d{1,4}[\s-]?\d{1,9}$/.test(telephone)) {
    return res.status(422).json({ error: 'invalid telephone number' })
  }

  const allowedPayments = ['Monthly', 'Quarterly']
  for (const s of streams) {
    if (!s || typeof s.instrument !== 'string') return res.status(422).json({ error: 'invalid stream object' })
    if (!s.batch || typeof s.batch !== 'string') return res.status(422).json({ error: 'invalid batch' })
    if (!s.payment || !allowedPayments.includes(s.payment)) return res.status(422).json({ error: 'invalid payment option' })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    console.log('Starting enrollment transaction for request:', { streams: streams.map(s => ({ instrument: s.instrument, batch: s.batch, payment: s.payment })) })

    // Resolve instruments once (case-insensitive, partial fallback)
    const instrumentCache = new Map()
    const resolveInstrument = async (instrumentNameRaw) => {
      const instrumentName = (instrumentNameRaw || '').trim()
      const cacheKey = instrumentName.toLowerCase()
      if (instrumentCache.has(cacheKey)) return instrumentCache.get(cacheKey)

      const uuidRegex = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/
      let row = null

      // Allow direct UUID lookup if caller passed an ID
      if (uuidRegex.test(instrumentName)) {
        const byId = await client.query('SELECT id, name FROM instruments WHERE id = $1 LIMIT 1', [instrumentName])
        row = byId.rows[0]
        console.log('UUID lookup attempt', { instrumentName, rowsReturned: byId.rows.length, found: !!row })
      }

      if (!row) {
        const byExact = await client.query(
          'SELECT id, name FROM instruments WHERE LOWER(name) = LOWER($1) LIMIT 1',
          [instrumentName]
        )
        row = byExact.rows[0]
        console.log('Exact name lookup', { instrumentName, rowsReturned: byExact.rows.length, found: !!row })
      }
      if (!row) {
        const byPartial = await client.query(
          'SELECT id, name FROM instruments WHERE name ILIKE $1 LIMIT 1',
          [`%${instrumentName}%`]
        )
        row = byPartial.rows[0]
        console.log('Partial name lookup', { instrumentName, rowsReturned: byPartial.rows.length, found: !!row })
      }
      if (!row) {
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
      `INSERT INTO students (name, dob, phone, guardian_contact, email, metadata) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [fullName, dob, telephone, guardianName, email, JSON.stringify(metadata)]
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
    for (const stream of streams) {
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
      if (packageRes.rows.length === 0) {
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
      if (batchRes.rows.length === 0) {
        throw new Error(`Batch not found for ${instrumentName} with recurrence: ${batchRecurrence}`)
      }
      const batchId = batchRes.rows[0].id

      // Link enrollment to batch (creates enrollment_batch record)
      await client.query(
        'INSERT INTO enrollment_batches (enrollment_id, batch_id, classes_remaining, payment_frequency) VALUES ($1, $2, $3, $4)',
        [enrollmentId, batchId, classesCount, paymentType]
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

    // 5. Update student metadata with total_credits
    await client.query(
      `UPDATE students 
       SET metadata = jsonb_set(COALESCE(metadata, '{}'::jsonb), '{total_credits}', to_jsonb($1::int))
       WHERE id = $2`,
      [totalClasses, studentId]
    )

    await client.query('COMMIT')
    return res.status(201).json({ ok: true, studentId, enrollmentId, message: 'Enrollment successful' })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('Enrollment error:', err)
    return res.status(500).json({ error: err.message || 'Failed to store enrollment' })
  } finally {
    client.release()
  }
})

app.get('/api/enrollments', async (req, res) => {
  try {
    const result = await pool.query(`
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
        e.classes_remaining,
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
              'classes_remaining', eb.classes_remaining,
              'enrolled_on', COALESCE(eb.enrolled_on, e.enrolled_on)
            )
            ORDER BY i.name, b.recurrence
          ) FILTER (WHERE b.id IS NOT NULL),
          '[]'::json
        ) as batches
      FROM students s
      LEFT JOIN enrollments e ON s.id = e.student_id
      LEFT JOIN enrollment_batches eb ON e.id = eb.enrollment_id
      LEFT JOIN batches b ON eb.batch_id = b.id
      LEFT JOIN instruments i ON b.instrument_id = i.id
      LEFT JOIN teachers t ON b.teacher_id = t.id
      WHERE (s.student_type = 'permanent' OR s.student_type IS NULL)
      GROUP BY s.id, s.name, s.dob, s.phone, s.guardian_contact, s.metadata, s.is_active, e.id, e.status, e.classes_remaining, e.enrolled_on
      ORDER BY s.name ASC
    `)
    res.json({ enrollments: result.rows })
  } catch (err) {
    console.error('Get enrollments error:', err)
    res.status(500).json({ error: 'Failed to fetch enrollments' })
  }
})

// GET /api/portal/student/:email - Student 360 Degree View
app.get('/api/portal/student/:email', async (req, res) => {
  const { email } = req.params
  if (!email) return res.status(400).json({ error: 'Email is required' })

  try {
    // Resolve student ID from email
    const studentRes = await pool.query(
      `SELECT id FROM students WHERE email = $1 OR metadata->>'email' = $1 LIMIT 1`,
      [email]
    )

    if (studentRes.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' })
    }

    const studentId = studentRes.rows[0].id
    const data = await fetchStudent360Data(studentId)

    if (!data) {
      return res.status(404).json({ error: 'Student data not found' })
    }

    res.json(data)
  } catch (err) {
    console.error('Student 360 error:', err)
    res.status(500).json({ error: 'Failed to fetch student details' })
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

const PORT = process.env.PORT || 3000
app.listen(PORT, () => {
  console.log(`Enroll API listening on http://localhost:${PORT}`)
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`)
  console.log(`Database: ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'hsm_dev'}`)
  if (DISABLE_AUTH) console.log('⚠️  Authentication: DISABLED (Local Dev Mode)')
})
