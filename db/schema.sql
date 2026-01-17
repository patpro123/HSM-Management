-- Hyderabad School of Music (HSM) — SQL DDL (PostgreSQL)
-- Generated: 2026-01-17
-- Complete schema with all migrations applied

-- Requires PostgreSQL with `pgcrypto` (for gen_random_uuid)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ==================== ENUMS ====================

-- Attendance status for marking student presence
DO $$ BEGIN
    CREATE TYPE attendance_status AS ENUM ('present','absent','excused');
EXCEPTION
    WHEN duplicate_object THEN null;
END$$;

-- Attendance source tracking (WhatsApp AI, web dashboard, manual entry)
DO $$ BEGIN
    CREATE TYPE attendance_source AS ENUM ('whatsapp','web','manual');
EXCEPTION
    WHEN duplicate_object THEN null;
END$$;

-- Enrollment status lifecycle
DO $$ BEGIN
    CREATE TYPE enrollment_status AS ENUM ('active','paused','completed');
EXCEPTION
    WHEN duplicate_object THEN null;
END$$;

-- Holiday scope (school-wide, teacher-specific, or batch-specific)
DO $$ BEGIN
    CREATE TYPE holiday_scope AS ENUM ('school','teacher','batch');
EXCEPTION
    WHEN duplicate_object THEN null;
END$$;

-- Payment frequency options (added via migration 003)
DO $$ BEGIN
    CREATE TYPE payment_frequency AS ENUM ('monthly','quarterly','half_yearly','yearly');
EXCEPTION
    WHEN duplicate_object THEN null;
END$$;

-- Teacher payout types (added via migration 002)
DO $$ BEGIN
    CREATE TYPE payout_type AS ENUM ('fixed','per_class','per_student_monthly');
EXCEPTION
    WHEN duplicate_object THEN null;
END$$;


-- ==================== CORE TABLES ====================

-- Students table (profiles and contact information)
CREATE TABLE IF NOT EXISTS students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  dob date,
  phone text,
  guardian_contact text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE students IS 'Student profiles with contact information and metadata';

-- Teachers table (instructor profiles and payout configuration)
CREATE TABLE IF NOT EXISTS teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  role text DEFAULT 'teacher',
  payout_terms jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  -- Added via migration 002
  payout_type payout_type DEFAULT 'per_class',
  rate numeric(10,2) DEFAULT 0 CHECK (rate >= 0)
);

COMMENT ON TABLE teachers IS 'Teacher profiles with payout configuration';
COMMENT ON COLUMN teachers.payout_type IS 'Type of payout: fixed (monthly salary) or per_class (per session)';
COMMENT ON COLUMN teachers.rate IS 'Rate amount: monthly salary for fixed, per-class amount for per_class';

-- Instruments table (available instruments for enrollment)
CREATE TABLE IF NOT EXISTS instruments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  max_batch_size integer NOT NULL DEFAULT 10,
  online_supported boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE instruments IS 'Available instruments (Keyboard, Guitar, Piano, Drums, Tabla, Violin, Vocals)';

-- Batches table (class schedules with teacher and instrument assignments)
CREATE TABLE IF NOT EXISTS batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_id uuid NOT NULL REFERENCES instruments(id) ON DELETE RESTRICT,
  teacher_id uuid REFERENCES teachers(id) ON DELETE SET NULL,
  recurrence text NOT NULL, -- e.g. "Tue/Thu 17:00-18:00" or cron-like
  start_time time,
  end_time time,
  capacity integer NOT NULL DEFAULT 8,
  is_makeup boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE batches IS 'Class batches with schedule, teacher, and capacity';
COMMENT ON COLUMN batches.recurrence IS 'Batch schedule description (e.g., "Tue/Thu 17:00-18:00")';
COMMENT ON COLUMN batches.is_makeup IS 'Whether this is a makeup class batch';

-- Enrollments table (one per student, supports multiple instruments via enrollment_batches)
-- Updated via migration 001 to make instrument_id nullable
CREATE TABLE IF NOT EXISTS enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  instrument_id uuid REFERENCES instruments(id) ON DELETE RESTRICT, -- Nullable since migration 001
  status enrollment_status NOT NULL DEFAULT 'active',
  classes_remaining integer NOT NULL DEFAULT 0 CHECK (classes_remaining >= 0),
  enrolled_on date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

COMMENT ON TABLE enrollments IS 'One enrollment per student. Batches (which are instrument+teacher specific) are linked via enrollment_batches table.';
COMMENT ON COLUMN enrollments.instrument_id IS 'Deprecated - kept for backward compatibility. Use enrollment_batches to link student to specific instrument batches.';
COMMENT ON COLUMN enrollments.classes_remaining IS 'Total classes remaining across all instruments for this student.';

-- Enrollment batches join table (links enrollments to specific batches)
-- Updated via migration 003 to add payment_frequency and classes_remaining
CREATE TABLE IF NOT EXISTS enrollment_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  batch_id uuid NOT NULL REFERENCES batches(id) ON DELETE RESTRICT,
  assigned_on date DEFAULT CURRENT_DATE,
  -- Added via migration 003
  payment_frequency payment_frequency DEFAULT 'monthly',
  classes_remaining integer DEFAULT 0 CHECK (classes_remaining >= 0),
  enrolled_on date DEFAULT CURRENT_DATE
);

COMMENT ON TABLE enrollment_batches IS 'Links enrollments to specific batches (instrument + teacher + schedule)';
COMMENT ON COLUMN enrollment_batches.payment_frequency IS 'Payment frequency: monthly (8 classes) or quarterly (24 classes)';
COMMENT ON COLUMN enrollment_batches.classes_remaining IS 'Classes remaining for this specific batch assignment';

-- Attendance records table (daily attendance tracking)
CREATE TABLE IF NOT EXISTS attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_date date NOT NULL,
  batch_id uuid NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  status attendance_status NOT NULL DEFAULT 'absent',
  source attendance_source NOT NULL DEFAULT 'whatsapp',
  finalized_at timestamptz,
  confidence numeric DEFAULT NULL, -- AI confidence score for WhatsApp-based attendance
  notes text,
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE attendance_records IS 'Daily attendance tracking with AI-assisted WhatsApp integration';
COMMENT ON COLUMN attendance_records.source IS 'Source of attendance: whatsapp (AI), web (dashboard), or manual';
COMMENT ON COLUMN attendance_records.confidence IS 'AI confidence score when source is whatsapp';

-- Packages table (pricing and class bundles)
CREATE TABLE IF NOT EXISTS packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_id uuid REFERENCES instruments(id) ON DELETE CASCADE,
  name text NOT NULL,
  classes_count integer NOT NULL CHECK (classes_count > 0),
  price numeric(10,2) NOT NULL CHECK (price >= 0),
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE packages IS 'Payment packages (Monthly 8 classes, Quarterly 24 classes, etc.)';

-- Payments table (payment transactions and history)
CREATE TABLE IF NOT EXISTS payments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  package_id uuid REFERENCES packages(id) ON DELETE SET NULL,
  amount numeric(10,2) NOT NULL CHECK (amount >= 0),
  method text,
  transaction_id text,
  metadata jsonb DEFAULT '{}'::jsonb,
  timestamp timestamptz DEFAULT now()
);

COMMENT ON TABLE payments IS 'Payment transactions with package and student references';

-- Teacher payouts table (payout records for teachers)
CREATE TABLE IF NOT EXISTS teacher_payouts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
  amount numeric(10,2) NOT NULL CHECK (amount >= 0),
  method text,
  period_start date,
  period_end date,
  linked_classes_count integer DEFAULT 0,
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE teacher_payouts IS 'Teacher payout records with period and class count tracking';

-- Holidays table (school/teacher/batch holidays)
CREATE TABLE IF NOT EXISTS holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  scope holiday_scope NOT NULL DEFAULT 'school',
  reason text,
  affected_batch_id uuid REFERENCES batches(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

COMMENT ON TABLE holidays IS 'Holiday tracking (school-wide, teacher-specific, or batch-specific)';

-- Audit logs table (system activity tracking)
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_role text,
  action text NOT NULL,
  payload jsonb DEFAULT '{}'::jsonb,
  timestamp timestamptz DEFAULT now()
);

COMMENT ON TABLE audit_logs IS 'System audit trail for tracking actions and changes';


-- ==================== INDEXES ====================

CREATE INDEX IF NOT EXISTS idx_students_phone ON students (phone);
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments (student_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_batches_enrollment ON enrollment_batches (enrollment_id);
CREATE INDEX IF NOT EXISTS idx_attendance_batch_date ON attendance_records (batch_id, session_date);
CREATE INDEX IF NOT EXISTS idx_payments_student ON payments (student_id);


-- ==================== NOTES ====================
-- 
-- Migrations Applied:
-- 1. migration 001: Made enrollments.instrument_id nullable for multi-instrument support
-- 2. migration 002: Added payout_type and rate columns to teachers table
-- 3. migration 003: Added payment_frequency and classes_remaining to enrollment_batches
--
-- Key Design Decisions:
-- - One enrollment per student (not per instrument)
-- - Multiple instruments supported via enrollment_batches table
-- - Each batch is specific to one instrument + teacher + schedule
-- - Attendance auto-deducts classes from enrollment_batches.classes_remaining
-- - Teachers can have fixed salary or per-class payout
-- - AI-assisted attendance via WhatsApp with confidence scoring
--
-- For seed data, see: seed.sql

-- End of schema
