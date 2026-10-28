-- Migration 033: Record how/why a WhatsApp contact opted in
-- Meta doesn't require submitting consent proof, but the business must keep its own
-- records in case of a dispute or quality review. Purely additive.

ALTER TABLE whatsapp_contacts
  ADD COLUMN IF NOT EXISTS consent_source text,  -- e.g. 'enrollment_form', 'whatsapp_self_serve', 'manual_admin_entry'
  ADD COLUMN IF NOT EXISTS consent_text   text;   -- the exact disclosure/message the contact agreed to

COMMENT ON COLUMN whatsapp_contacts.consent_source IS 'How opt-in was obtained — kept for Meta policy compliance, not submitted anywhere.';
COMMENT ON COLUMN whatsapp_contacts.consent_text IS 'Exact consent wording or inbound message the contact sent to opt in.';
