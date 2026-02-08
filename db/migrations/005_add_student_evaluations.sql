-- Migration: Add Student Evaluations Table
-- Description: Stores teacher feedback, ratings, and milestones for Student 360 view

CREATE TABLE IF NOT EXISTS student_evaluations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  teacher_id uuid REFERENCES teachers(id) ON DELETE SET NULL,
  
  -- Context
  batch_id uuid REFERENCES batches(id) ON DELETE SET NULL, -- Optional: link to specific batch
  evaluation_date date DEFAULT CURRENT_DATE,
  
  -- Content
  feedback text NOT NULL,                  -- The monthly report text
  rating integer CHECK (rating >= 1 AND rating <= 5), -- Optional 1-5 star rating
  milestone_reached text,                  -- e.g., "Trinity Grade 1", "Beginner Completed"
  attachment_url text,                     -- URL to uploaded report (S3/Blob)
  
  -- Scheduling
  next_evaluation_date date,               -- When the next review is due
  
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Index for fast retrieval by student
CREATE INDEX IF NOT EXISTS idx_evaluations_student ON student_evaluations(student_id);

COMMENT ON TABLE student_evaluations IS 'Monthly progress reports and milestones for students';