-- Add WhatsApp group invite link to batches for one-tap group notifications
ALTER TABLE batches ADD COLUMN IF NOT EXISTS whatsapp_group_link TEXT;
