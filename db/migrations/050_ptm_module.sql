-- PTM (Parent-Teacher Meeting) module
-- Creates three tables: sessions, appointments per student, and action items

CREATE TABLE ptm_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  scheduled_date date NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'draft',
  created_by text,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE ptm_appointments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ptm_session_id uuid NOT NULL REFERENCES ptm_sessions(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES students(id),
  teacher_id uuid NOT NULL REFERENCES teachers(id),
  scheduled_time timestamptz,
  status text NOT NULL DEFAULT 'scheduled',
  parent_notified_at timestamptz,
  teacher_notified_at timestamptz,
  notes text,
  completed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(ptm_session_id, student_id)
);

CREATE TABLE ptm_action_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES ptm_appointments(id) ON DELETE CASCADE,
  action_text text NOT NULL,
  assigned_to text NOT NULL DEFAULT 'parent',
  due_date date,
  status text NOT NULL DEFAULT 'open',
  created_at timestamptz DEFAULT now(),
  resolved_at timestamptz
);

CREATE INDEX idx_ptm_appointments_session ON ptm_appointments(ptm_session_id);
CREATE INDEX idx_ptm_appointments_student ON ptm_appointments(student_id);
CREATE INDEX idx_ptm_action_items_appointment ON ptm_action_items(appointment_id);
