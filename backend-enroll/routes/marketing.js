const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateJWT } = require('../auth/jwtMiddleware');
const { authorizeRole } = require('../auth/rbacMiddleware');

const adminOnly = [authenticateJWT, authorizeRole(['admin'])];

// ---------------------------------------------------------------------------
// FUNNEL
// ---------------------------------------------------------------------------

// GET /api/marketing/funnel
// Aggregate prospect/student counts by funnel stage using existing student data
router.get('/funnel', ...adminOnly, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        student_type                                  AS stage,
        COUNT(*)                                      AS count,
        COUNT(*) FILTER (WHERE is_active = true)     AS active_count,
        MIN(created_at)                               AS oldest,
        MAX(created_at)                               AS newest
      FROM students
      WHERE student_type IN ('intentful_user', 'prospect', 'demo_day', 'permanent')
      GROUP BY student_type
      ORDER BY
        CASE student_type
          WHEN 'intentful_user' THEN 1
          WHEN 'prospect'       THEN 2
          WHEN 'demo_day'       THEN 3
          WHEN 'permanent'      THEN 4
        END
    `);

    const referralCount = await pool.query(`
      SELECT COUNT(*) AS count
      FROM students
      WHERE referred_by_student_id IS NOT NULL
    `);

    res.json({
      funnel: rows,
      referral_count: parseInt(referralCount.rows[0].count, 10)
    });
  } catch (err) {
    console.error('[GET /api/marketing/funnel]', err.message);
    res.status(500).json({ error: 'Failed to fetch funnel data' });
  }
});

// GET /api/marketing/lead-sources
// Attribution breakdown: where are leads coming from?
router.get('/lead-sources', ...adminOnly, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        COALESCE(metadata->>'utm_source', metadata->>'lead_source', 'unknown') AS source,
        COALESCE(metadata->>'utm_medium', 'unknown')                           AS medium,
        COUNT(*)                                                                AS count
      FROM students
      WHERE student_type IN ('intentful_user', 'prospect', 'demo_day', 'permanent')
      GROUP BY 1, 2
      ORDER BY count DESC
      LIMIT 20
    `);
    res.json({ sources: rows });
  } catch (err) {
    console.error('[GET /api/marketing/lead-sources]', err.message);
    res.status(500).json({ error: 'Failed to fetch lead sources' });
  }
});

// ---------------------------------------------------------------------------
// OVERDUE PROSPECTS (Follow-up SLA alerts)
// ---------------------------------------------------------------------------

// GET /api/marketing/overdue-prospects?hours=48
// Prospects with no note activity within the given window
router.get('/overdue-prospects', ...adminOnly, async (req, res) => {
  const hours = parseInt(req.query.hours, 10) || 48;
  try {
    const { rows } = await pool.query(`
      SELECT
        s.id,
        s.name,
        s.phone,
        s.student_type,
        s.created_at,
        s.metadata,
        MAX(pn.created_at) AS last_note_at,
        EXTRACT(EPOCH FROM (NOW() - COALESCE(MAX(pn.created_at), s.created_at))) / 3600 AS hours_since_contact
      FROM students s
      LEFT JOIN prospect_notes pn ON pn.prospect_id = s.id
      WHERE s.student_type IN ('prospect', 'demo_day')
        AND s.is_active = true
      GROUP BY s.id, s.name, s.phone, s.student_type, s.created_at, s.metadata
      HAVING EXTRACT(EPOCH FROM (NOW() - COALESCE(MAX(pn.created_at), s.created_at))) / 3600 > $1
      ORDER BY hours_since_contact DESC
    `, [hours]);

    res.json({ overdue: rows, threshold_hours: hours });
  } catch (err) {
    console.error('[GET /api/marketing/overdue-prospects]', err.message);
    res.status(500).json({ error: 'Failed to fetch overdue prospects' });
  }
});

// ---------------------------------------------------------------------------
// ELIGIBLE EVALUATIONS (for testimonial promotion)
// ---------------------------------------------------------------------------

// GET /api/marketing/eligible-evaluations
// Student evaluations with rating >= 4 that haven't been promoted to testimonials yet
router.get('/eligible-evaluations', ...adminOnly, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        se.id             AS evaluation_id,
        se.student_id,
        s.name            AS student_name,
        se.rating,
        se.title,
        se.feedback,
        se.evaluation_date,
        (
          SELECT i.name
          FROM enrollments en
          JOIN enrollment_batches eb ON eb.enrollment_id = en.id
          JOIN batches b ON b.id = eb.batch_id
          JOIN instruments i ON i.id = b.instrument_id
          WHERE en.student_id = se.student_id
          LIMIT 1
        ) AS instrument,
        EXISTS (
          SELECT 1 FROM marketing_testimonials mt WHERE mt.evaluation_id = se.id
        ) AS already_promoted
      FROM student_evaluations se
      JOIN students s ON s.id = se.student_id
      WHERE se.rating >= 4
      ORDER BY se.evaluation_date DESC
      LIMIT 100
    `);
    res.json({ evaluations: rows });
  } catch (err) {
    console.error('[GET /api/marketing/eligible-evaluations]', err.message);
    res.status(500).json({ error: 'Failed to fetch eligible evaluations' });
  }
});

// ---------------------------------------------------------------------------
// TESTIMONIALS
// ---------------------------------------------------------------------------

// GET /api/marketing/testimonials
router.get('/testimonials', ...adminOnly, async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT
        mt.*,
        s.name AS student_name
      FROM marketing_testimonials mt
      LEFT JOIN students s ON s.id = mt.student_id
      ORDER BY mt.display_order ASC, mt.created_at DESC
    `);
    res.json({ testimonials: rows });
  } catch (err) {
    console.error('[GET /api/marketing/testimonials]', err.message);
    res.status(500).json({ error: 'Failed to fetch testimonials' });
  }
});

// GET /api/marketing/testimonials/published — public endpoint for landing page
router.get('/testimonials/published', async (req, res) => {
  try {
    const { rows } = await pool.query(`
      SELECT id, quote, author_name, instrument, media_url, rating, display_order
      FROM marketing_testimonials
      WHERE is_published = true AND consent_obtained = true
      ORDER BY display_order ASC, created_at DESC
    `);
    res.json({ testimonials: rows });
  } catch (err) {
    console.error('[GET /api/marketing/testimonials/published]', err.message);
    res.status(500).json({ error: 'Failed to fetch published testimonials' });
  }
});

// POST /api/marketing/testimonials
router.post('/testimonials', ...adminOnly, async (req, res) => {
  const { student_id, evaluation_id, quote, author_name, instrument, media_url, rating } = req.body;
  if (!quote || !author_name) {
    return res.status(400).json({ error: 'quote and author_name are required' });
  }
  try {
    const { rows } = await pool.query(`
      INSERT INTO marketing_testimonials
        (student_id, evaluation_id, quote, author_name, instrument, media_url, rating)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [student_id || null, evaluation_id || null, quote, author_name, instrument || null, media_url || null, rating || null]);
    res.status(201).json({ testimonial: rows[0] });
  } catch (err) {
    console.error('[POST /api/marketing/testimonials]', err.message);
    res.status(500).json({ error: 'Failed to create testimonial' });
  }
});

// PUT /api/marketing/testimonials/:id
router.put('/testimonials/:id', ...adminOnly, async (req, res) => {
  const { id } = req.params;
  const { quote, author_name, instrument, media_url, rating, is_published, consent_obtained, display_order } = req.body;

  // Enforce: cannot publish without consent
  if (is_published === true && consent_obtained === false) {
    return res.status(400).json({ error: 'Cannot publish testimonial without consent_obtained = true' });
  }

  try {
    const { rows } = await pool.query(`
      UPDATE marketing_testimonials SET
        quote             = COALESCE($1, quote),
        author_name       = COALESCE($2, author_name),
        instrument        = COALESCE($3, instrument),
        media_url         = COALESCE($4, media_url),
        rating            = COALESCE($5, rating),
        is_published      = COALESCE($6, is_published),
        consent_obtained  = COALESCE($7, consent_obtained),
        display_order     = COALESCE($8, display_order),
        updated_at        = NOW()
      WHERE id = $9
      RETURNING *
    `, [quote, author_name, instrument, media_url, rating, is_published, consent_obtained, display_order, id]);

    if (!rows.length) return res.status(404).json({ error: 'Testimonial not found' });
    res.json({ testimonial: rows[0] });
  } catch (err) {
    console.error('[PUT /api/marketing/testimonials/:id]', err.message);
    res.status(500).json({ error: 'Failed to update testimonial' });
  }
});

// DELETE /api/marketing/testimonials/:id
router.delete('/testimonials/:id', ...adminOnly, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('DELETE FROM marketing_testimonials WHERE id = $1', [id]);
    if (result.rowCount === 0) return res.status(404).json({ error: 'Testimonial not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/marketing/testimonials/:id]', err.message);
    res.status(500).json({ error: 'Failed to delete testimonial' });
  }
});

// ---------------------------------------------------------------------------
// BRAND ASSETS
// ---------------------------------------------------------------------------

// GET /api/marketing/brand-assets
router.get('/brand-assets', ...adminOnly, async (req, res) => {
  try {
    const { kind } = req.query;
    const params = [];
    let where = 'WHERE is_active = true';
    if (kind) {
      params.push(kind);
      where += ` AND kind = $${params.length}`;
    }
    const { rows } = await pool.query(
      `SELECT * FROM brand_assets ${where} ORDER BY kind, name`,
      params
    );
    res.json({ assets: rows });
  } catch (err) {
    console.error('[GET /api/marketing/brand-assets]', err.message);
    res.status(500).json({ error: 'Failed to fetch brand assets' });
  }
});

// POST /api/marketing/brand-assets
router.post('/brand-assets', ...adminOnly, async (req, res) => {
  const { kind, name, value, file_id, metadata } = req.body;
  if (!kind || !name) return res.status(400).json({ error: 'kind and name are required' });
  const validKinds = ['logo', 'color', 'tagline', 'photo', 'doc', 'template'];
  if (!validKinds.includes(kind)) {
    return res.status(400).json({ error: `kind must be one of: ${validKinds.join(', ')}` });
  }
  try {
    const { rows } = await pool.query(`
      INSERT INTO brand_assets (kind, name, value, file_id, metadata)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `, [kind, name, value || null, file_id || null, metadata ? JSON.stringify(metadata) : null]);
    res.status(201).json({ asset: rows[0] });
  } catch (err) {
    console.error('[POST /api/marketing/brand-assets]', err.message);
    res.status(500).json({ error: 'Failed to create brand asset' });
  }
});

// PUT /api/marketing/brand-assets/:id
router.put('/brand-assets/:id', ...adminOnly, async (req, res) => {
  const { id } = req.params;
  const { name, value, file_id, is_active, metadata } = req.body;
  try {
    const { rows } = await pool.query(`
      UPDATE brand_assets SET
        name      = COALESCE($1, name),
        value     = COALESCE($2, value),
        file_id   = COALESCE($3, file_id),
        is_active = COALESCE($4, is_active),
        metadata  = COALESCE($5::jsonb, metadata)
      WHERE id = $6
      RETURNING *
    `, [name, value, file_id, is_active, metadata ? JSON.stringify(metadata) : null, id]);
    if (!rows.length) return res.status(404).json({ error: 'Brand asset not found' });
    res.json({ asset: rows[0] });
  } catch (err) {
    console.error('[PUT /api/marketing/brand-assets/:id]', err.message);
    res.status(500).json({ error: 'Failed to update brand asset' });
  }
});

// DELETE /api/marketing/brand-assets/:id — soft delete (set is_active = false)
router.delete('/brand-assets/:id', ...adminOnly, async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(
      `UPDATE brand_assets SET is_active = false WHERE id = $1 RETURNING id`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Brand asset not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/marketing/brand-assets/:id]', err.message);
    res.status(500).json({ error: 'Failed to deactivate brand asset' });
  }
});

module.exports = router;
