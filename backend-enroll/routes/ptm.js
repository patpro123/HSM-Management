const express = require('express');
const router = express.Router();
const pool = require('../db');
const { authenticateJWT } = require('../auth/jwtMiddleware');
const { authorizeRole } = require('../auth/rbacMiddleware');

const adminOnly = [authenticateJWT, authorizeRole(['admin'])];

// ─── SESSIONS ─────────────────────────────────────────────────────────────────

// GET /api/ptm/sessions
router.get('/sessions', adminOnly, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT
        s.*,
        COUNT(a.id)::int AS appointment_count,
        COUNT(a.id) FILTER (WHERE a.status = 'completed')::int AS completed_count
      FROM ptm_sessions s
      LEFT JOIN ptm_appointments a ON a.ptm_session_id = s.id
      GROUP BY s.id
      ORDER BY s.scheduled_date DESC
    `);
    res.json({ sessions: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ptm/sessions
router.post('/sessions', adminOnly, async (req, res) => {
  const { title, scheduled_date, description } = req.body || {};
  if (!title || !scheduled_date) {
    return res.status(400).json({ error: 'title and scheduled_date are required', received: req.body });
  }
  try {
    const result = await pool.query(
      `INSERT INTO ptm_sessions (title, scheduled_date, description, created_by)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [title, scheduled_date, description || null, req.user?.name || req.user?.email || 'Admin']
    );
    res.status(201).json({ session: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/ptm/sessions/:sessionId
router.get('/sessions/:sessionId', adminOnly, async (req, res) => {
  try {
    const sessionRes = await pool.query('SELECT * FROM ptm_sessions WHERE id = $1', [req.params.sessionId]);
    if (!sessionRes.rows.length) return res.status(404).json({ error: 'Session not found' });

    const apptRes = await pool.query(`
      SELECT
        a.*,
        s.name AS student_name,
        s.phone AS student_phone,
        s.guardian_contact,
        s.metadata->>'guardian_name' AS guardian_name,
        s.metadata->>'guardian_phone' AS guardian_phone,
        (SELECT u.email FROM student_guardians sg JOIN users u ON u.id = sg.user_id WHERE sg.student_id = s.id AND sg.is_active = true ORDER BY sg.is_primary DESC LIMIT 1) AS guardian_email,
        t.name AS teacher_name,
        t.phone AS teacher_phone,
        i.name AS instrument_name
      FROM ptm_appointments a
      JOIN students s ON s.id = a.student_id
      JOIN teachers t ON t.id = a.teacher_id
      LEFT JOIN (
        SELECT DISTINCT ON (eb.enrollment_id) eb.batch_id, e.student_id, i.name
        FROM enrollment_batches eb
        JOIN enrollments e ON e.id = eb.enrollment_id
        JOIN batches b ON b.id = eb.batch_id
        JOIN instruments i ON i.id = b.instrument_id
        WHERE e.status = 'active'
        ORDER BY eb.enrollment_id, eb.assigned_on ASC
      ) i ON i.student_id = a.student_id
      WHERE a.ptm_session_id = $1
      ORDER BY a.scheduled_time ASC NULLS LAST, s.name ASC
    `, [req.params.sessionId]);

    const actionRes = await pool.query(
      'SELECT * FROM ptm_action_items WHERE appointment_id = ANY($1) ORDER BY created_at ASC',
      [apptRes.rows.map(r => r.id)]
    );
    const actionsByAppt = actionRes.rows.reduce((acc, ai) => {
      (acc[ai.appointment_id] = acc[ai.appointment_id] || []).push(ai);
      return acc;
    }, {});

    const appointments = apptRes.rows.map(a => ({
      ...a,
      action_items: actionsByAppt[a.id] || [],
    }));

    res.json({ session: sessionRes.rows[0], appointments });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/ptm/sessions/:sessionId
router.put('/sessions/:sessionId', adminOnly, async (req, res) => {
  const { title, scheduled_date, description, status } = req.body;
  try {
    const result = await pool.query(
      `UPDATE ptm_sessions
       SET title = COALESCE($1, title),
           scheduled_date = COALESCE($2, scheduled_date),
           description = COALESCE($3, description),
           status = COALESCE($4, status)
       WHERE id = $5 RETURNING *`,
      [title, scheduled_date, description, status, req.params.sessionId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Session not found' });
    res.json({ session: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/ptm/sessions/:sessionId
router.delete('/sessions/:sessionId', adminOnly, async (req, res) => {
  try {
    await pool.query('DELETE FROM ptm_sessions WHERE id = $1', [req.params.sessionId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── APPOINTMENTS ──────────────────────────────────────────────────────────────

// POST /api/ptm/sessions/:sessionId/appointments
router.post('/sessions/:sessionId/appointments', adminOnly, async (req, res) => {
  const { student_id, teacher_id, scheduled_time } = req.body;
  if (!student_id || !teacher_id) {
    return res.status(400).json({ error: 'student_id and teacher_id are required' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO ptm_appointments (ptm_session_id, student_id, teacher_id, scheduled_time)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.params.sessionId, student_id, teacher_id, scheduled_time || null]
    );
    res.status(201).json({ appointment: result.rows[0] });
  } catch (err) {
    if (err.code === '23505') return res.status(409).json({ error: 'Student already in this session' });
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ptm/sessions/:sessionId/appointments/bulk
router.post('/sessions/:sessionId/appointments/bulk', adminOnly, async (req, res) => {
  const { appointments } = req.body; // [{ student_id, teacher_id, scheduled_time? }]
  if (!Array.isArray(appointments) || !appointments.length) {
    return res.status(400).json({ error: 'appointments array is required' });
  }
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const results = [];
    for (const appt of appointments) {
      const r = await client.query(
        `INSERT INTO ptm_appointments (ptm_session_id, student_id, teacher_id, scheduled_time)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (ptm_session_id, student_id) DO NOTHING
         RETURNING *`,
        [req.params.sessionId, appt.student_id, appt.teacher_id, appt.scheduled_time || null]
      );
      if (r.rows.length) results.push(r.rows[0]);
    }
    await client.query('COMMIT');
    res.status(201).json({ added: results.length, appointments: results });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
});

// PUT /api/ptm/appointments/:appointmentId
router.put('/appointments/:appointmentId', adminOnly, async (req, res) => {
  const { scheduled_time, status, notes, parent_notified_at, teacher_notified_at, completed_at } = req.body;
  try {
    const updates = [];
    const values = [];
    let idx = 1;
    const set = (col, val) => { if (val !== undefined) { updates.push(`${col} = $${idx++}`); values.push(val); } };
    set('scheduled_time', scheduled_time);
    set('status', status);
    set('notes', notes);
    set('parent_notified_at', parent_notified_at);
    set('teacher_notified_at', teacher_notified_at);
    set('completed_at', completed_at);
    if (!updates.length) return res.status(400).json({ error: 'No fields to update' });
    values.push(req.params.appointmentId);
    const result = await pool.query(
      `UPDATE ptm_appointments SET ${updates.join(', ')} WHERE id = $${idx} RETURNING *`,
      values
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Appointment not found' });
    res.json({ appointment: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/ptm/appointments/:appointmentId
router.delete('/appointments/:appointmentId', adminOnly, async (req, res) => {
  try {
    await pool.query('DELETE FROM ptm_appointments WHERE id = $1', [req.params.appointmentId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── ACTION ITEMS ─────────────────────────────────────────────────────────────

// GET /api/ptm/appointments/:appointmentId/actions
router.get('/appointments/:appointmentId/actions', adminOnly, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM ptm_action_items WHERE appointment_id = $1 ORDER BY created_at ASC',
      [req.params.appointmentId]
    );
    res.json({ action_items: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ptm/appointments/:appointmentId/actions
router.post('/appointments/:appointmentId/actions', adminOnly, async (req, res) => {
  const { action_text, assigned_to, due_date } = req.body;
  if (!action_text) return res.status(400).json({ error: 'action_text is required' });
  try {
    const result = await pool.query(
      `INSERT INTO ptm_action_items (appointment_id, action_text, assigned_to, due_date)
       VALUES ($1, $2, $3, $4) RETURNING *`,
      [req.params.appointmentId, action_text, assigned_to || 'parent', due_date || null]
    );
    res.status(201).json({ action_item: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/ptm/actions/:actionId
router.put('/actions/:actionId', adminOnly, async (req, res) => {
  const { action_text, assigned_to, due_date, status } = req.body;
  try {
    const resolved_at = status === 'done' ? new Date().toISOString() : null;
    const result = await pool.query(
      `UPDATE ptm_action_items
       SET action_text = COALESCE($1, action_text),
           assigned_to = COALESCE($2, assigned_to),
           due_date = COALESCE($3, due_date),
           status = COALESCE($4, status),
           resolved_at = CASE WHEN $4 = 'done' THEN now() WHEN $4 = 'open' THEN NULL ELSE resolved_at END
       WHERE id = $5 RETURNING *`,
      [action_text, assigned_to, due_date, status, req.params.actionId]
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Action item not found' });
    res.json({ action_item: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/ptm/actions/:actionId
router.delete('/actions/:actionId', adminOnly, async (req, res) => {
  try {
    await pool.query('DELETE FROM ptm_action_items WHERE id = $1', [req.params.actionId]);
    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── WHATSAPP NOTIFICATIONS ────────────────────────────────────────────────────

// POST /api/ptm/appointments/:appointmentId/notify
// Body: { recipients: 'parent' | 'teacher' | 'both' }
// Logs notification timestamps; actual wa.me link built on frontend
router.post('/appointments/:appointmentId/notify', adminOnly, async (req, res) => {
  const { recipients } = req.body;
  if (!recipients) return res.status(400).json({ error: 'recipients is required' });
  try {
    const now = new Date().toISOString();
    const updates = [];
    const values = [];
    if (recipients === 'parent' || recipients === 'both') {
      updates.push(`parent_notified_at = $${updates.length + 1}`);
      values.push(now);
    }
    if (recipients === 'teacher' || recipients === 'both') {
      updates.push(`teacher_notified_at = $${updates.length + 1}`);
      values.push(now);
    }
    if (!updates.length) return res.status(400).json({ error: 'Invalid recipients value' });
    values.push(req.params.appointmentId);
    const result = await pool.query(
      `UPDATE ptm_appointments SET ${updates.join(', ')} WHERE id = $${values.length} RETURNING *`,
      values
    );
    if (!result.rows.length) return res.status(404).json({ error: 'Appointment not found' });
    res.json({ appointment: result.rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/ptm/sessions/:sessionId/notify-all
// Body: { recipients: 'parent' | 'teacher' | 'both' }
router.post('/sessions/:sessionId/notify-all', adminOnly, async (req, res) => {
  const { recipients } = req.body;
  if (!recipients) return res.status(400).json({ error: 'recipients is required' });
  try {
    const now = new Date().toISOString();
    const setClauses = [];
    if (recipients === 'parent' || recipients === 'both') setClauses.push(`parent_notified_at = '${now}'`);
    if (recipients === 'teacher' || recipients === 'both') setClauses.push(`teacher_notified_at = '${now}'`);
    if (!setClauses.length) return res.status(400).json({ error: 'Invalid recipients value' });
    const result = await pool.query(
      `UPDATE ptm_appointments SET ${setClauses.join(', ')}
       WHERE ptm_session_id = $1 AND status = 'scheduled'
       RETURNING id`,
      [req.params.sessionId]
    );
    res.json({ updated: result.rowCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ─── STUDENT PTM HISTORY ───────────────────────────────────────────────────────

// GET /api/ptm/students/:studentId/history
router.get('/students/:studentId/history', authenticateJWT, async (req, res) => {
  try {
    const apptRes = await pool.query(`
      SELECT
        a.*,
        s.title AS session_title,
        s.scheduled_date,
        t.name AS teacher_name,
        i.name AS instrument_name
      FROM ptm_appointments a
      JOIN ptm_sessions s ON s.id = a.ptm_session_id
      JOIN teachers t ON t.id = a.teacher_id
      LEFT JOIN (
        SELECT DISTINCT ON (eb.enrollment_id) eb.batch_id, e.student_id, i.name
        FROM enrollment_batches eb
        JOIN enrollments e ON e.id = eb.enrollment_id
        JOIN batches b ON b.id = eb.batch_id
        JOIN instruments i ON i.id = b.instrument_id
        WHERE e.status = 'active'
        ORDER BY eb.enrollment_id, eb.assigned_on ASC
      ) i ON i.student_id = a.student_id
      WHERE a.student_id = $1
      ORDER BY s.scheduled_date DESC
    `, [req.params.studentId]);

    const apptIds = apptRes.rows.map(r => r.id);
    let actionsByAppt = {};
    if (apptIds.length) {
      const actionRes = await pool.query(
        'SELECT * FROM ptm_action_items WHERE appointment_id = ANY($1) ORDER BY created_at ASC',
        [apptIds]
      );
      actionsByAppt = actionRes.rows.reduce((acc, ai) => {
        (acc[ai.appointment_id] = acc[ai.appointment_id] || []).push(ai);
        return acc;
      }, {});
    }

    const history = apptRes.rows.map(a => ({
      ...a,
      action_items: actionsByAppt[a.id] || [],
    }));

    res.json({ history });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/ptm/teachers/:teacherId/appointments
// Teacher sees their own upcoming/past PTM slots (with action items)
router.get('/teachers/:teacherId/appointments', authenticateJWT, async (req, res) => {
  try {
    const apptRes = await pool.query(`
      SELECT
        a.*,
        s.title AS session_title,
        s.scheduled_date,
        st.name AS student_name,
        st.phone AS student_phone,
        st.guardian_contact,
        st.metadata->>'guardian_name' AS guardian_name,
        st.metadata->>'guardian_phone' AS guardian_phone,
        (SELECT u.email FROM student_guardians sg JOIN users u ON u.id = sg.user_id WHERE sg.student_id = st.id AND sg.is_active = true ORDER BY sg.is_primary DESC LIMIT 1) AS guardian_email,
        i.name AS instrument_name
      FROM ptm_appointments a
      JOIN ptm_sessions s ON s.id = a.ptm_session_id
      JOIN students st ON st.id = a.student_id
      LEFT JOIN (
        SELECT DISTINCT ON (eb.enrollment_id) e.student_id, i.name
        FROM enrollment_batches eb
        JOIN enrollments e ON e.id = eb.enrollment_id
        JOIN batches b ON b.id = eb.batch_id
        JOIN instruments i ON i.id = b.instrument_id
        WHERE e.status = 'active'
        ORDER BY eb.enrollment_id, eb.assigned_on ASC
      ) i ON i.student_id = a.student_id
      WHERE a.teacher_id = $1
      ORDER BY s.scheduled_date DESC, a.scheduled_time ASC
    `, [req.params.teacherId]);

    let appointments = apptRes.rows;
    if (appointments.length) {
      const actionRes = await pool.query(
        'SELECT * FROM ptm_action_items WHERE appointment_id = ANY($1) ORDER BY created_at ASC',
        [appointments.map(r => r.id)]
      );
      const byAppt = actionRes.rows.reduce((acc, ai) => {
        (acc[ai.appointment_id] = acc[ai.appointment_id] || []).push(ai);
        return acc;
      }, {});
      appointments = appointments.map(a => ({ ...a, action_items: byAppt[a.id] || [] }));
    }

    res.json({ appointments });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/ptm/appointments/:appointmentId/carry-forwards
// Returns last 2 completed PTMs for this student (excluding current session)
router.get('/appointments/:appointmentId/carry-forwards', adminOnly, async (req, res) => {
  try {
    const ref = await pool.query(
      'SELECT student_id, ptm_session_id FROM ptm_appointments WHERE id = $1',
      [req.params.appointmentId]
    );
    if (!ref.rows.length) return res.status(404).json({ error: 'Appointment not found' });
    const { student_id, ptm_session_id } = ref.rows[0];

    const apptRes = await pool.query(`
      SELECT
        a.*,
        s.title AS session_title,
        s.scheduled_date,
        t.name AS teacher_name,
        i.name AS instrument_name
      FROM ptm_appointments a
      JOIN ptm_sessions s ON s.id = a.ptm_session_id
      JOIN teachers t ON t.id = a.teacher_id
      LEFT JOIN (
        SELECT DISTINCT ON (eb.enrollment_id) e.student_id, i.name
        FROM enrollment_batches eb
        JOIN enrollments e ON e.id = eb.enrollment_id
        JOIN batches b ON b.id = eb.batch_id
        JOIN instruments i ON i.id = b.instrument_id
        WHERE e.status = 'active'
        ORDER BY eb.enrollment_id, eb.assigned_on ASC
      ) i ON i.student_id = a.student_id
      WHERE a.student_id = $1
        AND a.ptm_session_id != $2
        AND a.status = 'completed'
      ORDER BY s.scheduled_date DESC
      LIMIT 2
    `, [student_id, ptm_session_id]);

    let carry_forwards = apptRes.rows;
    if (carry_forwards.length) {
      const actionRes = await pool.query(
        'SELECT * FROM ptm_action_items WHERE appointment_id = ANY($1) ORDER BY created_at ASC',
        [carry_forwards.map(r => r.id)]
      );
      const byAppt = actionRes.rows.reduce((acc, ai) => {
        (acc[ai.appointment_id] = acc[ai.appointment_id] || []).push(ai);
        return acc;
      }, {});
      carry_forwards = carry_forwards.map(a => ({ ...a, action_items: byAppt[a.id] || [] }));
    }

    res.json({ carry_forwards });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/ptm/stats
// Returns this-month completion count + students overdue for PTM (2+ months)
router.get('/stats', adminOnly, async (req, res) => {
  try {
    const thisMonthRes = await pool.query(`
      SELECT DISTINCT ON (s.id) s.id, s.name
      FROM students s
      JOIN ptm_appointments a ON a.student_id = s.id AND a.status = 'completed'
      JOIN ptm_sessions sess ON sess.id = a.ptm_session_id
      WHERE (s.student_type = 'permanent' OR s.student_type IS NULL)
        AND DATE_TRUNC('month', sess.scheduled_date) = DATE_TRUNC('month', CURRENT_DATE)
      ORDER BY s.id
    `);

    const allRes = await pool.query(`
      SELECT DISTINCT ON (s.id)
        s.id, s.name,
        t.id   AS teacher_id,
        t.name AS teacher_name,
        i.name AS instrument_name,
        (
          SELECT MAX(sess2.scheduled_date)
          FROM ptm_appointments a2
          JOIN ptm_sessions sess2 ON sess2.id = a2.ptm_session_id
          WHERE a2.student_id = s.id AND a2.status = 'completed'
        ) AS last_ptm_date
      FROM students s
      LEFT JOIN enrollments e        ON e.student_id = s.id AND e.status = 'active'
      LEFT JOIN enrollment_batches eb ON eb.enrollment_id = e.id
      LEFT JOIN batches b             ON b.id = eb.batch_id
      LEFT JOIN teachers t           ON t.id = b.teacher_id
      LEFT JOIN instruments i        ON i.id = b.instrument_id
      WHERE (s.student_type = 'permanent' OR s.student_type IS NULL)
      ORDER BY s.id, eb.assigned_on ASC
    `);

    const twoMonthsAgo = new Date();
    twoMonthsAgo.setMonth(twoMonthsAgo.getMonth() - 2);
    const overdue = allRes.rows
      .filter(s => !s.last_ptm_date || new Date(s.last_ptm_date) < twoMonthsAgo)
      .sort((a, b) => {
        if (!a.last_ptm_date) return -1;
        if (!b.last_ptm_date) return 1;
        return new Date(a.last_ptm_date) - new Date(b.last_ptm_date);
      });

    res.json({
      this_month: { count: thisMonthRes.rows.length, students: thisMonthRes.rows },
      overdue:    { count: overdue.length, students: overdue },
      total_students: allRes.rows.length,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/ptm/eligible-students
// Returns active permanent students enriched with their primary batch teacher
router.get('/eligible-students', adminOnly, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT ON (s.id)
        s.id,
        s.name,
        s.phone AS student_phone,
        s.guardian_contact,
        s.metadata->>'guardian_phone' AS guardian_phone,
        s.metadata->>'guardian_name'  AS guardian_name,
        t.id   AS teacher_id,
        t.name AS teacher_name,
        i.name AS instrument_name
      FROM students s
      LEFT JOIN enrollments e        ON e.student_id = s.id AND e.status = 'active'
      LEFT JOIN enrollment_batches eb ON eb.enrollment_id = e.id
      LEFT JOIN batches b             ON b.id = eb.batch_id
      LEFT JOIN teachers t           ON t.id = b.teacher_id
      LEFT JOIN instruments i        ON i.id = b.instrument_id
      WHERE (s.student_type = 'permanent' OR s.student_type IS NULL)
      ORDER BY s.id, eb.assigned_on ASC
    `);
    res.json({ students: result.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
