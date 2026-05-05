-- Add payment proof (base64 screenshot) to teacher_payouts
ALTER TABLE teacher_payouts ADD COLUMN IF NOT EXISTS payment_proof TEXT;
ALTER TABLE teacher_payouts ADD COLUMN IF NOT EXISTS override_reason TEXT;
