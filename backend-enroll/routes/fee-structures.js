const express = require('express')
const router = express.Router()
const pool = require('../db')
const { authenticateJWT } = require('../auth/jwtMiddleware')
const { authorizeRole } = require('../auth/rbacMiddleware')

// GET /api/branches
// Returns all active branches
router.get('/branches', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, name, code FROM branches WHERE is_active = true ORDER BY name'
    )
    res.json({ branches: result.rows })
  } catch (err) {
    console.error('GET /branches error:', err)
    res.status(500).json({ error: 'Failed to fetch branches' })
  }
})

// GET /api/fee-structures?branch_id=&year=
// Returns all fee structures for a branch, filtered to a specific effective year.
// If year is omitted, returns the latest effective rates (most recent effective_from per row key).
router.get('/', async (req, res) => {
  const { branch_id, year } = req.query
  if (!branch_id) return res.status(400).json({ error: 'branch_id is required' })

  try {
    let rows
    if (year) {
      // Return rates that were effective during the given year
      // (the most recent effective_from <= year-end for each unique key)
      rows = await pool.query(
        `SELECT DISTINCT ON (fs.instrument_id, fs.trinity_grade, fs.classes_count)
           fs.id, fs.instrument_id, i.name AS instrument_name,
           fs.trinity_grade, fs.classes_count, fs.fee_amount,
           fs.is_trial, fs.effective_from
         FROM fee_structures fs
         JOIN instruments i ON i.id = fs.instrument_id
         WHERE fs.branch_id = $1
           AND fs.effective_from <= make_date($2::int, 12, 31)
         ORDER BY fs.instrument_id, fs.trinity_grade, fs.classes_count,
                  fs.effective_from DESC`,
        [branch_id, year]
      )
    } else {
      // Latest rates (effective_from <= today)
      rows = await pool.query(
        `SELECT DISTINCT ON (fs.instrument_id, fs.trinity_grade, fs.classes_count)
           fs.id, fs.instrument_id, i.name AS instrument_name,
           fs.trinity_grade, fs.classes_count, fs.fee_amount,
           fs.is_trial, fs.effective_from
         FROM fee_structures fs
         JOIN instruments i ON i.id = fs.instrument_id
         WHERE fs.branch_id = $1
           AND fs.effective_from <= CURRENT_DATE
         ORDER BY fs.instrument_id, fs.trinity_grade, fs.classes_count,
                  fs.effective_from DESC`,
        [branch_id]
      )
    }

    res.json({ fee_structures: rows.rows })
  } catch (err) {
    console.error('GET /fee-structures error:', err)
    res.status(500).json({ error: 'Failed to fetch fee structures' })
  }
})

// GET /api/fee-structures/years?branch_id=
// Returns distinct years that have fee data for a branch (for the year selector)
router.get('/years', async (req, res) => {
  const { branch_id } = req.query
  if (!branch_id) return res.status(400).json({ error: 'branch_id is required' })

  try {
    const result = await pool.query(
      `SELECT DISTINCT EXTRACT(YEAR FROM effective_from)::int AS year
       FROM fee_structures
       WHERE branch_id = $1
       ORDER BY year DESC`,
      [branch_id]
    )
    res.json({ years: result.rows.map(r => r.year) })
  } catch (err) {
    console.error('GET /fee-structures/years error:', err)
    res.status(500).json({ error: 'Failed to fetch years' })
  }
})

// GET /api/fee-structures/resolve?branch_id=&instrument_id=&trinity_grade=&classes_count=&is_trial=
// Resolves the current applicable fee for a given combination (used at enrollment time).
// When is_trial=true, overrides grade to 'Initial' and classes_count to 4.
router.get('/resolve', async (req, res) => {
  const { branch_id, instrument_id, trinity_grade, classes_count, is_trial } = req.query
  if (!branch_id || !instrument_id) {
    return res.status(400).json({ error: 'branch_id and instrument_id are required' })
  }

  const isTrial = is_trial === 'true'
  const resolveGrade = isTrial ? 'Initial' : trinity_grade
  const resolveCount = isTrial ? 4 : parseInt(classes_count)

  if (!resolveGrade || !resolveCount) {
    return res.status(400).json({ error: 'trinity_grade and classes_count are required for non-trial lookups' })
  }

  try {
    const result = await pool.query(
      `SELECT id, fee_amount, effective_from, is_trial
       FROM fee_structures
       WHERE branch_id = $1
         AND instrument_id = $2
         AND trinity_grade = $3
         AND classes_count = $4
         AND effective_from <= CURRENT_DATE
         AND is_trial = $5
       ORDER BY effective_from DESC
       LIMIT 1`,
      [branch_id, instrument_id, resolveGrade, resolveCount, isTrial]
    )

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No fee structure found for the given parameters' })
    }

    res.json({ fee_structure: result.rows[0] })
  } catch (err) {
    console.error('GET /fee-structures/resolve error:', err)
    res.status(500).json({ error: 'Failed to resolve fee structure' })
  }
})

// POST /api/fee-structures/bulk  (admin only)
// Upserts a batch of fee rates. Each row must include a new effective_from date.
// Body: { effective_from: 'YYYY-MM-DD', branch_id: uuid, rates: [{ instrument_id, trinity_grade, classes_count, fee_amount, is_trial }] }
router.post('/bulk', authenticateJWT, authorizeRole(['admin']), async (req, res) => {
  const { effective_from, branch_id, rates } = req.body

  if (!effective_from || !branch_id || !Array.isArray(rates) || rates.length === 0) {
    return res.status(400).json({ error: 'effective_from, branch_id, and rates[] are required' })
  }

  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    for (const rate of rates) {
      const { instrument_id, trinity_grade, classes_count, fee_amount, is_trial = false } = rate
      if (!instrument_id || !trinity_grade || !classes_count || fee_amount == null) {
        throw new Error(`Invalid rate entry: ${JSON.stringify(rate)}`)
      }

      await client.query(
        `INSERT INTO fee_structures
           (branch_id, instrument_id, trinity_grade, classes_count, fee_amount, is_trial, effective_from)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (branch_id, instrument_id, trinity_grade, classes_count, effective_from)
         DO UPDATE SET fee_amount = EXCLUDED.fee_amount, is_trial = EXCLUDED.is_trial`,
        [branch_id, instrument_id, trinity_grade, classes_count, fee_amount, is_trial, effective_from]
      )
    }

    await client.query('COMMIT')
    res.json({ success: true, saved: rates.length })
  } catch (err) {
    await client.query('ROLLBACK')
    console.error('POST /fee-structures/bulk error:', err)
    res.status(500).json({ error: err.message || 'Failed to save fee structures' })
  } finally {
    client.release()
  }
})

module.exports = router
