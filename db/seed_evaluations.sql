-- Seed data for Student 360 View (Evaluations, Certificates, Homework)

-- Helper to get a student ID (picks the first one found)
WITH student_info AS (
    SELECT id FROM students LIMIT 1
),
teacher_info AS (
    SELECT id FROM teachers LIMIT 1
)
INSERT INTO student_evaluations (student_id, teacher_id, type, title, feedback, rating, evaluation_date)
SELECT 
    s.id, 
    t.id, 
    'review', 
    'Monthly Progress Review - January', 
    'Excellent progress on scales. Needs to work on timing for the new piece.', 
    4, 
    CURRENT_DATE - INTERVAL '2 days'
FROM student_info s, teacher_info t
UNION ALL
SELECT 
    s.id, 
    t.id, 
    'certificate', 
    'Grade 1 Completion', 
    'Successfully completed Grade 1 with Distinction.', 
    5, 
    CURRENT_DATE - INTERVAL '1 month'
FROM student_info s, teacher_info t
UNION ALL
SELECT 
    s.id, 
    t.id, 
    'homework', 
    'Scale Practice', 
    'Practice C Major and G Major scales 5 times daily.', 
    NULL, 
    CURRENT_DATE
FROM student_info s, teacher_info t;