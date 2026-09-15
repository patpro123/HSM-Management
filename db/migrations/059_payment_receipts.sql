-- Migration 059: Payment receipt generation
-- Adds receipt numbering (financial-year scoped) and a delivery audit log
-- so staff can generate/email/WhatsApp-forward a PDF receipt per payment.

ALTER TABLE payments
  ADD COLUMN IF NOT EXISTS receipt_number text UNIQUE,
  ADD COLUMN IF NOT EXISTS recorded_by uuid REFERENCES users(id);

COMMENT ON COLUMN payments.receipt_number IS
  'Financial-year scoped receipt number, e.g. HSM/2026-27/0001. Assigned lazily and idempotently on first receipt generation.';
COMMENT ON COLUMN payments.recorded_by IS
  'Staff user who recorded the payment. NULL for payments recorded before this column existed.';

CREATE TABLE IF NOT EXISTS receipt_number_counters (
  fiscal_year text PRIMARY KEY,      -- e.g. '2026-27' (Apr-Mar)
  last_number integer NOT NULL DEFAULT 0
);

COMMENT ON TABLE receipt_number_counters IS
  'One row per financial year; last_number is atomically incremented to assign the next receipt_number.';

CREATE TABLE IF NOT EXISTS receipt_deliveries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_id uuid NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
  channel text NOT NULL CHECK (channel IN ('email', 'whatsapp_manual')),
  recipient text,
  sent_by uuid REFERENCES users(id),
  status text NOT NULL DEFAULT 'sent',   -- 'sent' | 'failed' | 'initiated'
  error text,
  sent_at timestamptz DEFAULT now()
);

COMMENT ON TABLE receipt_deliveries IS
  'Audit log of receipt send actions. whatsapp_manual rows are logged optimistically (status initiated) since delivery is a manual hand-off, not API-confirmed.';

CREATE INDEX IF NOT EXISTS idx_receipt_deliveries_payment_id ON receipt_deliveries(payment_id);
