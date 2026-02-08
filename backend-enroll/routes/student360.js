const express = require('express');
const router = express.Router();
const pool = require('../db'); // Adjust path to your db configuration

const fetchStudent360Data = async (studentId) => {
    // 1. Fetch Personal Details
    const studentQuery = 'SELECT * FROM students WHERE id = $1';
    const studentRes = await pool.query(studentQuery, [studentId]);

    if (studentRes.rows.length === 0) {
      return null;
    }
    const student = studentRes.rows[0];

    // 2. Fetch Attendance Summary
    const attendanceQuery = `
      SELECT 
        COUNT(*) FILTER (WHERE status = 'present') as present,
        COUNT(*) FILTER (WHERE status = 'absent') as absent,
        COUNT(*) FILTER (WHERE status = 'excused') as excused
      FROM attendance_records 
      WHERE student_id = $1
    `;
    const attendanceRes = await pool.query(attendanceQuery, [studentId]);
    const attendance = attendanceRes.rows[0];

    // 3. Fetch Academic Batches
    // Joining enrollments -> enrollment_batches -> batches -> instruments/teachers
    const batchesQuery = `
      SELECT 
        b.id,
        i.name as instrument,
        b.recurrence,
        t.name as teacher,
        e.classes_remaining
      FROM enrollments e
      JOIN enrollment_batches eb ON e.id = eb.enrollment_id
      JOIN batches b ON eb.batch_id = b.id
      LEFT JOIN instruments i ON b.instrument_id = i.id
      LEFT JOIN teachers t ON b.teacher_id = t.id
      WHERE e.student_id = $1 AND e.status = 'active'
    `;
    const batchesRes = await pool.query(batchesQuery, [studentId]);

    // 4. Fetch Payment History
    const paymentsQuery = `
      SELECT id, amount, timestamp, method, package_id
      FROM payments
      WHERE student_id = $1
      ORDER BY timestamp DESC
    `;
    const paymentsRes = await pool.query(paymentsQuery, [studentId]);

    // Calculate Payment Summary
    const classesAttended = parseInt(attendance.present || 0);
    const classesMissed = parseInt(attendance.absent || 0);
    
    let classesRemaining;
    if (student.metadata && student.metadata.total_credits !== undefined) {
      classesRemaining = parseInt(student.metadata.total_credits) - (classesAttended + classesMissed);
    } else {
      classesRemaining = batchesRes.rows.reduce((sum, b) => sum + (b.classes_remaining || 0), 0);
    }

    return {
      personal: {
        details: student,
        attendance_summary: {
          present: classesAttended,
          absent: classesMissed,
          excused: parseInt(attendance.excused || 0)
        }
      },
      academic: {
        batches: batchesRes.rows,
        reviews: [], // Placeholder
        certificates: [], // Placeholder
        homework: [] // Placeholder
      },
      payment: {
        history: paymentsRes.rows,
        summary: {
          classes_attended: classesAttended,
          classes_remaining: classesRemaining,
          classes_missed: classesMissed
        }
      }
    };
};

// GET /api/students/:id/360
router.get('/:id/360', async (req, res) => {
  const studentId = req.params.id;
  try {
    const data = await fetchStudent360Data(studentId);
    if (!data) return res.status(404).json({ error: 'Student not found' });
    res.json(data);
  } catch (error) {
    console.error('Error fetching student 360 data:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// GET /api/students/email/:email/360
router.get('/email/:email/360', async (req, res) => {
  const email = req.params.email;
  try {
    const result = await pool.query(
      `SELECT id FROM students WHERE email = $1 OR metadata->>'email' = $1 LIMIT 1`,
      [email]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found' });
    }
    
    const data = await fetchStudent360Data(result.rows[0].id);
    if (!data) return res.status(404).json({ error: 'Student data not found' });
    res.json(data);
  } catch (error) {
    console.error('Error fetching student 360 data by email:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = { router, fetchStudent360Data };