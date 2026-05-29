'use strict';

const express = require('express');
const router  = express.Router();
const pool    = require('../db');

// POST /api/homework/assign — teacher/admin assigns homework to a student
router.post('/homework/assign', async (req, res) => {
  const { student_id, title, instructions, due_date, assigned_by, total_marks, marks_breakdown } = req.body;
  if (!student_id || !title?.trim()) {
    return res.status(400).json({ error: 'student_id and title are required' });
  }
  try {
    const result = await pool.query(
      `INSERT INTO homework_assignments
         (student_id, title, instructions, due_date, assigned_by, total_marks, marks_breakdown)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, student_id, title, instructions, due_date, assigned_by, created_at, status,
                 total_marks, marks_breakdown`,
      [
        student_id,
        title.trim(),
        instructions || null,
        due_date || null,
        assigned_by || 'teacher',
        total_marks || null,
        marks_breakdown ? JSON.stringify(marks_breakdown) : null,
      ]
    );
    res.status(201).json({ assignment: result.rows[0] });
  } catch (err) {
    console.error('Error assigning homework:', err);
    res.status(500).json({ error: 'Failed to assign homework' });
  }
});

// GET /api/students/:studentId/homework — list assignments with submission info (no file_data)
router.get('/students/:studentId/homework', async (req, res) => {
  const { studentId } = req.params;
  try {
    const result = await pool.query(
      `SELECT
         a.id, a.student_id, a.title, a.instructions, a.due_date,
         a.assigned_by, a.created_at, a.status,
         a.total_marks, a.marks_breakdown,
         a.teacher_comment, a.marks_awarded, a.marks_awarded_breakdown,
         CASE WHEN s.id IS NOT NULL THEN json_build_object(
           'id',              s.id,
           'file_name',       s.file_name,
           'file_type',       s.file_type,
           'file_url',        s.file_url,
           'file_storage_id', s.file_storage_id,
           'note',            s.note,
           'submitted_at',    s.submitted_at
         ) END AS submission
       FROM homework_assignments a
       LEFT JOIN homework_submissions s ON s.assignment_id = a.id
       WHERE a.student_id = $1
       ORDER BY a.created_at DESC`,
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
  const { file_name, file_type, file_data, note } = req.body;

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
      const fileName   = file_name || `homework_${id}_${Date.now()}.webm`;

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
             file_url=$5, file_storage_id=$6, submitted_at=NOW()
         WHERE assignment_id=$7
         RETURNING id`,
        [file_name || null, file_type || null, storedData, note || null,
         fileUrl, storageId, id]
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
           (assignment_id, student_id, file_name, file_type, file_data, note, file_url, file_storage_id)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         RETURNING id`,
        [id, assignment.rows[0].student_id,
         file_name || null, file_type || null, storedData, note || null,
         fileUrl, storageId]
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

    await client.query('COMMIT');
    res.json({ submission_id: submissionId, file_url: fileUrl });
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
    if (action === 'return') {
      await pool.query(
        `UPDATE homework_assignments SET status = 'returned', teacher_comment = $1 WHERE id = $2`,
        [comment || null, id]
      );
    } else {
      await pool.query(
        `UPDATE homework_assignments
         SET status = 'closed', teacher_comment = $1, marks_awarded = $2, marks_awarded_breakdown = $3
         WHERE id = $4`,
        [
          comment || null,
          marks_awarded || null,
          marks_awarded_breakdown ? JSON.stringify(marks_awarded_breakdown) : null,
          id,
        ]
      );
    }
    res.json({ success: true });
  } catch (err) {
    console.error('Error reviewing homework:', err);
    res.status(500).json({ error: 'Failed to update assignment' });
  }
});

// DELETE /api/homework/:id — delete assignment (cascade-deletes submission)
router.delete('/homework/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query(
      'DELETE FROM homework_assignments WHERE id = $1 RETURNING id', [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Assignment not found' });
    }
    res.json({ message: 'Deleted' });
  } catch (err) {
    console.error('Error deleting homework:', err);
    res.status(500).json({ error: 'Failed to delete homework' });
  }
});

module.exports = router;
