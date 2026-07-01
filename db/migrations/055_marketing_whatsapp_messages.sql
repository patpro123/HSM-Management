-- Marketing: WhatsApp event promotion message templates
CREATE TABLE IF NOT EXISTS marketing_whatsapp_messages (
  id                UUID          DEFAULT gen_random_uuid() PRIMARY KEY,
  name              TEXT          NOT NULL,
  event_name        TEXT          NOT NULL DEFAULT 'Demo Day',
  event_date        DATE,
  event_time        TEXT,
  venue             TEXT          NOT NULL DEFAULT 'HSM Main Branch',
  instruments       TEXT[]        NOT NULL DEFAULT '{}',
  registration_link TEXT          NOT NULL DEFAULT 'https://portal.hsm.org.in/demoday',
  special_info      TEXT,
  is_active         BOOLEAN       NOT NULL DEFAULT true,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);
