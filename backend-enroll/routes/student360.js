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

    // 2. Fetch Payment History (Moved up to determine cycle)
    const paymentsQuery = `
      SELECT p.id, p.amount, p.timestamp, p.method, p.package_id, p.metadata, pkg.classes_count
      FROM payments p
      LEFT JOIN packages pkg ON p.package_id = pkg.id
      WHERE p.student_id = $1
      ORDER BY p.timestamp DESC
    `;
    const paymentsRes = await pool.query(paymentsQuery, [studentId]);
    const payments = paymentsRes.rows;

    // Determine credit calculation basis (Cycle vs Lifetime)
    let lastPaymentDate = null;
    let creditsBought = 0;
    let isCycleBased = false;

    if (payments.length > 0) {
      const lastPayment = payments[0];
      // Check if this payment bought credits
      if (lastPayment.metadata && lastPayment.metadata.credits_bought) {
        creditsBought = parseInt(lastPayment.metadata.credits_bought);
        lastPaymentDate = lastPayment.timestamp;
        isCycleBased = true;
      } else if (lastPayment.classes_count) {
        creditsBought = lastPayment.classes_count;
        lastPaymentDate = lastPayment.timestamp;
        isCycleBased = true;
      } else {
        // Try to infer from frequency in metadata
        const freq = lastPayment.metadata?.payment_frequency || '';
        if (freq) {
           if (freq.includes('monthly')) creditsBought = 8;
           else if (freq.includes('quarterly')) creditsBought = 24;
           else if (freq.includes('half')) creditsBought = 48;
           else if (freq.includes('yearly')) creditsBought = 96;
           
           if (creditsBought > 0) {
             lastPaymentDate = lastPayment.timestamp;
             isCycleBased = true;
           }
        }
      }
    }

    // 3. Fetch Attendance Summary
    let attendanceQuery = `
      SELECT 
        COUNT(*) FILTER (WHERE status = 'present') as present,
        COUNT(*) FILTER (WHERE status = 'absent') as absent,
        COUNT(*) FILTER (WHERE status = 'excused') as excused
      FROM attendance_records 
      WHERE student_id = $1
    `;
    const attendanceParams = [studentId];

    if (isCycleBased && lastPaymentDate) {
      // Filter attendance after last payment (inclusive of the payment day)
      attendanceQuery += ` AND session_date >= $2::date`;
      attendanceParams.push(lastPaymentDate);
    }

    const attendanceRes = await pool.query(attendanceQuery, attendanceParams);
    const attendance = attendanceRes.rows[0];

    // 4. Fetch Academic Batches
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

    // Calculate Payment Summary
    const classesAttended = parseInt(attendance.present || 0);
    const classesMissed = parseInt(attendance.absent || 0);
    const classesExcused = parseInt(attendance.excused || 0);
    
    let totalCredits = 0;
    let classesRemaining;

    if (isCycleBased) {
      totalCredits = creditsBought;
      classesRemaining = totalCredits - (classesAttended + classesMissed);
    } else if (student.metadata && student.metadata.total_credits !== undefined) {
      totalCredits = parseInt(student.metadata.total_credits);
      classesRemaining = totalCredits - (classesAttended + classesMissed);
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
        // Override classes_remaining in batches with the calculated value
        batches: batchesRes.rows.map(b => ({
          ...b,
          classes_remaining: classesRemaining
        })),
        reviews: [], // Placeholder
        certificates: [], // Placeholder
        homework: [] // Placeholder
      },
      payment: {
        history: payments,
        summary: {
          total_credits: totalCredits,
          classes_attended: classesAttended,
          classes_remaining: classesRemaining,
          classes_missed: classesMissed,
          classes_excused: classesExcused
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