'use strict';

const express = require('express');
const router  = express.Router();
const pool    = require('../db');

// GET /api/students/:studentId/documents — list (no file_data for performance)
router.get('/students/:studentId/documents', async (req, res) => {
  const { studentId } = req.params;
  try {
    const result = await pool.query(
      `SELECT id, filename, file_type, file_url, file_storage_id, uploaded_at
       FROM student_documents WHERE student_id = $1 ORDER BY uploaded_at DESC`,
      [studentId]
    );
    res.json({ documents: result.rows });
  } catch (err) {
    console.error('Error fetching documents:', err);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// GET /api/documents/:id — download/view (includes file_data for legacy rows)
router.get('/documents/:id', async (req, res) => {
  const { id } = req.params;
  try {
    const result = await pool.query('SELECT * FROM student_documents WHERE id = $1', [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Document not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error('Error fetching document:', err);
    res.status(500).json({ error: 'Failed to fetch document' });
  }
});

// POST /api/students/:studentId/documents — upload document
router.post('/students/:studentId/documents', async (req, res) => {
  const { studentId } = req.params;
  const { filename, file_type, file_data } = req.body;

  if (!filename || !file_data) {
    return res.status(400).json({ error: 'Filename and file data are required' });
  }

  const useDrive =
    process.env.DRIVE_ENABLED === 'true' &&
    Boolean(process.env.DRIVE_FOLDER_STUDENT_DOCUMENTS);

  let fileUrl   = null;
  let storageId = null;
  let storedData = null;

  if (useDrive) {
    try {
      const driveService = require('../services/driveService');
      const base64Part = file_data.includes(',') ? file_data.split(',')[1] : file_data;
      const buffer     = Buffer.from(base64Part, 'base64');
      const mimeType   = file_type || 'application/octet-stream';

      const result = await driveService.upload({
        buffer,
        fileName:   filename,
        mimeType,
        category:   'student_document',
        entityType: 'student_document',
        entityId:   null, // backfilled after INSERT
      });
      fileUrl   = result.publicUrl;
      storageId = result.fileStorageId;
    } catch (err) {
      console.error('Drive upload failed, falling back to DB storage:', err.message);
      storedData = file_data;
    }
  } else {
    storedData = file_data;
  }

  try {
    const result = await pool.query(
      `INSERT INTO student_documents
         (student_id, filename, file_type, file_data, file_url, file_storage_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, filename, uploaded_at, file_url`,
      [studentId, filename, file_type, storedData, fileUrl, storageId]
    );

    // Backfill entity_id now that we have the document id
    if (storageId) {
      await pool.query(
        'UPDATE file_storage SET entity_id = $1 WHERE id = $2',
        [result.rows[0].id, storageId]
      );
    }

    res.status(201).json({ document: result.rows[0], message: 'Document uploaded successfully' });
  } catch (err) {
    console.error('Error uploading document:', err);
    res.status(500).json({ error: 'Failed to upload document' });
  }
});

// DELETE /api/documents/:id — delete document
router.delete('/documents/:id', async (req, res) => {
  const { id } = req.params;
  try {
    await pool.query('DELETE FROM student_documents WHERE id = $1', [id]);
    res.json({ message: 'Document deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

module.exports = router;
