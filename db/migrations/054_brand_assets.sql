-- Migration 054: Brand assets library
-- Central repository for approved brand materials (logos, colors, taglines, photos, templates)

CREATE TABLE IF NOT EXISTS brand_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  kind TEXT NOT NULL CHECK (kind IN ('logo', 'color', 'tagline', 'photo', 'doc', 'template')),
  name TEXT NOT NULL,
  value TEXT,
  file_id UUID REFERENCES file_storage(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brand_assets_kind ON brand_assets(kind, is_active);

COMMENT ON TABLE brand_assets IS 'Central brand asset library — single source of truth for logos, colors, taglines, and approved creative assets';
COMMENT ON COLUMN brand_assets.value IS 'Inline value for text assets (e.g. hex color code, tagline text, URL); null for file-based assets';
COMMENT ON COLUMN brand_assets.file_id IS 'Reference to file_storage for image/document assets';
COMMENT ON COLUMN brand_assets.metadata IS 'Additional attributes: e.g. {usage_context, dimensions, file_format, primary_color}';
