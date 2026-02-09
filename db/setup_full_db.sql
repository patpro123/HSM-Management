-- ==================================================================================
-- HYDERABAD SCHOOL OF MUSIC (HSM) - FULL DATABASE SETUP SCRIPT
-- ==================================================================================
-- This script sets up the complete schema including all migrations up to 006.
-- It also includes seed data for instruments, packages, teachers, and sample students.
--
-- Usage: psql "your_connection_string" -f setup_full_db.sql
-- ==================================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2. ENUMS
DO $$ BEGIN
    CREATE TYPE attendance_status AS ENUM ('present','absent','excused');
EXCEPTION WHEN duplicate_object THEN null; END$$;

DO $$ BEGIN
    CREATE TYPE attendance_source AS ENUM ('whatsapp','web','manual');
EXCEPTION WHEN duplicate_object THEN null; END$$;

DO $$ BEGIN
    CREATE TYPE enrollment_status AS ENUM ('active','paused','completed');
EXCEPTION WHEN duplicate_object THEN null; END$$;

DO $$ BEGIN
    CREATE TYPE holiday_scope AS ENUM ('school','teacher','batch');
EXCEPTION WHEN duplicate_object THEN null; END$$;

DO $$ BEGIN
    CREATE TYPE payment_frequency AS ENUM ('monthly','quarterly','half_yearly','yearly');
EXCEPTION WHEN duplicate_object THEN null; END$$;

DO $$ BEGIN
    CREATE TYPE payout_type AS ENUM ('fixed','per_class','per_student_monthly');
EXCEPTION WHEN duplicate_object THEN null; END$$;

DO $$ BEGIN
    CREATE TYPE login_method AS ENUM ('google_oauth');
EXCEPTION WHEN duplicate_object THEN null; END$$;

DO $$ BEGIN
    CREATE TYPE user_role_type AS ENUM ('admin', 'teacher', 'parent', 'student');
EXCEPTION WHEN duplicate_object THEN null; END$$;

DO $$ BEGIN
    CREATE TYPE guardian_relationship AS ENUM ('parent', 'guardian', 'self');
EXCEPTION WHEN duplicate_object THEN null; END$$;

-- 3. CORE TABLES

-- Students Table (Updated with email column from Migration 006)
CREATE TABLE IF NOT EXISTS students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  dob date,
  phone text,
  guardian_contact text,
  email text UNIQUE, -- Promoted to top-level column
  metadata jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Teachers Table
CREATE TABLE IF NOT EXISTS teachers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  phone text,
  role text DEFAULT 'teacher',
  payout_terms jsonb DEFAULT '{}'::jsonb,
  is_active boolean DEFAULT true,
  payout_type payout_type DEFAULT 'per_class',
  rate numeric(10,2) DEFAULT 0 CHECK (rate >= 0),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Instruments Table
CREATE TABLE IF NOT EXISTS instruments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  max_batch_size integer NOT NULL DEFAULT 10,
  online_supported boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Batches Table
CREATE TABLE IF NOT EXISTS batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_id uuid NOT NULL REFERENCES instruments(id) ON DELETE RESTRICT,
  teacher_id uuid REFERENCES teachers(id) ON DELETE SET NULL,
  recurrence text NOT NULL,
  start_time time,
  end_time time,
  capacity integer NOT NULL DEFAULT 8,
  is_makeup boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enrollments Table
CREATE TABLE IF NOT EXISTS enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  instrument_id uuid REFERENCES instruments(id) ON DELETE RESTRICT,
  status enrollment_status NOT NULL DEFAULT 'active',
  classes_remaining integer NOT NULL DEFAULT 0 CHECK (classes_remaining >= 0),
  enrolled_on date DEFAULT CURRENT_DATE,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Enrollment Batches Table
CREATE TABLE IF NOT EXISTS enrollment_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES enrollments(id) ON DELETE CASCADE,
  batch_id uuid NOT NULL REFERENCES batches(id) ON DELETE RESTRICT,
  assigned_on date DEFAULT CURRENT_DATE,
  payment_frequency payment_frequency DEFAULT 'monthly',
  classes_remaining integer DEFAULT 0 CHECK (classes_remaining >= 0),
  enrolled_on date DEFAULT CURRENT_DATE
);

-- Attendance Records Table
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

-- Packages Table
CREATE TABLE IF NOT EXISTS packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  instrument_id uuid REFERENCES instruments(id) ON DELETE CASCADE,
  name text NOT NULL,
  classes_count integer NOT NULL CHECK (classes_count > 0),
  price numeric(10,2) NOT NULL CHECK (price >= 0),
  created_at timestamptz DEFAULT now()
);

-- Payments Table
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

-- Teacher Payouts Table
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

-- Holidays Table
CREATE TABLE IF NOT EXISTS holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  scope holiday_scope NOT NULL DEFAULT 'school',
  reason text,
  affected_batch_id uuid REFERENCES batches(id) ON DELETE SET NULL,
  created_at timestamptz DEFAULT now()
);

-- Audit Logs Table
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid,
  actor_role text,
  action text NOT NULL,
  payload jsonb DEFAULT '{}'::jsonb,
  timestamp timestamptz DEFAULT now()
);

-- Student Evaluations Table (From Migration 006)
CREATE TABLE IF NOT EXISTS student_evaluations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES teachers(id) ON DELETE SET NULL,
    evaluation_date date DEFAULT CURRENT_DATE,
    feedback text,
    rating integer,
    attachment_url text,
    type text DEFAULT 'review', -- values: review, certificate, homework
    title text,
    created_at timestamptz DEFAULT now()
);

-- 4. AUTHENTICATION TABLES

-- Users Table
CREATE TABLE IF NOT EXISTS users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    google_id text NOT NULL UNIQUE,
    email text NOT NULL UNIQUE,
    name text NOT NULL,
    profile_picture text,
    email_verified boolean DEFAULT false,
    locale text DEFAULT 'en',
    last_login timestamptz,
    is_active boolean DEFAULT true,
    created_at timestamptz DEFAULT now(),
    updated_at timestamptz DEFAULT now(),
    CONSTRAINT email_format CHECK (email ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$')
);

-- User Roles Table
CREATE TABLE IF NOT EXISTS user_roles (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role user_role_type NOT NULL,
    granted_at timestamptz DEFAULT now(),
    granted_by uuid REFERENCES users(id) ON DELETE SET NULL,
    revoked_at timestamptz,
    CONSTRAINT unique_user_role UNIQUE(user_id, role)
);

-- Teacher-User Linking
CREATE TABLE IF NOT EXISTS teacher_users (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    teacher_id uuid NOT NULL REFERENCES teachers(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    linked_at timestamptz DEFAULT now(),
    linked_by uuid REFERENCES users(id) ON DELETE SET NULL,
    is_active boolean DEFAULT true,
    CONSTRAINT unique_teacher_user UNIQUE(teacher_id, user_id),
    CONSTRAINT unique_teacher UNIQUE(teacher_id),
    CONSTRAINT unique_user_teacher UNIQUE(user_id)
);

-- Student-Guardian Linking
CREATE TABLE IF NOT EXISTS student_guardians (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    relationship guardian_relationship NOT NULL DEFAULT 'parent',
    is_primary boolean DEFAULT false,
    linked_at timestamptz DEFAULT now(),
    linked_by uuid REFERENCES users(id) ON DELETE SET NULL,
    is_active boolean DEFAULT true,
    CONSTRAINT unique_student_guardian UNIQUE(student_id, user_id)
);

-- Refresh Tokens
CREATE TABLE IF NOT EXISTS refresh_tokens (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    token text NOT NULL UNIQUE,
    expires_at timestamptz NOT NULL,
    created_at timestamptz DEFAULT now(),
    revoked_at timestamptz,
    revoked_reason text
);

-- Login History
CREATE TABLE IF NOT EXISTS login_history (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid REFERENCES users(id) ON DELETE SET NULL,
    login_timestamp timestamptz DEFAULT now(),
    ip_address text,
    user_agent text,
    login_method login_method NOT NULL DEFAULT 'google_oauth',
    success boolean NOT NULL,
    failure_reason text
);

-- 5. INDEXES
CREATE INDEX IF NOT EXISTS idx_students_phone ON students (phone);
CREATE INDEX IF NOT EXISTS idx_students_email ON students(email);
CREATE INDEX IF NOT EXISTS idx_enrollments_student ON enrollments (student_id);
CREATE INDEX IF NOT EXISTS idx_enrollment_batches_enrollment ON enrollment_batches (enrollment_id);
CREATE INDEX IF NOT EXISTS idx_attendance_batch_date ON attendance_records (batch_id, session_date);
CREATE INDEX IF NOT EXISTS idx_payments_student ON payments (student_id);
CREATE INDEX IF NOT EXISTS idx_evaluations_student ON student_evaluations(student_id);
CREATE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- 6. FUNCTIONS & TRIGGERS
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_users_updated_at ON users;
CREATE TRIGGER update_users_updated_at 
    BEFORE UPDATE ON users 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- ==================================================================================
-- SEED DATA
-- ==================================================================================

-- 1. Instruments
INSERT INTO instruments (name, max_batch_size, online_supported) VALUES
('Keyboard', 8, true),
('Guitar', 8, true),
('Piano', 4, false),
('Drums', 4, false),
('Tabla', 6, false),
('Violin', 6, false),
('Vocals', 10, true),
('Western Vocals', 10, true)
ON CONFLICT (name) DO NOTHING;

-- 2. Packages
-- We need instrument IDs to link packages, so we use a CTE or subquery
WITH inst AS (SELECT id, name FROM instruments)
INSERT INTO packages (instrument_id, name, classes_count, price) VALUES
((SELECT id FROM inst WHERE name='Keyboard'), 'Monthly', 8, 2500.00),
((SELECT id FROM inst WHERE name='Keyboard'), 'Quarterly', 24, 7000.00),
((SELECT id FROM inst WHERE name='Guitar'), 'Monthly', 8, 2500.00),
((SELECT id FROM inst WHERE name='Guitar'), 'Quarterly', 24, 7000.00),
((SELECT id FROM inst WHERE name='Piano'), 'Monthly', 8, 3500.00),
((SELECT id FROM inst WHERE name='Drums'), 'Monthly', 8, 3000.00)
ON CONFLICT DO NOTHING; -- Packages don't have unique constraint on name, so this might duplicate if run multiple times without cleanup

-- 3. Teachers
INSERT INTO teachers (name, phone, role, payout_type, rate) VALUES
('Ravi Kumar', '+919876543210', 'teacher', 'per_class', 500.00),
('Sarah Jones', '+919876543211', 'teacher', 'fixed', 25000.00),
('Amit Patel', '+919876543212', 'teacher', 'per_class', 600.00);

-- 4. Batches
-- Create some batches for Keyboard and Guitar
WITH 
  t_ravi AS (SELECT id FROM teachers WHERE name='Ravi Kumar' LIMIT 1),
  i_key AS (SELECT id FROM instruments WHERE name='Keyboard' LIMIT 1),
  i_gtr AS (SELECT id FROM instruments WHERE name='Guitar' LIMIT 1)
INSERT INTO batches (instrument_id, teacher_id, recurrence, start_time, end_time, capacity) VALUES
((SELECT id FROM i_key), (SELECT id FROM t_ravi), 'Mon/Wed', '17:00', '18:00', 8),
((SELECT id FROM i_key), (SELECT id FROM t_ravi), 'Tue/Thu', '18:00', '19:00', 8),
((SELECT id FROM i_gtr), (SELECT id FROM t_ravi), 'Sat/Sun', '10:00', '11:00', 6);

-- 5. Students & Enrollments (Sample Data)
DO $$
DECLARE
    v_student_id uuid;
    v_enrollment_id uuid;
    v_batch_id uuid;
    v_instrument_id uuid;
    v_package_id uuid;
BEGIN
    -- Create Student: Aarav Sharma
    INSERT INTO students (name, dob, phone, guardian_contact, email, metadata)
    VALUES (
        'Aarav Sharma', 
        '2015-06-15', 
        '+919988776655', 
        'Priya Sharma', 
        'a.r@gmail.com', -- Matches the test email used in development
        '{"address": "123 Jubilee Hills, Hyderabad", "total_credits": 24}'
    ) RETURNING id INTO v_student_id;

    -- Get Instrument: Keyboard
    SELECT id INTO v_instrument_id FROM instruments WHERE name = 'Keyboard' LIMIT 1;
    
    -- Get Batch: Mon/Wed
    SELECT id INTO v_batch_id FROM batches WHERE instrument_id = v_instrument_id LIMIT 1;

    -- Create Enrollment
    INSERT INTO enrollments (student_id, instrument_id, status, classes_remaining, enrolled_on)
    VALUES (v_student_id, v_instrument_id, 'active', 24, CURRENT_DATE - 30)
    RETURNING id INTO v_enrollment_id;

    -- Link to Batch
    INSERT INTO enrollment_batches (enrollment_id, batch_id, payment_frequency, classes_remaining, enrolled_on)
    VALUES (v_enrollment_id, v_batch_id, 'quarterly', 24, CURRENT_DATE - 30);

    -- Record Payment
    SELECT id INTO v_package_id FROM packages WHERE instrument_id = v_instrument_id AND name = 'Quarterly' LIMIT 1;
    
    INSERT INTO payments (student_id, package_id, amount, method, transaction_id, timestamp)
    VALUES (v_student_id, v_package_id, 7000.00, 'upi', 'TXN123456789', CURRENT_DATE - 30);

    -- Record Some Attendance (Present)
    INSERT INTO attendance_records (session_date, batch_id, student_id, status, source)
    VALUES 
    (CURRENT_DATE - 7, v_batch_id, v_student_id, 'present', 'manual'),
    (CURRENT_DATE - 5, v_batch_id, v_student_id, 'present', 'manual'),
    (CURRENT_DATE - 2, v_batch_id, v_student_id, 'absent', 'manual');

    -- Add a Student Evaluation (360 View Data)
    INSERT INTO student_evaluations (student_id, teacher_id, evaluation_date, feedback, rating, type, title)
    VALUES (
        v_student_id, 
        (SELECT teacher_id FROM batches WHERE id = v_batch_id),
        CURRENT_DATE - 1,
        'Aarav is showing great progress with scales. Needs to practice timing.',
        4,
        'review',
        'Monthly Review - January'
    );

    -- Create Admin User (for Auth testing)
    INSERT INTO users (google_id, email, name, is_active)
    VALUES ('google_123456789', 'partho.protim@gmail.com', 'Partho Admin', true);
    
    -- Assign Admin Role
    INSERT INTO user_roles (user_id, role)
    VALUES ((SELECT id FROM users WHERE email='partho.protim@gmail.com'), 'admin');

    -- Create Student User (for Portal testing)
    INSERT INTO users (google_id, email, name, is_active)
    VALUES ('google_987654321', 'a.r@gmail.com', 'Aarav Student', true);

    -- Assign Student Role
    INSERT INTO user_roles (user_id, role)
    VALUES ((SELECT id FROM users WHERE email='a.r@gmail.com'), 'student');

    -- Link Student User to Student Record
    INSERT INTO student_guardians (student_id, user_id, relationship, is_primary)
    VALUES (v_student_id, (SELECT id FROM users WHERE email='a.r@gmail.com'), 'self', true);

END $$;

-- 6. Create a second student for variety
DO $$
DECLARE
    v_student_id uuid;
    v_inst_id uuid;
    v_batch_id uuid;
BEGIN
    INSERT INTO students (name, phone, email, metadata)
    VALUES ('Sneha Reddy', '+918888888888', 'sneha@example.com', '{"address": "Gachibowli"}')
    RETURNING id INTO v_student_id;

    SELECT id INTO v_inst_id FROM instruments WHERE name='Guitar' LIMIT 1;
    SELECT id INTO v_batch_id FROM batches WHERE instrument_id = v_inst_id LIMIT 1;

    INSERT INTO enrollments (student_id, instrument_id, status, classes_remaining)
    VALUES (v_student_id, v_inst_id, 'active', 8);

    INSERT INTO enrollment_batches (enrollment_id, batch_id, payment_frequency, classes_remaining)
    VALUES ((SELECT id FROM enrollments WHERE student_id=v_student_id), v_batch_id, 'monthly', 8);
END $$;

-- End of Setup Script