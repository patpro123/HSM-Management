-- Migration 052: Marketing attribution — referral graph + metadata GIN index
-- Enables UTM tracking, referral linkage, and fast funnel queries on students.metadata

ALTER TABLE students ADD COLUMN IF NOT EXISTS referred_by_student_id UUID REFERENCES students(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_students_metadata_gin ON students USING gin(metadata);
CREATE INDEX IF NOT EXISTS idx_students_referred_by ON students(referred_by_student_id) WHERE referred_by_student_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_students_student_type ON students(student_type);

COMMENT ON COLUMN students.referred_by_student_id IS 'Referral graph: which existing student referred this prospect/student';

-- Convention: the following keys are stored in students.metadata JSONB for marketing:
--   utm_source        TEXT  — e.g. "google", "instagram", "facebook"
--   utm_medium        TEXT  — e.g. "cpc", "organic", "referral"
--   utm_campaign      TEXT  — campaign slug
--   utm_content       TEXT  — ad variant
--   referrer          TEXT  — document.referrer value from intake form
--   landing_page      TEXT  — URL path of the landing page where lead submitted
--   lead_score        INT   — heuristic score (0–100); higher = more likely to enroll
--   funnel_stage      TEXT  — overrides student_type for funnel grouping if needed
