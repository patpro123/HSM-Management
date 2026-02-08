const express = require('express');
const router = express.Router();
const pool = require('../db');

/**
 * GET /api/students/:id/360
 * Aggregates profile, stats, next class, and latest evaluation for the 360 view.
 */
router.get('/students/:id/360', async (req, res) => {
  const { id } = req.params;

  try {
    // 1. Fetch Student Profile & Enrollment Stats
    const studentQuery = `
      SELECT 
        s.id, s.name, s.dob, s.phone, s.guardian_contact,
        e.classes_remaining, e.status as enrollment_status,
        (SELECT COUNT(*) FROM attendance_records ar WHERE ar.student_id = s.id AND ar.status = 'present') as total_attended
      FROM students s
      LEFT JOIN enrollments e ON s.id = e.student_id
      WHERE s.id = $1
    `;
    
    // 2. Fetch Active Batches (for Next Class logic)
    const batchesQuery = `
      SELECT 
        b.id, b.recurrence, b.start_time, b.end_time,
        i.name as instrument,
        t.name as teacher_name,
        eb.payment_frequency
      FROM enrollment_batches eb
      JOIN batches b ON eb.batch_id = b.id
      JOIN instruments i ON b.instrument_id = i.id
      LEFT JOIN teachers t ON b.teacher_id = t.id
      WHERE eb.enrollment_id = (SELECT id FROM enrollments WHERE student_id = $1)
    `;

    // 3. Fetch Latest Evaluation
    const evalQuery = `
      SELECT 
        se.*, t.name as teacher_name
      FROM student_evaluations se
      LEFT JOIN teachers t ON se.teacher_id = t.id
      WHERE se.student_id = $1
      ORDER BY se.evaluation_date DESC
      LIMIT 1
    `;

    const [studentRes, batchesRes, evalRes] = await Promise.all([
      pool.query(studentQuery, [id]),
      pool.query(batchesQuery, [id]),
      pool.query(evalQuery, [id])
    ]);

    if (studentRes.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const student = studentRes.rows[0];
    
    // Calculate attendance percentage (simple heuristic: attended / (attended + remaining) or just raw count)
    // For MVP, we just return the raw stats.
    
    const response = {
      student: {
        id: student.id,
        name: student.name,
        avatar: student.metadata?.avatar_url || null, // Assuming metadata stores avatar
        status: student.enrollment_status
      },
      stats: {
        total_classes_attended: parseInt(student.total_attended || 0),
        classes_remaining: student.classes_remaining || 0,
        active_batches: batchesRes.rows.map(b => ({
          instrument: b.instrument,
          plan: b.payment_frequency,
          schedule: b.recurrence
        }))
      },
      // In a real app, we'd calculate the exact next date based on recurrence.
      // For MVP, we return the schedule details for the frontend to display.
      schedule: batchesRes.rows,
      latest_evaluation: evalRes.rows[0] || null
    };

    res.json(response);

  } catch (err) {
    console.error('Error fetching student 360 view:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

/**
 * GET /api/students/:id/evaluations
 * Fetch full evaluation history
 */
router.get('/students/:id/evaluations', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(`
      SELECT se.*, t.name as teacher_name, b.recurrence as batch_info
      FROM student_evaluations se
      LEFT JOIN teachers t ON se.teacher_id = t.id
      LEFT JOIN batches b ON se.batch_id = b.id
      WHERE se.student_id = $1
      ORDER BY se.evaluation_date DESC
    `, [id]);
    res.json({ evaluations: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/students/:id/evaluations
 * Add a new evaluation
 */
router.post('/students/:id/evaluations', async (req, res) => {
  const { id } = req.params;
  const { teacher_id, batch_id, feedback, rating, milestone_reached, next_evaluation_date } = req.body;

  try {
    const result = await pool.query(`
      INSERT INTO student_evaluations 
      (student_id, teacher_id, batch_id, feedback, rating, milestone_reached, next_evaluation_date)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `, [id, teacher_id, batch_id, feedback, rating, milestone_reached, next_evaluation_date]);
    
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;