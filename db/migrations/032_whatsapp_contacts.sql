-- Migration 032: WhatsApp Cloud API integration
-- Adds opt-in contacts table and message audit log.
-- All existing functionality is unaffected; this is purely additive.

-- Registered contacts (one row per phone number)
CREATE TABLE IF NOT EXISTS whatsapp_contacts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone        text NOT NULL UNIQUE,         -- E.164 digits only, no +: "919876543210"
  student_id   uuid REFERENCES students(id) ON DELETE SET NULL,
  is_opted_in  boolean NOT NULL DEFAULT true,
  opted_in_at  timestamptz DEFAULT now(),
  opted_out_at timestamptz,
  wa_id        text,                          -- WhatsApp's own contact ID (populated on first reply)
  created_at   timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_contacts_student ON whatsapp_contacts(student_id);
CREATE INDEX IF NOT EXISTS idx_wa_contacts_phone   ON whatsapp_contacts(phone);

COMMENT ON TABLE whatsapp_contacts IS
  'Opt-in registry for WhatsApp Cloud API notifications. '
  'is_opted_in=false when contact sends STOP. '
  'phone is E.164 without leading +.';

-- Message audit log (outbound templates + inbound replies)
CREATE TABLE IF NOT EXISTS whatsapp_messages (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wa_message_id  text UNIQUE,                 -- Meta message ID (wamid.xxx)
  direction      text NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  phone          text NOT NULL,
  template_name  text,                        -- outbound template messages only
  body           text,
  status         text DEFAULT 'sent',         -- sent | delivered | read | failed
  student_id     uuid REFERENCES students(id) ON DELETE SET NULL,
  metadata       jsonb DEFAULT '{}'::jsonb,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_wa_messages_phone      ON whatsapp_messages(phone);
CREATE INDEX IF NOT EXISTS idx_wa_messages_student    ON whatsapp_messages(student_id);
CREATE INDEX IF NOT EXISTS idx_wa_messages_wa_id      ON whatsapp_messages(wa_message_id);

COMMENT ON TABLE whatsapp_messages IS
  'Audit log for all WhatsApp Cloud API messages (inbound and outbound).';
