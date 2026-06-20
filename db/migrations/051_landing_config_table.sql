-- Store landing page configuration in the database so it persists across deploys.
-- Previously stored as a local file (backend-enroll/config/flash_banner.json)
-- which was reset on every Render redeploy.

CREATE TABLE IF NOT EXISTS landing_config (
  key   TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed with the current default so the banner stays visible until explicitly toggled off.
INSERT INTO landing_config (key, value)
VALUES (
  'flash_banner',
  '{
    "demo_day_banner_enabled": true,
    "demo_day_title": "Grand Demo Day Special",
    "demo_day_description": "Register on the spot during our upcoming Demo Day and get a chance to try all instruments! Special Spot Registration Offers apply",
    "demo_day_link_enabled": true,
    "demo_day_location": "hsm_main",
    "demo_day_date": "2026-06-13",
    "demo_day_instruments": ["Piano", "Guitar", "Drums", "Tabla", "Keyboard", "Violin"],
    "piano_teacher_title": "Starting New Piano Batches",
    "piano_teacher_description": "Learn classical & contemporary piano with our expert new resident teacher from June! Flexible weekday & weekend slot timings are open now."
  }'::jsonb
)
ON CONFLICT (key) DO NOTHING;
