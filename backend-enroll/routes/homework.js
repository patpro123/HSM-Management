'use strict';

const express = require('express');
const jwt     = require('jsonwebtoken');
const router  = express.Router();
const pool    = require('../db');
const { authenticateJWT } = require('../auth/jwtMiddleware');

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key-change-in-prod';

// Lenient auth — sets req.user if a valid JWT is present, but always calls next().
// Used on streaming endpoints so <audio src="..."> works without custom headers.
function resolveUser(req, res, next) {
  if (req.user) return next();
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try { req.user = jwt.verify(authHeader.slice(7), JWT_SECRET); } catch (_) {}
  }
  next();
}

// ── Notification helper ───────────────────────────────────────────────────────
async function pushNotification({ type, title, message, action_link, metadata, user_id }) {
  try {
    await pool.query(
      `INSERT INTO notifications (type, title, message, action_link, metadata, user_id)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
      [type, title, message, action_link || null,
       JSON.stringify(metadata || {}), user_id || null]
    );
    const notificationsRouter = require('./notifications');
    notificationsRouter.emitNotification?.({
      type, title, message, action_link, metadata, user_id,
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[homework] notification failed:', err.message);
  }
}

// POST /api/homework/assign — teacher/admin assigns homework to a student
router.post('/homework/assign', async (req, res) => {
  const { student_id, title, instructions, due_date, assigned_by, total_marks, marks_breakdown,
          habit_target_habit_id, habit_target_count,
          theory_prompt_text, theory_prompt_file } = req.body;
  if (!student_id || !title?.trim()) {
    return res.status(400).json({ error: 'student_id and title are required' });
  }

  // Upload theory sheet if provided
  let theoryPromptStorageId = null;
  if (theory_prompt_file) {
    const useDrive = process.env.DRIVE_ENABLED === 'true' && Boolean(process.env.DRIVE_FOLDER_HOMEWORK_AUDIO);
    if (useDrive) {
      try {
        const driveService = require('../services/driveService');
        const base64Part = theory_prompt_file.includes(',') ? theory_prompt_file.split(',')[1] : theory_prompt_file;
        const buffer = Buffer.from(base64Part, 'base64');
        const { fileStorageId } = await driveService.upload({
          buffer,
          fileName: `theory_prompt_${Date.now()}.pdf`,
          mimeType: 'application/pdf',
          category: 'student_document',
          entityType: 'theory_prompt',
        });
        theoryPromptStorageId = fileStorageId;
      } catch (err) {
        console.error('Theory sheet upload failed:', err.message);
        return res.status(502).json({ error: 'Failed to upload theory sheet. Please try again.' });
      }
    }
  }

  try {
    const result = await pool.query(
      `INSERT INTO homework_assignments
         (student_id, title, instructions, due_date, assigned_by, assigned_by_user_id,
          total_marks, marks_breakdown, habit_target_habit_id, habit_target_count,
          theory_prompt_text, theory_prompt_storage_id)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
       RETURNING id, student_id, title, instructions, due_date, assigned_by, created_at, status,
                 total_marks, marks_breakdown, habit_target_habit_id, habit_target_count,
                 theory_prompt_text, theory_prompt_storage_id`,
      [
        student_id,
        title.trim(),
        instructions || null,
        due_date || null,
        assigned_by || 'teacher',
        req.user?.id || null,
        total_marks || null,
        marks_breakdown ? JSON.stringify(marks_breakdown) : null,
        habit_target_habit_id || null,
        habit_target_count || null,
        theory_prompt_text || null,
        theoryPromptStorageId,
      ]
    );
    res.status(201).json({ assignment: result.rows[0] });
  } catch (err) {
    console.error('Error assigning homework:', err);
    res.status(500).json({ error: 'Failed to assign homework' });
  }
});

// POST /api/homework/assign-bulk — assign the same homework to multiple students in one go
router.post('/homework/assign-bulk', async (req, res) => {
  const { student_ids, title, instructions, due_date, assigned_by, total_marks,
          marks_breakdown, theory_prompt_text, theory_prompt_file } = req.body;

  if (!Array.isArray(student_ids) || student_ids.length === 0)
    return res.status(400).json({ error: 'student_ids must be a non-empty array' });
  if (!title?.trim())
    return res.status(400).json({ error: 'title is required' });

  // Upload theory sheet once (shared across all rows) — must happen before BEGIN
  let theoryPromptStorageId = null;
  if (theory_prompt_file) {
    const useDrive = process.env.DRIVE_ENABLED === 'true' && Boolean(process.env.DRIVE_FOLDER_HOMEWORK_AUDIO);
    if (useDrive) {
      try {
        const driveService = require('../services/driveService');
        const base64Part = theory_prompt_file.includes(',') ? theory_prompt_file.split(',')[1] : theory_prompt_file;
        const buffer = Buffer.from(base64Part, 'base64');
        const { fileStorageId } = await driveService.upload({
          buffer,
          fileName: `theory_prompt_bulk_${Date.now()}.pdf`,
          mimeType: 'application/pdf',
          category: 'student_document',
          entityType: 'theory_prompt',
        });
        theoryPromptStorageId = fileStorageId;
      } catch (err) {
        console.error('[assign-bulk] theory sheet upload failed:', err.message);
        return res.status(502).json({ error: 'Failed to upload theory sheet. Please try again.' });
      }
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const assignment_ids = [];
    for (const studentId of student_ids) {
      const result = await client.query(
        `INSERT INTO homework_assignments
           (student_id, title, instructions, due_date, assigned_by, assigned_by_user_id,
            total_marks, marks_breakdown, theory_prompt_text, theory_prompt_storage_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id`,
        [
          studentId,
          title.trim(),
          instructions || null,
          due_date || null,
          assigned_by || 'teacher',
          req.user?.id || null,
          total_marks || null,
          marks_breakdown ? JSON.stringify(marks_breakdown) : null,
          theory_prompt_text || null,
          theoryPromptStorageId,
        ]
      );
      assignment_ids.push(result.rows[0].id);
    }
    await client.query('COMMIT');
    res.status(201).json({ created: assignment_ids.length, assignment_ids });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error bulk-assigning homework:', err);
    res.status(500).json({ error: 'Failed to bulk-assign homework' });
  } finally {
    client.release();
  }
});

// GET /api/homework/recent — recent assignments grouped by (title, assigner, minute bucket)
router.get('/homework/recent', async (req, res) => {
  const { assignerUserId, limit = 30 } = req.query;
  try {
    const params = [];
    let whereClause = '';
    if (assignerUserId) {
      params.push(assignerUserId);
      whereClause = `WHERE a.assigned_by_user_id = $1`;
    }
    params.push(parseInt(limit, 10) || 30);
    const limitParam = `$${params.length}`;

    const result = await pool.query(
      `SELECT
         a.title,
         a.assigned_by,
         MAX(a.created_at)           AS created_at,
         COUNT(*)::int               AS recipient_count,
         array_agg(s.name ORDER BY s.name) AS student_names
       FROM homework_assignments a
       JOIN students s ON s.id = a.student_id
       ${whereClause}
       GROUP BY a.title, a.assigned_by, a.assigned_by_user_id, date_trunc('minute', a.created_at)
       ORDER BY MAX(a.created_at) DESC
       LIMIT ${limitParam}`,
      params
    );
    res.json({ recent: result.rows });
  } catch (err) {
    console.error('Error fetching recent homework:', err);
    res.status(500).json({ error: 'Failed to fetch recent homework' });
  }
});

// GET /api/homework/:id — single assignment detail (title, instructions, theory task, attachments)
// Used to review exactly what was assigned, e.g. after assigning makeup material.
router.get('/homework/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT
         a.id, a.student_id, s.name AS student_name, a.title, a.instructions,
         a.assigned_by, a.assigned_by_user_id, a.created_at, a.status,
         a.theory_prompt_text, a.theory_prompt_storage_id,
         a.is_makeup, a.batch_id, a.session_date,
         i.name AS instrument_name,
         COALESCE((
           SELECT json_agg(json_build_object(
             'id',              ha.id,
             'file_storage_id', ha.file_storage_id,
             'label',           ha.label,
             'public_url',      fs.public_url,
             'file_name',       fs.file_name,
             'mime_type',       fs.mime_type
           ) ORDER BY ha.created_at)
           FROM homework_attachments ha
           LEFT JOIN file_storage fs ON fs.id = ha.file_storage_id
           WHERE ha.assignment_id = a.id
         ), '[]'::json) AS attachments
       FROM homework_assignments a
       JOIN students s ON s.id = a.student_id
       LEFT JOIN batches     b ON b.id = a.batch_id
       LEFT JOIN instruments i ON i.id = b.instrument_id
       WHERE a.id = $1`,
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Assignment not found' });
    res.json({ assignment: result.rows[0] });
  } catch (err) {
    console.error('[GET /homework/:id]', err);
    res.status(500).json({ error: 'Failed to fetch assignment' });
  }
});

// GET /api/students/:studentId/homework — list assignments with submission info (no file_data)
router.get('/students/:studentId/homework', async (req, res) => {
  const { studentId } = req.params;
  try {
    const result = await pool.query(
      `SELECT
         a.id, a.student_id, a.title, a.instructions, a.due_date,
         a.assigned_by, a.assigned_by_user_id, a.created_at, a.status,
         a.total_marks, a.marks_breakdown,
         a.teacher_comment, a.marks_awarded, a.marks_awarded_breakdown,
         a.submission_history,
         a.habit_target_habit_id,
         a.habit_target_count,
         ht.title AS habit_target_title,
         ht.icon  AS habit_target_icon,
         COALESCE((
           SELECT COUNT(*)::int FROM habit_logs hl
           WHERE hl.habit_id = a.habit_target_habit_id
             AND hl.logged_date >= a.created_at::date
             AND hl.logged_date <= CURRENT_DATE
         ), 0) AS habit_target_completed,
         EXISTS (
           SELECT 1 FROM habit_logs hl
           WHERE hl.habit_id = a.habit_target_habit_id
             AND hl.logged_date >= a.created_at::date
             AND hl.logged_date <= CURRENT_DATE
             AND (hl.voice_note_url IS NOT NULL OR hl.voice_note_data IS NOT NULL)
         ) AS habit_target_has_voice_note,
         (
           SELECT hl.voice_note_storage_id FROM habit_logs hl
           WHERE hl.habit_id = a.habit_target_habit_id
             AND (hl.voice_note_url IS NOT NULL OR hl.voice_note_data IS NOT NULL)
           ORDER BY hl.logged_date DESC LIMIT 1
         ) AS habit_target_latest_voice_storage_id,
         a.theory_prompt_text,
         a.theory_prompt_storage_id,
         a.is_makeup,
         a.batch_id,
         a.session_date,
         COALESCE((
           SELECT json_agg(json_build_object(
             'id',              ha.id,
             'file_storage_id', ha.file_storage_id,
             'label',           ha.label,
             'public_url',      fs.public_url,
             'file_name',       fs.file_name,
             'mime_type',       fs.mime_type
           ) ORDER BY ha.created_at)
           FROM homework_attachments ha
           LEFT JOIN file_storage fs ON fs.id = ha.file_storage_id
           WHERE ha.assignment_id = a.id
         ), '[]'::json) AS attachments,
         CASE WHEN s.id IS NOT NULL THEN json_build_object(
           'id',                       s.id,
           'file_name',                s.file_name,
           'file_type',                s.file_type,
           'file_url',                 s.file_url,
           'file_storage_id',          s.file_storage_id,
           'note',                     s.note,
           'submitted_at',             s.submitted_at,
           'theory_answer_text',       s.theory_answer_text,
           'theory_answer_storage_id', s.theory_answer_storage_id
         ) END AS submission
       FROM homework_assignments a
       LEFT JOIN homework_submissions s ON s.assignment_id = a.id
       LEFT JOIN habits ht ON ht.id = a.habit_target_habit_id
       WHERE a.student_id = $1
       ORDER BY a.is_makeup ASC, a.created_at DESC`,
      [studentId]
    );
    res.json({ assignments: result.rows });
  } catch (err) {
    console.error('Error fetching homework:', err);
    res.status(500).json({ error: 'Failed to fetch homework' });
  }
});

// POST /api/homework/:id/submit — student submits audio (pending or returned state)
router.post('/homework/:id/submit', async (req, res) => {
  const { id } = req.params;
  const { file_name, file_type, file_data, note,
          theory_answer_text, theory_answer_file } = req.body;

  if (!file_data) {
    return res.status(400).json({ error: 'file_data is required' });
  }

  // Drive upload when DRIVE_ENABLED=true and the homework audio folder is configured
  const useDrive =
    process.env.DRIVE_ENABLED === 'true' &&
    Boolean(process.env.DRIVE_FOLDER_HOMEWORK_AUDIO);

  let fileUrl   = null;
  let storageId = null;
  let storedData = null;

  if (useDrive) {
    try {
      const driveService = require('../services/driveService');
      const base64Part = file_data.includes(',') ? file_data.split(',')[1] : file_data;
      const buffer     = Buffer.from(base64Part, 'base64');
      const mimeType   = file_type || 'audio/webm';

      // Build a descriptive filename: StudentName_Instrument_YYYY-MM-DD.ext
      let fileName = file_name || `homework_${id}_${Date.now()}.webm`;
      try {
        const meta = await pool.query(
          `SELECT s.name AS student_name, inst.name AS instrument
           FROM homework_assignments ha
           JOIN students s ON s.id = ha.student_id
           LEFT JOIN enrollments e ON e.student_id = s.id AND e.status = 'active'
           LEFT JOIN enrollment_batches eb ON eb.enrollment_id = e.id
           LEFT JOIN batches b ON b.id = eb.batch_id
           LEFT JOIN instruments inst ON inst.id = b.instrument_id
           WHERE ha.id = $1
           ORDER BY inst.name NULLS LAST
           LIMIT 1`,
          [id]
        );
        if (meta.rows.length > 0) {
          fileName = driveService.buildDriveFileName({
            studentName:  meta.rows[0].student_name,
            instrument:   meta.rows[0].instrument,
            originalName: file_name || 'audio.webm',
          });
        }
      } catch (_) { /* fallback to original fileName */ }

      const result = await driveService.upload({
        buffer,
        fileName,
        mimeType,
        category:   'homework_audio',
        entityType: 'homework_submission',
        entityId:   null, // backfilled after upsert below
      });
      fileUrl   = result.publicUrl;
      storageId = result.fileStorageId;
    } catch (err) {
      console.error('Drive upload failed, falling back to DB storage:', err.message);
      storedData = file_data; // graceful fallback to legacy path
    }
  } else {
    storedData = file_data;
  }

  // Upload theory answer scan if provided
  let theoryAnswerStorageId = null;
  if (theory_answer_file) {
    const useDriveTheory = process.env.DRIVE_ENABLED === 'true' && Boolean(process.env.DRIVE_FOLDER_HOMEWORK_AUDIO);
    if (useDriveTheory) {
      try {
        const driveService = require('../services/driveService');
        const base64Part = theory_answer_file.includes(',') ? theory_answer_file.split(',')[1] : theory_answer_file;
        const buffer = Buffer.from(base64Part, 'base64');
        const { fileStorageId } = await driveService.upload({
          buffer,
          fileName: `theory_answer_${id}_${Date.now()}.pdf`,
          mimeType: 'application/pdf',
          category: 'student_document',
          entityType: 'theory_answer',
          entityId: id,
        });
        theoryAnswerStorageId = fileStorageId;
      } catch (err) {
        console.error('Theory answer upload failed:', err.message);
      }
    }
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existing = await client.query(
      'SELECT id FROM homework_submissions WHERE assignment_id = $1', [id]
    );
    let submissionId;

    if (existing.rows.length > 0) {
      const upd = await client.query(
        `UPDATE homework_submissions
         SET file_name=$1, file_type=$2, file_data=$3, note=$4,
             file_url=$5, file_storage_id=$6, submitted_at=NOW(),
             theory_answer_text=$7, theory_answer_storage_id=$8
         WHERE assignment_id=$9
         RETURNING id`,
        [file_name || null, file_type || null, storedData, note || null,
         fileUrl, storageId,
         theory_answer_text || null, theoryAnswerStorageId,
         id]
      );
      submissionId = upd.rows[0].id;
    } else {
      const assignment = await client.query(
        'SELECT student_id FROM homework_assignments WHERE id = $1', [id]
      );
      if (assignment.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Assignment not found' });
      }
      const ins = await client.query(
        `INSERT INTO homework_submissions
           (assignment_id, student_id, file_name, file_type, file_data, note, file_url, file_storage_id,
            theory_answer_text, theory_answer_storage_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         RETURNING id`,
        [id, assignment.rows[0].student_id,
         file_name || null, file_type || null, storedData, note || null,
         fileUrl, storageId,
         theory_answer_text || null, theoryAnswerStorageId]
      );
      submissionId = ins.rows[0].id;
    }

    // Backfill entity_id on the file_storage row now that we have the submission id
    if (storageId && submissionId) {
      await client.query(
        'UPDATE file_storage SET entity_id = $1 WHERE id = $2',
        [submissionId, storageId]
      );
    }

    // Allow submission from pending or returned state
    await client.query(
      `UPDATE homework_assignments SET status = 'submitted'
       WHERE id = $1 AND status IN ('pending', 'returned')`,
      [id]
    );

    // Append submitted entry to history
    await client.query(
      `UPDATE homework_assignments
       SET submission_history = submission_history || $1::jsonb
       WHERE id = $2`,
      [
        JSON.stringify([{
          type:            'submitted',
          at:              new Date().toISOString(),
          file_url:        fileUrl,
          file_storage_id: storageId,
          file_name:       file_name || null,
          note:            note || null,
        }]),
        id,
      ]
    );

    await client.query('COMMIT');
    res.json({ submission_id: submissionId, file_url: fileUrl });

    // XP + notification (fire-and-forget)
    pool.query(
      `SELECT s.id AS student_id, s.name AS student_name,
              a.title, a.due_date, a.assigned_by_user_id,
              a.habit_target_habit_id, a.habit_target_count, a.created_at
       FROM homework_assignments a JOIN students s ON s.id = a.student_id
       WHERE a.id = $1`, [id]
    ).then(async ({ rows }) => {
      if (!rows.length) return;
      const { student_id, student_name, title, due_date, assigned_by_user_id,
              habit_target_habit_id, habit_target_count, created_at } = rows[0];
      const xpService = require('../services/xpService');

      // On-time vs late XP
      const onTime = due_date && new Date() <= new Date(due_date);
      xpService.awardXP(student_id,
        onTime ? 'homework_submit_ontime' : 'homework_submit_late',
        onTime ? 50 : 20,
        { refId: id, metadata: { title } }
      );

      // Habit target bonus XP
      if (habit_target_habit_id && habit_target_count) {
        try {
          const logRes = await pool.query(
            `SELECT COUNT(*)::int AS cnt FROM habit_logs
             WHERE habit_id = $1 AND logged_date >= $2::date AND logged_date <= CURRENT_DATE`,
            [habit_target_habit_id, created_at]
          );
          if (logRes.rows[0].cnt >= habit_target_count) {
            xpService.awardXP(student_id, 'homework_habit_target', 25, {
              refId: id, metadata: { habit_id: habit_target_habit_id, logCount: logRes.rows[0].cnt },
            });
          }
        } catch (_) {}
      }

      pushNotification({
        type:        'HOMEWORK_SUBMITTED',
        title:       'Homework Submitted',
        message:     `${student_name} submitted "${title}"`,
        action_link: '/students',
        metadata:    { assignment_id: id, student_name, title },
        user_id:     assigned_by_user_id || null,
      });
    }).catch(() => {});

  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error submitting homework:', err);
    res.status(500).json({ error: 'Failed to submit homework' });
  } finally {
    client.release();
  }
});

// GET /api/homework/:id/submission — fetch submission with file_data for legacy playback
router.get('/homework/:id/submission', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'SELECT * FROM homework_submissions WHERE assignment_id = $1 LIMIT 1',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'No submission found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching submission:', err);
    res.status(500).json({ error: 'Failed to fetch submission' });
  }
});

// PUT /api/homework/:id/review — return with comment or close with marks
// Body: { action: 'return' | 'close', comment?, marks_awarded?, marks_awarded_breakdown? }
router.put('/homework/:id/review', async (req, res) => {
  const { id } = req.params;
  const { action, comment, marks_awarded, marks_awarded_breakdown } = req.body;

  if (action !== 'return' && action !== 'close') {
    return res.status(400).json({ error: 'action must be "return" or "close"' });
  }

  try {
    const historyEntry = {
      type:    action === 'return' ? 'returned' : 'closed',
      at:      new Date().toISOString(),
      comment: comment || null,
      marks_awarded:           action === 'close' ? (marks_awarded || null) : undefined,
      marks_awarded_breakdown: action === 'close' ? (marks_awarded_breakdown || null) : undefined,
    };

    if (action === 'return') {
      await pool.query(
        `UPDATE homework_assignments
         SET status = 'returned', teacher_comment = $1,
             submission_history = submission_history || $2::jsonb
         WHERE id = $3`,
        [comment || null, JSON.stringify([historyEntry]), id]
      );
    } else {
      await pool.query(
        `UPDATE homework_assignments
         SET status = 'closed', teacher_comment = $1, marks_awarded = $2, marks_awarded_breakdown = $3,
             submission_history = submission_history || $4::jsonb
         WHERE id = $5`,
        [
          comment || null,
          marks_awarded || null,
          marks_awarded_breakdown ? JSON.stringify(marks_awarded_breakdown) : null,
          JSON.stringify([historyEntry]),
          id,
        ]
      );
    }
    res.json({ success: true });

    // XP (on close only) + notification (fire-and-forget)
    pool.query(
      `SELECT s.id AS student_id, s.name AS student_name, a.title, a.total_marks,
              sg.user_id AS student_user_id
       FROM homework_assignments a
       JOIN students s ON s.id = a.student_id
       LEFT JOIN LATERAL (
         SELECT user_id FROM student_guardians
         WHERE student_id = s.id AND is_active = true
         ORDER BY is_primary DESC NULLS LAST
         LIMIT 1
       ) sg ON true
       WHERE a.id = $1
       LIMIT 1`, [id]
    ).then(({ rows }) => {
      if (!rows.length) return;
      const { student_id, student_name, title, total_marks, student_user_id } = rows[0];

      // Grade XP on close
      if (action === 'close' && marks_awarded != null && total_marks) {
        const xpService = require('../services/xpService');
        const gradeXP = Math.round((marks_awarded / total_marks) * 50);
        if (gradeXP > 0) {
          xpService.awardXP(student_id, 'homework_grade', gradeXP,
            { refId: id, metadata: { marks_awarded, total_marks, title } });
        }
        if (marks_awarded === total_marks) {
          xpService.awardXP(student_id, 'homework_grade_perfect', 30,
            { refId: id, metadata: { title } });
        }
      }

      const isReturn = action === 'return';
      pushNotification({
        type:        isReturn ? 'HOMEWORK_RETURNED' : 'HOMEWORK_GRADED',
        title:       isReturn ? 'Homework Returned' : 'Homework Graded',
        message:     isReturn
          ? `Your submission for "${title}" has been returned with feedback`
          : `Your submission for "${title}" has been graded`,
        action_link: '/student-profile',
        metadata:    { assignment_id: id, student_name, title },
        user_id:     student_user_id || null,
      });
    }).catch(() => {});

  } catch (err) {
    console.error('Error reviewing homework:', err);
    res.status(500).json({ error: 'Failed to update assignment' });
  }
});

// DELETE /api/homework/:id — admin, or the teacher who assigned it, deletes an
// assignment (cascade-deletes its submission/attachments rows) and best-effort
// removes every associated file from Google Drive so nothing is left orphaned.
router.delete('/homework/:id', authenticateJWT, async (req, res) => {
  const { id } = req.params;
  try {
    const assignment = await pool.query(
      'SELECT id, assigned_by_user_id, theory_prompt_storage_id FROM homework_assignments WHERE id = $1',
      [id]
    );
    if (assignment.rows.length === 0) {
      return res.status(404).json({ error: 'Assignment not found' });
    }

    const isAdmin = req.user.roles?.includes('admin');
    const isOwner = req.user.id && req.user.id === assignment.rows[0].assigned_by_user_id;
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ error: 'Only an admin or the assigning teacher can delete this assignment' });
    }

    // Gather every file_storage row this assignment (directly or via its attachments/
    // submission) references, so the Drive files get cleaned up before the DB rows
    // disappear via cascade — file_storage has no FK-driven cascade of its own.
    const storageIds = new Set();
    if (assignment.rows[0].theory_prompt_storage_id) {
      storageIds.add(assignment.rows[0].theory_prompt_storage_id);
    }
    const attachments = await pool.query(
      'SELECT file_storage_id FROM homework_attachments WHERE assignment_id = $1 AND file_storage_id IS NOT NULL',
      [id]
    );
    attachments.rows.forEach(r => storageIds.add(r.file_storage_id));
    const submission = await pool.query(
      'SELECT file_storage_id, theory_answer_storage_id FROM homework_submissions WHERE assignment_id = $1',
      [id]
    );
    submission.rows.forEach(r => {
      if (r.file_storage_id) storageIds.add(r.file_storage_id);
      if (r.theory_answer_storage_id) storageIds.add(r.theory_answer_storage_id);
    });

    // Look up drive_file_id now (while the file_storage rows still exist), but don't
    // touch file_storage yet — homework_attachments.file_storage_id has no cascade,
    // so file_storage rows can only be deleted after the assignment (and the
    // attachments/submission rows that reference them) are gone.
    let files = [];
    if (storageIds.size > 0) {
      const result = await pool.query(
        'SELECT id, drive_file_id FROM file_storage WHERE id = ANY($1::uuid[])',
        [[...storageIds]]
      );
      files = result.rows;
    }

    // DB cleanup is one atomic unit — either the assignment and every file_storage
    // row it owned disappear together, or nothing changes on failure.
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM homework_assignments WHERE id = $1', [id]);
      if (storageIds.size > 0) {
        await client.query('DELETE FROM file_storage WHERE id = ANY($1::uuid[])', [[...storageIds]]);
      }
      await client.query('COMMIT');
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }

    // Drive cleanup happens only after the DB commit succeeds, and is best-effort —
    // deleteFile() already treats "already gone" (404) as success, so this is safe
    // to retry if a previous attempt got partway through.
    const driveService = require('../services/driveService');
    for (const file of files) {
      try {
        if (file.drive_file_id) await driveService.deleteFile(file.drive_file_id);
      } catch (err) {
        console.error(`[DELETE /homework/:id] Drive delete failed for ${file.drive_file_id}:`, err.message);
      }
    }

    res.json({ message: 'Deleted', files_removed: files.length });
  } catch (err) {
    console.error('Error deleting homework:', err);
    res.status(500).json({ error: 'Failed to delete homework' });
  }
});

// ── Teacher audio instructions ────────────────────────────────────────────────

// POST /api/homework/audio-instruction — teacher records/uploads audio for multiple students
router.post('/homework/audio-instruction', async (req, res) => {
  const { title, student_ids, audio_data, audio_file_name, audio_mime_type } = req.body;
  if (!title?.trim())
    return res.status(400).json({ error: 'title is required' });
  if (!Array.isArray(student_ids) || student_ids.length === 0)
    return res.status(400).json({ error: 'student_ids must be a non-empty array' });
  if (!audio_data)
    return res.status(400).json({ error: 'audio_data is required' });

  const mimeType = audio_mime_type || 'audio/webm';
  const useDrive =
    process.env.DRIVE_ENABLED === 'true' &&
    Boolean(process.env.DRIVE_FOLDER_HOMEWORK_AUDIO);

  let audioStorageId = null;
  let audioUrl       = null;
  let storedData     = null;

  if (useDrive) {
    try {
      const driveService = require('../services/driveService');
      const base64Part   = audio_data.includes(',') ? audio_data.split(',')[1] : audio_data;
      const buffer       = Buffer.from(base64Part, 'base64');
      const result       = await driveService.upload({
        buffer,
        fileName:   audio_file_name || `audio_instruction_${Date.now()}.webm`,
        mimeType,
        category:   'homework_audio',
        entityType: 'audio_instruction',
      });
      audioUrl       = result.publicUrl;
      audioStorageId = result.fileStorageId;
    } catch (err) {
      console.error('[audio-instruction] Drive upload failed, falling back to DB:', err.message);
      storedData = audio_data;
    }
  } else {
    storedData = audio_data;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const ins = await client.query(
      `INSERT INTO teacher_audio_instructions
         (title, audio_storage_id, audio_url, audio_data, mime_type, created_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, title, created_at`,
      [title.trim(), audioStorageId, audioUrl, storedData, mimeType, req.user?.id || null]
    );
    const instructionId = ins.rows[0].id;

    for (const studentId of student_ids) {
      await client.query(
        `INSERT INTO teacher_audio_instruction_students (instruction_id, student_id)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [instructionId, studentId]
      );
    }

    await client.query('COMMIT');
    res.status(201).json({ instruction: ins.rows[0], recipients: student_ids.length });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Error creating audio instruction:', err);
    res.status(500).json({ error: 'Failed to create audio instruction' });
  } finally {
    client.release();
  }
});

// GET /api/students/:studentId/audio-instructions — list instructions for a student
router.get('/students/:studentId/audio-instructions', async (req, res) => {
  const { studentId } = req.params;
  try {
    const result = await pool.query(
      `SELECT
         ai.id, ai.title, ai.audio_storage_id, ai.audio_url, ai.mime_type,
         ai.created_at,
         u.name AS teacher_name
       FROM teacher_audio_instruction_students tais
       JOIN teacher_audio_instructions ai ON ai.id = tais.instruction_id
       LEFT JOIN users u ON u.id = ai.created_by_user_id
       WHERE tais.student_id = $1
       ORDER BY ai.created_at DESC`,
      [studentId]
    );
    res.json({ instructions: result.rows });
  } catch (err) {
    console.error('Error fetching audio instructions:', err);
    res.status(500).json({ error: 'Failed to fetch audio instructions' });
  }
});

// GET /api/homework/audio-instructions/:id/stream — stream the audio file
// Uses resolveUser (not strict auth) so <audio src="..."> works in the browser without custom headers.
router.get('/homework/audio-instructions/:id/stream', resolveUser, async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      `SELECT ai.audio_storage_id, ai.audio_url, ai.audio_data, ai.mime_type,
              fs.drive_file_id, fs.mime_type AS fs_mime
       FROM teacher_audio_instructions ai
       LEFT JOIN file_storage fs ON fs.id = ai.audio_storage_id
       WHERE ai.id = $1`,
      [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    const row = result.rows[0];

    if (row.drive_file_id) {
      try {
        const driveService = require('../services/driveService');
        const { stream, mimeType } = await driveService.getFileStream(row.drive_file_id);
        res.setHeader('Content-Type', mimeType || row.fs_mime || 'audio/webm');
        res.setHeader('Cache-Control', 'private, max-age=3600');
        stream.pipe(res);
        stream.on('error', () => res.status(500).end());
        return;
      } catch (err) {
        console.error('[audio-instruction] Drive stream failed:', err.message);
      }
    }

    if (row.audio_data) {
      const base64Part = row.audio_data.includes(',') ? row.audio_data.split(',')[1] : row.audio_data;
      const buffer     = Buffer.from(base64Part, 'base64');
      res.setHeader('Content-Type', row.mime_type || 'audio/webm');
      res.setHeader('Content-Length', buffer.length);
      res.setHeader('Cache-Control', 'private, max-age=3600');
      return res.end(buffer);
    }

    if (row.audio_url) return res.redirect(row.audio_url);

    res.status(404).json({ error: 'Audio data not available' });
  } catch (err) {
    console.error('[audio-instruction] stream error:', err);
    res.status(500).json({ error: 'Failed to stream audio' });
  }
});

// DELETE /api/homework/audio-instructions/:id — teacher deletes an instruction (removes all recipients)
router.delete('/homework/audio-instructions/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM teacher_audio_instructions WHERE id = $1 RETURNING id', [id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json({ success: true });
  } catch (err) {
    console.error('Error deleting audio instruction:', err);
    res.status(500).json({ error: 'Failed to delete audio instruction' });
  }
});

// POST /api/homework/assign-makeup-bulk — assign the same makeup material (multi-file) to
// one or more absent students in one go. Files and the theory sheet are uploaded once and
// shared across every target student's assignment row (not re-uploaded per student).
router.post('/homework/assign-makeup-bulk', resolveUser, async (req, res) => {
  if (!req.user) return res.status(401).json({ error: 'Authentication required' });

  const {
    targets, session_date, title, instructions, files,
    theory_prompt_text, theory_prompt_file,
  } = req.body;

  if (!Array.isArray(targets) || targets.length === 0 || targets.some(t => !t?.student_id)) {
    return res.status(400).json({ error: 'targets must be a non-empty array of { student_id, batch_id }' });
  }
  if (!title?.trim()) {
    return res.status(400).json({ error: 'title is required' });
  }

  const driveService = require('../services/driveService');
  const wa           = require('../services/whatsappService');

  // Upload theory sheet once, if provided — mirrors /homework/assign and /homework/assign-bulk.
  let theoryPromptStorageId = null;
  if (theory_prompt_file) {
    const useDrive = process.env.DRIVE_ENABLED === 'true' && Boolean(process.env.DRIVE_FOLDER_HOMEWORK_AUDIO);
    if (useDrive) {
      try {
        const base64Part = theory_prompt_file.includes(',') ? theory_prompt_file.split(',')[1] : theory_prompt_file;
        const buffer = Buffer.from(base64Part, 'base64');
        const { fileStorageId } = await driveService.upload({
          buffer,
          fileName: `theory_prompt_makeup_${Date.now()}.pdf`,
          mimeType: 'application/pdf',
          category: 'student_document',
          entityType: 'theory_prompt',
        });
        theoryPromptStorageId = fileStorageId;
      } catch (err) {
        console.error('[assign-makeup-bulk] theory sheet upload failed:', err.message);
        return res.status(502).json({ error: 'Failed to upload theory sheet. Please try again.' });
      }
    }
  }

  // Upload each attachment once — every target student's assignment gets its own
  // homework_attachments row pointing at the same shared file_storage_id.
  const uploadedAttachments = [];
  const failedFiles = [];
  if (Array.isArray(files) && files.length > 0) {
    for (const f of files) {
      if (!f.data) continue;
      const base64Part = f.data.includes(',') ? f.data.split(',')[1] : f.data;
      try {
        const buffer = Buffer.from(base64Part, 'base64');
        const { fileStorageId } = await driveService.upload({
          buffer,
          fileName:   f.name || `makeup_${Date.now()}`,
          mimeType:   f.mimeType || 'application/octet-stream',
          category:   'student_document',
          entityType: 'homework_assignment',
        });
        uploadedAttachments.push({ storageId: fileStorageId, name: f.name || null });
      } catch (uploadErr) {
        console.error('[assign-makeup-bulk] upload failed:', uploadErr.message);
        failedFiles.push(f.name || 'attachment');
      }
    }
    // If every file failed to upload, don't silently assign material with nothing attached.
    if (uploadedAttachments.length === 0) {
      return res.status(502).json({
        error: 'Failed to upload attachment(s). Please try again.',
        failed_files: failedFiles,
      });
    }
  }

  const client = await pool.connect();
  const created = [];

  try {
    await client.query('BEGIN');

    for (const t of targets) {
      const assignRes = await client.query(`
        INSERT INTO homework_assignments
          (student_id, batch_id, session_date, title, instructions,
           theory_prompt_text, theory_prompt_storage_id,
           is_makeup, assigned_by, assigned_by_user_id, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, TRUE, $8, $9, 'pending')
        RETURNING id
      `, [
        t.student_id,
        t.batch_id   || null,
        session_date || null,
        title.trim(),
        instructions?.trim() || null,
        theory_prompt_text?.trim() || null,
        theoryPromptStorageId,
        req.user.roles?.includes('teacher') ? 'teacher' : 'admin',
        req.user.id || null,
      ]);
      const assignmentId = assignRes.rows[0].id;
      created.push({ assignment_id: assignmentId, student_id: t.student_id, batch_id: t.batch_id || null });

      for (const att of uploadedAttachments) {
        await client.query(
          'INSERT INTO homework_attachments (assignment_id, file_storage_id, label) VALUES ($1, $2, $3)',
          [assignmentId, att.storageId, att.name]
        );
      }
    }

    await client.query('COMMIT');

    res.json({
      success: true,
      assignments: created,
      assigned_count: created.length,
      attached: uploadedAttachments.length,
      failed_files: failedFiles,
    });

    // Fire-and-forget WhatsApp notifications — sent after the response so a WA
    // failure (bad template, API outage, etc.) never affects the assignment result.
    if (wa.isEnabled()) {
      for (const a of created) {
        pool.query(
          `SELECT s.id, s.name, i.name AS instrument
           FROM students s
           LEFT JOIN enrollment_batches eb
                 ON eb.enrollment_id = (SELECT id FROM enrollments WHERE student_id = s.id LIMIT 1)
                AND eb.batch_id = $2
           LEFT JOIN batches    b ON b.id = eb.batch_id
           LEFT JOIN instruments i ON i.id = b.instrument_id
           WHERE s.id = $1`,
          [a.student_id, a.batch_id || '00000000-0000-0000-0000-000000000000']
        ).then(({ rows }) => {
          if (!rows[0]) return;
          wa.notifyMakeupMaterial(
            rows[0].id, rows[0].name,
            rows[0].instrument || 'Music',
            session_date, title.trim()
          ).catch(() => {});
        }).catch(() => {});
      }
    }
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('[POST /homework/assign-makeup-bulk]', err);
    res.status(500).json({ error: 'Failed to assign makeup material' });
  } finally {
    client.release();
  }
});

module.exports = router;
