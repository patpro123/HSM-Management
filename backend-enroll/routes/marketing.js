const express = require('express');
const https = require('https');
const router = express.Router();
const pool = require('../db');
const { authenticateJWT } = require('../auth/jwtMiddleware');
const { authorizeRole } = require('../auth/rbacMiddleware');
const { callLLM } = require('../llm/client');

const getJson = (urlString, headers = {}) => new Promise((resolve, reject) => {
  const url = new URL(urlString);
  const req = https.request(
    { method: 'GET', hostname: url.hostname, port: 443, path: url.pathname + (url.search || ''), headers },
    (res) => {
      let data = '';
      res.on('data', c => { data += c; });
      res.on('end', () => {
        if (res.statusCode >= 400) {
          const err = new Error(`HTTP ${res.statusCode}`);
          err.statusCode = res.statusCode;
          return reject(err);
        }
        try { resolve(JSON.parse(data)); } catch (e) { reject(new Error('Invalid JSON')); }
      });
    }
  );
  req.on('error', reject);
  req.end();
});

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

// ---------------------------------------------------------------------------
// LLM MODEL DISCOVERY
// ---------------------------------------------------------------------------

// GET /api/marketing/llm-models?provider=openrouter|gemini
// Returns available models for the given provider (free tier for OpenRouter)
router.get('/llm-models', ...adminOnly, async (req, res) => {
  const { provider = 'openrouter' } = req.query;

  if (provider === 'openrouter') {
    if (!process.env.OPENROUTER_API_KEY) {
      return res.status(503).json({ error: 'OPENROUTER_API_KEY not configured on server' });
    }
    try {
      const data = await getJson('https://openrouter.ai/api/v1/models', {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'https://hsm.school',
        'X-Title': 'HSM Management',
      });
      const freeModels = (data.data || [])
        .filter(m => m.id.includes(':free') || (m.pricing?.prompt === '0' && m.pricing?.completion === '0'))
        .map(m => ({ id: m.id, name: m.name || m.id }))
        .sort((a, b) => a.name.localeCompare(b.name));
      res.json({ models: freeModels, provider: 'openrouter' });
    } catch (err) {
      console.error('[GET /api/marketing/llm-models]', err.message);
      res.status(500).json({ error: 'Failed to fetch OpenRouter models' });
    }
  } else if (provider === 'gemini') {
    res.json({
      models: [
        { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash' },
        { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash' },
        { id: 'gemini-1.5-flash', name: 'Gemini 1.5 Flash' },
        { id: 'gemini-1.5-pro', name: 'Gemini 1.5 Pro' },
      ],
      provider: 'gemini',
    });
  } else {
    res.status(400).json({ error: 'provider must be openrouter or gemini' });
  }
});

// ---------------------------------------------------------------------------
// AI COPYWRITER
// ---------------------------------------------------------------------------

// POST /api/marketing/ai-copy
router.post('/ai-copy', ...adminOnly, async (req, res) => {
  if (!process.env.OPENROUTER_API_KEY && !process.env.GEMINI_API_KEY) {
    return res.status(503).json({ error: 'No AI provider configured. Set OPENROUTER_API_KEY or GEMINI_API_KEY.' });
  }

  const { content_type, audience, tone, instrument, custom_context } = req.body;

  const validTypes = ['tagline', 'social_post', 'ad_copy', 'whatsapp_message', 'email_subject', 'email_body'];
  if (!content_type || !validTypes.includes(content_type)) {
    return res.status(400).json({ error: `content_type must be one of: ${validTypes.join(', ')}` });
  }

  try {
    const [instrRows, countRow, testimonialRows] = await Promise.all([
      pool.query('SELECT name FROM instruments ORDER BY name'),
      pool.query("SELECT COUNT(*) FROM students WHERE student_type = 'permanent' AND is_active = true"),
      pool.query(`
        SELECT quote, author_name, instrument
        FROM marketing_testimonials
        WHERE is_published = true AND consent_obtained = true
        ORDER BY rating DESC NULLS LAST
        LIMIT 3
      `),
    ]);

    const instrumentList = instrRows.rows.map(r => r.name).join(', ');
    const studentCount = countRow.rows[0].count;
    const testimonialSample = testimonialRows.rows.length
      ? testimonialRows.rows.map(t => `"${t.quote}" — ${t.author_name}${t.instrument ? ` (${t.instrument})` : ''}`).join('\n')
      : 'None yet';

    const hsmContext = `
School: Hyderabad School of Music (HSM)
Location: Hyderabad, India
Instruments: ${instrumentList}
Active enrolled students: ${studentCount}+
Schedule: Tue–Fri evenings, Sat–Sun afternoons & evenings
Unique strengths: Personal attention, experienced teachers, structured curriculum, friendly community
Sample testimonials:
${testimonialSample}
${instrument ? `Focus instrument for this copy: ${instrument}` : ''}
${custom_context ? `Additional context: ${custom_context}` : ''}
`.trim();

    const contentTypeDescriptions = {
      tagline: 'a punchy brand tagline (under 10 words)',
      social_post: 'a social media post for Instagram/Facebook (2-4 sentences with a call to action)',
      ad_copy: 'short ad copy for Google/Meta ads (headline + 2-line description)',
      whatsapp_message: 'a warm WhatsApp broadcast message to prospective parents (3-5 sentences)',
      email_subject: 'an email subject line (under 60 characters, compelling)',
      email_body: 'a short marketing email body (3-4 paragraphs, warm and professional)',
    };

    const audienceDescriptions = {
      parents_kids: 'parents of children (6–16 years) looking for music classes',
      adult_learners: 'adults who want to learn music as a hobby or for personal growth',
      general: 'a broad audience of music enthusiasts in Hyderabad',
      corporate: 'corporate professionals interested in team music experiences or gift cards',
    };

    const toneDescriptions = {
      warm: 'warm, personal, and community-focused',
      professional: 'professional, credible, and achievement-oriented',
      playful: 'playful, energetic, and fun',
      inspiring: 'inspiring, aspirational, and emotionally resonant',
    };

    const selectedAudience = audienceDescriptions[audience] || audienceDescriptions['general'];
    const selectedTone = toneDescriptions[tone] || toneDescriptions['warm'];

    const prompt = `You are a creative marketing copywriter for a music school in India.

SCHOOL CONTEXT:
${hsmContext}

TASK:
Write 3 distinct variations of ${contentTypeDescriptions[content_type]}.

TARGET AUDIENCE: ${selectedAudience}
TONE: ${selectedTone}

Requirements:
- Each variation must be meaningfully different (different angle, emotion, or hook)
- Stay authentic to HSM's community-focused culture
- Use natural, relatable language (avoid corporate jargon)
- Do not use excessive exclamation marks
- Each variation should stand alone and be immediately usable

Return a JSON array with exactly 3 objects, each having:
- "text": the copy text
- "angle": a 2-4 word label for the creative angle (e.g. "Community focus", "Achievement story")`;

    const result = await callLLM({
      messages: [{ role: 'user', content: prompt }],
      provider: 'openrouter',
      fallbackChain: ['gemini'],
      jsonMode: true,
    });

    let variants;
    try {
      const rawText = (result.content || '').trim();
      const jsonMatch = rawText.match(/\[[\s\S]*\]/);
      variants = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);
    } catch {
      return res.status(500).json({ error: 'AI returned unexpected format', raw: result.content });
    }

    res.json({ variants, content_type, audience, tone });
  } catch (err) {
    console.error('[POST /api/marketing/ai-copy]', err.message);
    res.status(500).json({ error: 'Failed to generate copy' });
  }
});

// ---------------------------------------------------------------------------
// AI IMAGE PROMPT GENERATOR (Pollinations.ai)
// ---------------------------------------------------------------------------

const IMAGE_DIMENSIONS = {
  social_square: { width: 1080, height: 1080, label: 'Social Square (1:1)' },
  banner:        { width: 1200, height: 630,  label: 'Banner (1.9:1)' },
  story:         { width: 768,  height: 1344, label: 'Story (9:16)' },
  logo_concept:  { width: 512,  height: 512,  label: 'Logo Concept' },
  whatsapp:      { width: 800,  height: 800,  label: 'WhatsApp Image' },
};

// POST /api/marketing/ai-image-prompt
router.post('/ai-image-prompt', ...adminOnly, async (req, res) => {
  if (!process.env.OPENROUTER_API_KEY && !process.env.GEMINI_API_KEY) {
    return res.status(503).json({ error: 'No AI provider configured. Set OPENROUTER_API_KEY or GEMINI_API_KEY.' });
  }

  const { image_type = 'social_square', audience, instrument, custom_context } = req.body;

  if (!IMAGE_DIMENSIONS[image_type]) {
    return res.status(400).json({ error: `image_type must be one of: ${Object.keys(IMAGE_DIMENSIONS).join(', ')}` });
  }

  const { width, height } = IMAGE_DIMENSIONS[image_type];

  try {
    const [instrRows, countRow] = await Promise.all([
      pool.query('SELECT name FROM instruments ORDER BY name'),
      pool.query("SELECT COUNT(*) FROM students WHERE student_type = 'permanent' AND is_active = true"),
    ]);

    const instrumentList = instrRows.rows.map(r => r.name).join(', ');
    const studentCount = countRow.rows[0].count;

    const audienceDescriptions = {
      parents_kids: 'parents of children aged 6–16',
      adult_learners: 'adults learning music as a personal hobby',
      general: 'a broad Indian urban audience',
      corporate: 'corporate professionals interested in team experiences',
    };

    const prompt = `You are an expert at writing image generation prompts for AI image models (Stable Diffusion / FLUX style).

SCHOOL CONTEXT:
- Name: Hyderabad School of Music (HSM)
- Location: Hyderabad, India
- Instruments offered: ${instrumentList}
- Active students: ${studentCount}+
- Vibe: warm, community-focused, modern yet rooted in Indian classical music heritage
- Brand colors: warm orange, white, deep charcoal
${instrument ? `- Featured instrument: ${instrument}` : ''}
${custom_context ? `- Additional context: ${custom_context}` : ''}

TARGET AUDIENCE: ${audienceDescriptions[audience] || 'general music enthusiasts'}
IMAGE FORMAT: ${IMAGE_DIMENSIONS[image_type].label} — optimized for ${image_type.replace('_', ' ')}

Generate 3 distinct image prompts. Each must have a completely different visual concept:
1. One featuring people / human emotion
2. One featuring instruments / music objects
3. One featuring atmosphere / abstract mood

Each prompt must be:
- Highly detailed and visual (describe subject, style, lighting, mood, colors)
- Suitable for a professional music school's marketing
- Culturally resonant with urban India
- Between 40–80 words
- NOT contain any text overlays or typography instructions

Return a JSON array with exactly 3 objects:
[
  { "angle": "2-4 word concept label", "prompt": "the full image generation prompt" },
  { "angle": "...", "prompt": "..." },
  { "angle": "...", "prompt": "..." }
]`;

    const result = await callLLM({
      messages: [{ role: 'user', content: prompt }],
      provider: 'openrouter',
      fallbackChain: ['gemini'],
      jsonMode: true,
    });

    let concepts;
    try {
      const rawText = (result.content || '').trim();
      const jsonMatch = rawText.match(/\[[\s\S]*\]/);
      concepts = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);
    } catch {
      return res.status(500).json({ error: 'AI returned unexpected format', raw: result.content });
    }

    const images = concepts.map((c, i) => {
      const seed = Math.floor(Math.random() * 9000000) + 1000000;
      const encodedPrompt = encodeURIComponent(
        `${c.prompt}, professional photography, high quality, sharp focus`
      );
      return {
        angle: c.angle,
        prompt: c.prompt,
        seed,
        width,
        height,
        url: `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${width}&height=${height}&nologo=true&model=flux&seed=${seed}`,
        thumbnail_url: `https://image.pollinations.ai/prompt/${encodedPrompt}?width=${Math.round(width / 2)}&height=${Math.round(height / 2)}&nologo=true&model=flux&seed=${seed}`,
      };
    });

    res.json({ images, image_type, dimensions: { width, height } });
  } catch (err) {
    console.error('[POST /api/marketing/ai-image-prompt]', err.message);
    res.status(500).json({ error: 'Failed to generate image prompts' });
  }
});

// ---------------------------------------------------------------------------
// AI WHATSAPP EVENT PROMO GENERATOR
// ---------------------------------------------------------------------------

// POST /api/marketing/ai-whatsapp-promo
// Generates a warm, event-specific WhatsApp promo message from structured fields
router.post('/ai-whatsapp-promo', ...adminOnly, async (req, res) => {
  if (!process.env.OPENROUTER_API_KEY && !process.env.GEMINI_API_KEY) {
    return res.status(503).json({ error: 'No AI provider configured. Set OPENROUTER_API_KEY or GEMINI_API_KEY.' });
  }

  const { event_name, event_date, event_time, venue, instruments, registration_link, special_info, max_words, llm_provider, llm_model } = req.body;
  const wordLimit = Math.max(50, Math.min(500, parseInt(max_words, 10) || 150));

  try {
    const [countRow, testimonialRows] = await Promise.all([
      pool.query("SELECT COUNT(*) FROM students WHERE student_type = 'permanent' AND is_active = true"),
      pool.query(`
        SELECT quote, author_name
        FROM marketing_testimonials
        WHERE is_published = true AND consent_obtained = true
        ORDER BY rating DESC NULLS LAST
        LIMIT 2
      `),
    ]);

    const studentCount = countRow.rows[0].count;
    const testimonialSample = testimonialRows.rows.length
      ? testimonialRows.rows.map(t => `"${t.quote}" — ${t.author_name}`).join('\n')
      : '';

    let dateDisplay = '';
    if (event_date) {
      const d = new Date(event_date + 'T00:00:00');
      const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
      const months = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
      dateDisplay = `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
    }

    const prompt = `You are a warm, enthusiastic community writer for Hyderabad School of Music (HSM), a beloved music school in Hyderabad, India, with ${studentCount}+ enrolled students. You write like a trusted friend who genuinely loves music and the community.

Write a WhatsApp broadcast message to promote the following event. The goal is to excite parents, students, and music lovers — and get them to register.

EVENT DETAILS:
- Event: ${event_name || 'Demo Day'}
${dateDisplay ? `- Date: ${dateDisplay}` : ''}
${event_time ? `- Time: ${event_time}` : ''}
- Venue: ${venue || 'HSM Main Branch'}, Hyderabad
${instruments && instruments.length > 0 ? `- Instruments showcased: ${instruments.join(', ')}` : ''}
- Registration link: ${registration_link || 'https://portal.hsm.org.in/demoday'}
${special_info ? `- Special information: ${special_info}` : ''}
${testimonialSample ? `\nWhat our community says:\n${testimonialSample}` : ''}

RULES:
- Use WhatsApp markdown: *bold text* for key details like the event name, date, and CTA
- Use emojis tastefully — 4 to 6 total, not at every line
- Write in natural flowing paragraphs — no robotic bullet lists
- Keep it under ${wordLimit} words — the user has requested this length limit; respect it strictly
- Weave all event details into the narrative naturally
- Include a clear, warm call-to-action with the registration link
- End with a friendly sign-off from *Team HSM* 🎶
- Do NOT use corporate phrases like "we are pleased to announce" or "kindly be informed"
- Write as if personally inviting a close friend who would genuinely enjoy this

Return ONLY the WhatsApp message text. No quotes, no explanation.`;

    const result = await callLLM({
      messages: [{ role: 'user', content: prompt }],
      provider: llm_provider || 'openrouter',
      fallbackChain: llm_provider ? [] : ['gemini'],
      jsonMode: false,
      modelOverride: llm_model || undefined,
    });

    const messageText = (result.content || '').trim();
    if (!messageText) return res.status(500).json({ error: 'AI returned an empty response' });

    res.json({ message: messageText });
  } catch (err) {
    console.error('[POST /api/marketing/ai-whatsapp-promo]', err.message);
    res.status(500).json({ error: 'Failed to generate WhatsApp message' });
  }
});

// ---------------------------------------------------------------------------
// WHATSAPP EVENT PROMOTION MESSAGES
// ---------------------------------------------------------------------------

// GET /api/marketing/whatsapp-messages
router.get('/whatsapp-messages', ...adminOnly, async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT * FROM marketing_whatsapp_messages WHERE is_active = true ORDER BY updated_at DESC`
    );
    res.json({ messages: rows });
  } catch (err) {
    console.error('[GET /api/marketing/whatsapp-messages]', err.message);
    res.status(500).json({ error: 'Failed to fetch WhatsApp messages' });
  }
});

// POST /api/marketing/whatsapp-messages
router.post('/whatsapp-messages', ...adminOnly, async (req, res) => {
  const { name, event_name, event_date, event_time, venue, instruments, registration_link, special_info } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });
  try {
    const { rows } = await pool.query(`
      INSERT INTO marketing_whatsapp_messages
        (name, event_name, event_date, event_time, venue, instruments, registration_link, special_info)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      RETURNING *
    `, [
      name,
      event_name || 'Demo Day',
      event_date || null,
      event_time || null,
      venue || 'HSM Main Branch',
      instruments || [],
      registration_link || 'https://portal.hsm.org.in/demoday',
      special_info || null,
    ]);
    res.status(201).json({ message: rows[0] });
  } catch (err) {
    console.error('[POST /api/marketing/whatsapp-messages]', err.message);
    res.status(500).json({ error: 'Failed to create WhatsApp message' });
  }
});

// PUT /api/marketing/whatsapp-messages/:id
router.put('/whatsapp-messages/:id', ...adminOnly, async (req, res) => {
  const { id } = req.params;
  const { name, event_name, event_date, event_time, venue, instruments, registration_link, special_info } = req.body;
  try {
    const { rows } = await pool.query(`
      UPDATE marketing_whatsapp_messages SET
        name              = COALESCE($1, name),
        event_name        = COALESCE($2, event_name),
        event_date        = $3,
        event_time        = COALESCE($4, event_time),
        venue             = COALESCE($5, venue),
        instruments       = COALESCE($6, instruments),
        registration_link = COALESCE($7, registration_link),
        special_info      = $8,
        updated_at        = NOW()
      WHERE id = $9 AND is_active = true
      RETURNING *
    `, [name, event_name, event_date || null, event_time, venue, instruments, registration_link, special_info || null, id]);
    if (!rows.length) return res.status(404).json({ error: 'Message not found' });
    res.json({ message: rows[0] });
  } catch (err) {
    console.error('[PUT /api/marketing/whatsapp-messages/:id]', err.message);
    res.status(500).json({ error: 'Failed to update WhatsApp message' });
  }
});

// DELETE /api/marketing/whatsapp-messages/:id — soft delete
router.delete('/whatsapp-messages/:id', ...adminOnly, async (req, res) => {
  const { id } = req.params;
  try {
    const { rows } = await pool.query(
      `UPDATE marketing_whatsapp_messages SET is_active = false WHERE id = $1 RETURNING id`,
      [id]
    );
    if (!rows.length) return res.status(404).json({ error: 'Message not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('[DELETE /api/marketing/whatsapp-messages/:id]', err.message);
    res.status(500).json({ error: 'Failed to delete WhatsApp message' });
  }
});

module.exports = router;
