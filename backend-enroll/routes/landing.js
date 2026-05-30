const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const { authenticateJWT } = require('../auth/jwtMiddleware');

const configPath = path.join(__dirname, '../config/flash_banner.json');

// Default initial config
const defaultConfig = {
  demo_day_title: "Grand Demo Day Special",
  demo_day_description: "Register on the spot during our upcoming Demo Day and get flat 15% off packages!",
  demo_day_link_enabled: true,
  demo_day_location: "hsm_main",
  demo_day_date: "2026-06-15",
  demo_day_instruments: ["Piano", "Guitar"],
  piano_teacher_title: "Starting New Piano Batches",
  piano_teacher_description: "Learn classical & contemporary piano with our expert new resident teacher from June! Flexible weekday & weekend slot timings are open now."
};

function readConfig() {
  try {
    if (!fs.existsSync(configPath)) {
      const configDir = path.dirname(configPath);
      if (!fs.existsSync(configDir)) {
        fs.mkdirSync(configDir, { recursive: true });
      }
      fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 2), 'utf8');
      return defaultConfig;
    }
    const raw = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    console.error('Error reading flash banner config:', err);
    return defaultConfig;
  }
}

function writeConfig(config) {
  try {
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('Error writing flash banner config:', err);
    return false;
  }
}

// GET /api/flash-banner - Public endpoint to retrieve banner configuration
router.get('/flash-banner', async (req, res) => {
  res.json(readConfig());
});

// POST /api/flash-banner - Restricted endpoint to update banner configuration
router.post('/flash-banner', authenticateJWT, async (req, res) => {
  const user = req.user;
  const isAuthorized = user && (user.roles.includes('admin') || user.roles.includes('teacher'));
  if (!isAuthorized) {
    return res.status(403).json({ error: 'Unauthorized: Only admins and teachers can edit landing settings.' });
  }

  const {
    demo_day_title,
    demo_day_description,
    demo_day_link_enabled,
    demo_day_location,
    demo_day_date,
    demo_day_instruments,
    piano_teacher_title,
    piano_teacher_description
  } = req.body;

  const current = readConfig();

  if (demo_day_title !== undefined) current.demo_day_title = demo_day_title;
  if (demo_day_description !== undefined) current.demo_day_description = demo_day_description;
  if (demo_day_link_enabled !== undefined) current.demo_day_link_enabled = !!demo_day_link_enabled;
  if (demo_day_location !== undefined) current.demo_day_location = demo_day_location;
  if (demo_day_date !== undefined) current.demo_day_date = demo_day_date;
  if (Array.isArray(demo_day_instruments)) current.demo_day_instruments = demo_day_instruments;
  if (piano_teacher_title !== undefined) current.piano_teacher_title = piano_teacher_title;
  if (piano_teacher_description !== undefined) current.piano_teacher_description = piano_teacher_description;

  if (writeConfig(current)) {
    res.json({ success: true, config: current });
  } else {
    res.status(500).json({ error: 'Failed to save flash banner configuration.' });
  }
});

module.exports = router;
