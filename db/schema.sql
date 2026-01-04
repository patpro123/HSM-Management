-- Hyderabad School of Music (HSM) — SQL DDL (PostgreSQL)
-- Generated: 2026-01-03

-- Requires PostgreSQL with `pgcrypto` (for gen_random_uuid)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Enums
DO $$ BEGIN
    CREATE TYPE attendance_status AS ENUM ('present','absent','excused');
EXCEPTION
    WHEN duplicate_object THEN null;
END$$;

DO $$ BEGIN
    CREATE TYPE attendance_source AS ENUM ('whatsapp','web','manual');
EXCEPTION
    WHEN duplicate_object THEN null;
END$$;

DO $$ BEGIN
    CREATE TYPE enrollment_status AS ENUM ('active','paused','completed');
EXCEPTION
    WHEN duplicate_object THEN null;
END$$;

DO $$ BEGIN
    CREATE TYPE holiday_scope AS ENUM ('school','teacher','batch');
EXCEPTION
    WHEN duplicate_object THEN null;
END$$;


-- Core tables
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

CREATE TABLE IF NOT EXISTS teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  role text DEFAULT 'teacher',
  payout_terms jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS instruments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  max_batch_size integer NOT NULL DEFAULT 10,
  online_supported boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

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

CREATE TABLE IF NOT EXISTS enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  instrument_id uuid NOT NULL REFERENCES instruments(id) ON DELETE RESTRICT,
  status enrollment_status NOT NULL DEFAULT 'active',
  classes_remaining integer NOT NULL DEFAULT 0 CHECK (classes_remaining >= 0),
  enrolled_on date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- join table: an enrollment can be assigned to multiple batches (normally 2 weekly)
CREATE TABLE IF NOT EXISTS enrollment_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  batch_id uuid NOT NULL REFERENCES batches(id) ON DELETE RESTRICT,
  assigned_on date DEFAULT CURRENT_DATE
);

CREATE TABLE IF NOT EXISTS attendance_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_date date NOT NULL,
  batch_id uuid NOT NULL REFERENCES batches(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  status attendance_status NOT NULL DEFAULT 'absent',
  source attendance_source NOT NULL DEFAULT 'whatsapp',
  finalized_at timestamptz,
  confidence numeric DEFAULT NULL,
  notes text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_id uuid REFERENCES instruments(id) ON DELETE CASCADE,
  name text NOT NULL,
  classes_count integer NOT NULL CHECK (classes_count > 0),
  price numeric(10,2) NOT NULL CHECK (price >= 0),
  created_at timestamptz DEFAULT now()
);

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

CREATE TABLE IF NOT EXISTS holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  scope holiday_scope NOT NULL DEFAULT 'school',
  reason text,
  affected_batch_id uuid REFERENCES batches(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_role text,
  action text NOT NULL,
  payload jsonb DEFAULT '{}'::jsonb,
  timestamp timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_students_phone ON students (phone);
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments (student_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_batches_enrollment ON enrollment_batches (enrollment_id);
CREATE INDEX IF NOT EXISTS idx_attendance_batch_date ON attendance_records (batch_id, session_date);
CREATE INDEX IF NOT EXISTS idx_payments_student ON payments (student_id);

-- Triggers to keep updated_at current can be added in application migrations (optional)

-- Example: seed packages for demo (uncomment to insert)
-- INSERT INTO packages (instrument_id, name, classes_count, price)
-- VALUES ('<instrument-uuid-here>', 'Monthly (8 classes)', 8, 2000.00),
--        ('<instrument-uuid-here>', 'Quarterly (24 classes)', 24, 5400.00);

-- End of schema
