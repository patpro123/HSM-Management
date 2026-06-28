-- Migration 053: Marketing testimonials
-- Promotes high-rating student evaluations into consented, publishable testimonials

CREATE TABLE IF NOT EXISTS marketing_testimonials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID REFERENCES students(id) ON DELETE SET NULL,
  evaluation_id UUID REFERENCES student_evaluations(id) ON DELETE SET NULL,
  quote TEXT NOT NULL,
  author_name TEXT NOT NULL,
  instrument TEXT,
  media_url TEXT,
  rating INT CHECK (rating BETWEEN 1 AND 5),
  is_published BOOLEAN NOT NULL DEFAULT false,
  consent_obtained BOOLEAN NOT NULL DEFAULT false,
  display_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_marketing_testimonials_published ON marketing_testimonials(is_published, display_order);
CREATE INDEX IF NOT EXISTS idx_marketing_testimonials_student ON marketing_testimonials(student_id);

COMMENT ON TABLE marketing_testimonials IS 'Consented student testimonials promoted from student_evaluations for public-facing use';
COMMENT ON COLUMN marketing_testimonials.consent_obtained IS 'Must be true before is_published can be set to true — guardian consent for minor students';
