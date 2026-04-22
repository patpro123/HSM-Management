require('dotenv').config()
const express = require('express')
const cors = require('cors')
const morgan = require('morgan')
const crypto = require('crypto')
const passport = require('passport')
const pool = require('./db')
const rbac = require('./auth/rbacMiddleware')

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

// Mutable dev profile — can be changed at runtime via POST /api/dev/switch-profile
let currentDevProfile = process.env.DEV_PROFILE || 'admin'
// When set, this resolved user object is used as req.user directly (bypasses profile defaults)
let currentDevOverride = null

const DEV_DEFAULTS = {
  admin:   { id: '11111111-1111-1111-1111-111111111111', email: 'admin@local.dev',   name: 'Local Admin',   roles: ['admin'] },
  teacher: { id: '22222222-2222-2222-2222-222222222222', email: 'teacher@local.dev', name: 'Local Teacher', roles: ['teacher'] },
  student: { id: '33333333-3333-3333-3333-333333333333', email: 'student@local.dev', name: 'Local Student', roles: ['student'] },
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

// Resolve a userRef (UUID or email) to a user object from the DB.
// Returns null if not found anywhere.
async function resolveDevUser(userRef) {
  const isUUID = UUID_RE.test(userRef)
  const col = isUUID ? 'id' : 'email'

  // 1. Check the users table (already logged in at least once)
  const userRes = await pool.query(`SELECT id, email, name FROM users WHERE ${col} = $1`, [userRef.toLowerCase()])
  if (userRes.rows.length > 0) {
    const u = userRes.rows[0]
    const roleRes = await pool.query(
      'SELECT role FROM user_roles WHERE user_id = $1 AND revoked_at IS NULL', [u.id]
    )
    return { id: u.id, email: u.email, name: u.name, roles: roleRes.rows.map(r => r.role) }
  }

  // provisioned_users is keyed by email only — nothing to look up for a UUID ref
  if (isUUID) return null

  // 2. Check provisioned_users — user provisioned but never logged in yet
  const provRes = await pool.query(
    `SELECT pu.email, pu.role, pu.entity_type, pu.entity_id,
            CASE WHEN pu.entity_type = 'student' THEN s.name
                 WHEN pu.entity_type = 'teacher' THEN t.name
            END AS entity_name
     FROM provisioned_users pu
     LEFT JOIN students s ON pu.entity_type = 'student' AND pu.entity_id = s.id
     LEFT JOIN teachers t ON pu.entity_type = 'teacher' AND pu.entity_id = t.id
     WHERE pu.email = $1
     LIMIT 1`,
    [userRef.toLowerCase()]
  )
  if (provRes.rows.length > 0) {
    const p = provRes.rows[0]

    // Follow entity_id → find an already-linked user account for this teacher/student.
    // When a teacher is already linked to a Google account via teacher_users, we borrow
    // their UUID so all downstream queries (teacher360, etc.) work correctly.
    if (p.entity_id) {
      let linkedUserRes = null
      if (p.entity_type === 'teacher') {
        linkedUserRes = await pool.query(
          `SELECT u.id, u.name FROM users u
           JOIN teacher_users tu ON u.id = tu.user_id
           WHERE tu.teacher_id = $1 LIMIT 1`,
          [p.entity_id]
        )
      } else if (p.entity_type === 'student') {
        linkedUserRes = await pool.query(
          `SELECT u.id, u.name FROM users u
           JOIN student_guardians sg ON u.id = sg.user_id
           WHERE sg.student_id = $1 LIMIT 1`,
          [p.entity_id]
        )
      }
      if (linkedUserRes && linkedUserRes.rows.length > 0) {
        const lu = linkedUserRes.rows[0]
        console.log(`[DEV] Provisioned user ${p.email} → using linked user UUID ${lu.id}`)
        return {
          id: lu.id,
          email: p.email,
          name: p.entity_name || lu.name,
          roles: [p.role],
          _provisioned: true,
        }
      }

      // No linked user found — auto-create the user + entity link for local dev.
      // This simulates what googleStrategy.js does on first real login.
      const crypto = require('crypto')
      const hash = crypto.createHash('sha256').update(p.email).digest('hex')
      const devId = [hash.slice(0,8), hash.slice(8,12), '4'+hash.slice(12,15), '8'+hash.slice(15,18), hash.slice(18,30)].join('-')

      const client = await pool.connect()
      try {
        await client.query('BEGIN')
        await client.query(
          `INSERT INTO users (id, email, name, google_id, email_verified)
           VALUES ($1, $2, $3, $4, true)
           ON CONFLICT (id) DO NOTHING`,
          [devId, p.email, p.entity_name || p.email, `dev-${p.email}`]
        )
        if (p.entity_type === 'teacher') {
          await client.query(
            `INSERT INTO teacher_users (user_id, teacher_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
            [devId, p.entity_id]
          )
        } else if (p.entity_type === 'student') {
          await client.query(
            `INSERT INTO student_guardians (user_id, student_id, relationship) VALUES ($1, $2, 'self') ON CONFLICT DO NOTHING`,
            [devId, p.entity_id]
          )
        }
        await client.query(
          `INSERT INTO user_roles (user_id, role, granted_by) VALUES ($1, $2, $1) ON CONFLICT DO NOTHING`,
          [devId, p.role]
        )
        await client.query('COMMIT')
        console.log(`[DEV] Auto-created local user ${devId} for provisioned email ${p.email}`)
      } catch (e) {
        await client.query('ROLLBACK')
        console.warn('[DEV] Auto-create user failed:', e.message)
      } finally {
        client.release()
      }

      return { id: devId, email: p.email, name: p.entity_name || p.email, roles: [p.role], _provisioned: true }
    }

    // No entity_id — fall back to nil UUID
    return {
      id: '00000000-0000-0000-0000-000000000000',
      email: p.email,
      name: p.entity_name || p.email,
      roles: [p.role],
      _provisioned: true,
    }
  }

  return null
}

app.use(async (req, _res, next) => {
  if (DISABLE_AUTH) {
    // Strip auth header to prevent passport from overwriting our dev user with a token
    delete req.headers.authorization
    req.user = currentDevOverride || DEV_DEFAULTS[currentDevProfile] || DEV_DEFAULTS.admin
  }
  next()
})

// GET /api/auth/config - Expose auth state to frontend
app.get('/api/auth/config', (req, res) => {
  res.json({
    authDisabled: DISABLE_AUTH,
    user: req.user || null,
    profile: currentDevProfile,
    devOverride: currentDevOverride ? { email: currentDevOverride.email, name: currentDevOverride.name } : null,
  })
})

// POST /api/dev/switch-profile — only available in local dev mode
if (DISABLE_AUTH) {
  app.post('/api/dev/switch-profile', async (req, res) => {
    const { profile, userRef } = req.body
    if (!DEV_DEFAULTS[profile]) {
      return res.status(400).json({ error: 'Invalid profile. Use: admin, teacher, student' })
    }
    currentDevProfile = profile
    currentDevOverride = null

    if (userRef && userRef.trim()) {
      try {
        const resolved = await resolveDevUser(userRef.trim())
        if (!resolved) {
          return res.status(404).json({ error: `No user or provisioned entry found for: ${userRef}` })
        }
        currentDevOverride = resolved
        console.log(`[DEV] Switched → ${profile} as ${resolved.email}${resolved._provisioned ? ' (provisioned, not yet activated)' : ''}`)
      } catch (e) {
        console.error('[DEV] resolveDevUser failed:', e.message)
        return res.status(500).json({ error: 'DB lookup failed: ' + e.message })
      }
    } else {
      console.log(`[DEV] Switched → ${profile} (default dev user)`)
    }

    res.json({
      success: true,
      profile: currentDevProfile,
      user: currentDevOverride || DEV_DEFAULTS[currentDevProfile],
    })
  })
}
// -----------------------------------------

// Route registrations
app.use('/api/auth',         require('./routes/auth'));
app.use('/api/instruments',  require('./routes/instruments'));
app.use('/api/batches',      require('./routes/batches'));
app.use('/api/attendance',   require('./routes/attendance'));
app.use('/api',              require('./routes/enrollment'));
app.use('/api/agent',        require('./routes/agent'));
app.use('/api/portal',       require('./routes/portal'));
app.use('/api/students',     require('./routes/students'));
const { router: student360Router } = require('./routes/student360');
app.use('/api/students',     student360Router);
app.use('/api/teachers',     require('./routes/teachers'));
app.use('/api/teachers',     require('./routes/teacher360'));
app.use('/api/payments',     require('./routes/payments'));
app.use('/api/users',        require('./routes/users'));
app.use('/api/finance',      require('./routes/finance'));
app.use('/api/finance',      require('./routes/payouts'));
app.use('/api/fee-structures', require('./routes/fee-structures'));
app.use('/api/notifications',require('./routes/notifications'));
app.use('/api/chat',         require('./routes/chat'));
app.use('/api/public/chat', require('./routes/publicChat'));
app.use('/api/prospects',    require('./routes/prospects'));
app.use('/api/migration',    require('./routes/migration'));
app.use('/api',              require('./routes/documents'));

// GET /api/packages — list all packages, optionally filtered by instrument_id and location
app.get('/api/packages', async (req, res) => {
  const { instrument_id, location } = req.query;
  try {
    let query = `
      SELECT p.id, p.name, p.classes_count, p.price, p.instrument_id, p.location,
             i.name AS instrument_name
      FROM packages p
      JOIN instruments i ON p.instrument_id = i.id
    `;
    const params = [];
    const conditions = [];

    if (instrument_id) {
      params.push(instrument_id);
      conditions.push(`p.instrument_id = $${params.length}`);
    }
    if (location) {
      params.push(location);
      conditions.push(`(p.location = $${params.length} OR p.location IS NULL)`);
    }
    if (conditions.length > 0) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    query += ' ORDER BY i.name, p.classes_count';
    const result = await pool.query(query, params);
    res.json({ packages: result.rows });
  } catch (err) {
    console.error('Packages fetch error:', err);
    res.status(500).json({ error: 'Failed to fetch packages' });
  }
});



const PORT = process.env.PORT || 3000
app.listen(PORT, '0.0.0.0', () => {
  console.log(`Enroll API listening on http://localhost:${PORT}`)
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`)
  console.log(`Database: ${process.env.DB_HOST || 'localhost'}:${process.env.DB_PORT || 5432}/${process.env.DB_NAME || 'hsm_dev'}`)
  if (DISABLE_AUTH) console.log('⚠️  Authentication: DISABLED (Local Dev Mode)')

  // Register background schedulers
  const { registerPayoutScheduler } = require('./scheduler/payoutScheduler')
  registerPayoutScheduler()
})
