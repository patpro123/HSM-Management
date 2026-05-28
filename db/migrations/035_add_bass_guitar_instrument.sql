-- Add Bass Guitar as a new instrument option
INSERT INTO instruments (name, max_batch_size, online_supported)
VALUES ('Bass Guitar', 8, false)
ON CONFLICT (name) DO NOTHING;
