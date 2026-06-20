const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateJWT } = require('../auth/jwtMiddleware');

const CONFIG_KEY = 'flash_banner';

const defaultConfig = {
  demo_day_banner_enabled: true,
  demo_day_title: "Grand Demo Day Special",
  demo_day_description: "Register on the spot during our upcoming Demo Day and get a chance to try all instruments! Special Spot Registration Offers apply",
  demo_day_link_enabled: true,
  demo_day_location: "hsm_main",
  demo_day_date: "2026-06-13",
  demo_day_instruments: ["Piano", "Guitar", "Drums", "Tabla", "Keyboard", "Violin"],
  piano_teacher_title: "Starting New Piano Batches",
  piano_teacher_description: "Learn classical & contemporary piano with our expert new resident teacher from June! Flexible weekday & weekend slot timings are open now."
};

async function readConfig() {
  const result = await pool.query(
    'SELECT value FROM landing_config WHERE key = $1',
    [CONFIG_KEY]
  );
  return result.rows.length > 0 ? result.rows[0].value : defaultConfig;
}

async function writeConfig(config) {
  await pool.query(
    `INSERT INTO landing_config (key, value, updated_at)
     VALUES ($1, $2, now())
     ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = now()`,
    [CONFIG_KEY, JSON.stringify(config)]
  );
}

// GET /api/flash-banner - Public endpoint to retrieve banner configuration
router.get('/flash-banner', async (req, res) => {
  try {
    const config = await readConfig();
    res.json(config);
  } catch (err) {
    console.error('Error reading flash banner config:', err);
    res.json(defaultConfig);
  }
});

// POST /api/flash-banner - Restricted endpoint to update banner configuration
router.post('/flash-banner', authenticateJWT, async (req, res) => {
  const user = req.user;
  const isAuthorized = user && (user.roles.includes('admin') || user.roles.includes('teacher'));
  if (!isAuthorized) {
    return res.status(403).json({ error: 'Unauthorized: Only admins and teachers can edit landing settings.' });
  }

  const {
    demo_day_banner_enabled,
    demo_day_title,
    demo_day_description,
    demo_day_link_enabled,
    demo_day_location,
    demo_day_date,
    demo_day_instruments,
    piano_teacher_title,
    piano_teacher_description
  } = req.body;

  try {
    const current = await readConfig();

    if (demo_day_banner_enabled !== undefined) current.demo_day_banner_enabled = !!demo_day_banner_enabled;
    if (demo_day_title !== undefined) current.demo_day_title = demo_day_title;
    if (demo_day_description !== undefined) current.demo_day_description = demo_day_description;
    if (demo_day_link_enabled !== undefined) current.demo_day_link_enabled = !!demo_day_link_enabled;
    if (demo_day_location !== undefined) current.demo_day_location = demo_day_location;
    if (demo_day_date !== undefined) current.demo_day_date = demo_day_date;
    if (Array.isArray(demo_day_instruments)) current.demo_day_instruments = demo_day_instruments;
    if (piano_teacher_title !== undefined) current.piano_teacher_title = piano_teacher_title;
    if (piano_teacher_description !== undefined) current.piano_teacher_description = piano_teacher_description;

    await writeConfig(current);
    res.json({ success: true, config: current });
  } catch (err) {
    console.error('Error updating flash banner config:', err);
    res.status(500).json({ error: 'Failed to save flash banner configuration.' });
  }
});

module.exports = router;
