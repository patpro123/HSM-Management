const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateJWT } = require('../auth/jwtMiddleware');
const { computeClassesRemaining } = require('../utils/credits');

const fetchStudent360Data = async (studentId) => {
    // 1. Fetch Personal Details
    const studentQuery = 'SELECT * FROM students WHERE id = $1';
    const studentRes = await pool.query(studentQuery, [studentId]);

    if (studentRes.rows.length === 0) {
      return null;
    }
    const student = studentRes.rows[0];

    // 2. Fetch Payment History
    const paymentsQuery = `
      SELECT p.id, p.amount, p.timestamp, p.method, p.package_id, p.metadata,
             pkg.classes_count, pkg.name AS package_name,
             i.name AS instrument_name
      FROM payments p
      LEFT JOIN packages pkg ON p.package_id = pkg.id
      LEFT JOIN instruments i ON pkg.instrument_id = i.id
      WHERE p.student_id = $1
      ORDER BY p.timestamp DESC
    `;
    const paymentsRes = await pool.query(paymentsQuery, [studentId]);
    const payments = paymentsRes.rows;

    // 3. Fetch Attendance Summary (lifetime)
    const attendanceRes = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'present') as present,
         COUNT(*) FILTER (WHERE status = 'absent') as absent,
         COUNT(*) FILTER (WHERE status = 'excused') as excused
       FROM attendance_records
       WHERE student_id = $1`,
      [studentId]
    );
    const attendance = attendanceRes.rows[0];

    // 4. Fetch Academic Batches (structural info only — classes_remaining computed dynamically below)
    const batchesQuery = `
      SELECT
        b.id,
        i.name as instrument,
        b.recurrence,
        t.name as teacher
      FROM enrollments e
      JOIN enrollment_batches eb ON e.id = eb.enrollment_id
      JOIN batches b ON eb.batch_id = b.id
      LEFT JOIN instruments i ON b.instrument_id = i.id
      LEFT JOIN teachers t ON b.teacher_id = t.id
      WHERE e.student_id = $1 AND e.status = 'active'
    `;
    const batchesRes = await pool.query(batchesQuery, [studentId]);

    // Group batches by instrument for display
    const instrumentGroups = {};
    batchesRes.rows.forEach(row => {
      const inst = row.instrument || 'Unknown';
      if (!instrumentGroups[inst]) {
        instrumentGroups[inst] = {
          id: row.id,
          instrument: inst,
          teachers: new Set(),
          recurrences: [],
        };
      }
      if (row.teacher) instrumentGroups[inst].teachers.add(row.teacher);
      if (row.recurrence) instrumentGroups[inst].recurrences.push(row.recurrence);
    });

    // 5. Dynamic classes_remaining: credits_bought - present_attendances (no carryforward)
    const { total: dynamicTotal, byInstrument: dynamicByInstrument } = await computeClassesRemaining(pool, studentId);

    const groupedBatches = Object.values(instrumentGroups).map(g => ({
      id: g.id,
      instrument: g.instrument,
      teacher: Array.from(g.teachers).join(', '),
      recurrence: g.recurrences.join(' & '),
      classes_remaining: dynamicByInstrument[g.instrument] ?? 0,
    }));

    // Calculate Payment Summary
    const classesAttended = parseInt(attendance.present || 0);
    const classesMissed = parseInt(attendance.absent || 0);
    const classesExcused = parseInt(attendance.excused || 0);

    const classesRemaining = dynamicTotal;

    // Total credits = sum from actual payment records only (no heuristics)
    const totalCredits = payments.reduce((sum, p) => {
      const fromMeta = p.metadata?.credits_bought ? parseInt(p.metadata.credits_bought) : 0;
      if (fromMeta > 0) return sum + fromMeta;
      if (p.classes_count) return sum + parseInt(p.classes_count);
      return sum;
    }, 0);

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
        // Use the grouped batches (one per instrument)
        batches: groupedBatches,
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
          classes_excused: classesExcused,
          instrument_credits: Object.fromEntries(
            groupedBatches.map(b => [b.instrument, b.classes_remaining])
          )
        }
      }
    };
};

// GET /api/students/me/360 - self-service: resolves student via student_guardians link
router.get('/me/360', authenticateJWT, async (req, res) => {
  try {
    const linkResult = await pool.query(
      `SELECT student_id FROM student_guardians WHERE user_id = $1 LIMIT 1`,
      [req.user.id]
    );
    if (linkResult.rows.length === 0) {
      return res.status(404).json({ error: 'No student profile linked to your account. Please contact the school.' });
    }
    const data = await fetchStudent360Data(linkResult.rows[0].student_id);
    if (!data) return res.status(404).json({ error: 'Student not found' });
    res.json(data);
  } catch (error) {
    console.error('Error fetching student 360 data for self:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

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