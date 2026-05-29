'use strict';

const express = require('express');
const multer  = require('multer');
const router  = express.Router();
const driveService  = require('../services/driveService');
const { authenticateJWT } = require('../auth/jwtMiddleware');
const { authorizeRole }   = require('../auth/rbacMiddleware');

// In-memory storage — buffer passed directly to Drive, no temp files on disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: parseInt(process.env.MAX_UPLOAD_BYTES ?? '52428800', 10) }, // 50 MB default
});

/**
 * POST /api/files/upload
 *
 * Generic multipart file upload to Google Drive.
 * Intended for Trinity recordings, marketing material, and any future category.
 *
 * Form fields:
 *   file       — binary file (required)
 *   category   — one of: homework_audio, student_document, profile_image,
 *                        trinity_recording, marketing  (required)
 *   entityType — logical entity type, e.g. 'evaluation', 'marketing'  (required)
 *   entityId   — UUID of the referencing entity  (optional)
 *
 * Returns: { fileStorageId, publicUrl, fileName, mimeType }
 */
router.post(
  '/files/upload',
  authenticateJWT,
  authorizeRole(['admin', 'teacher']),
  upload.single('file'),
  async (req, res) => {
    const { category, entityType, entityId } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'No file provided' });
    }
    if (!category || !entityType) {
      return res.status(400).json({ error: 'category and entityType are required' });
    }
    if (!driveService.validCategories().includes(category)) {
      return res.status(400).json({
        error: `Invalid category. Valid values: ${driveService.validCategories().join(', ')}`,
      });
    }

    try {
      const { fileStorageId, publicUrl } = await driveService.upload({
        buffer:     req.file.buffer,
        fileName:   req.file.originalname,
        mimeType:   req.file.mimetype,
        category,
        entityType,
        entityId:   entityId || null,
      });

      res.status(201).json({
        fileStorageId,
        publicUrl,
        fileName: req.file.originalname,
        mimeType: req.file.mimetype,
      });
    } catch (err) {
      console.error('[POST /api/files/upload]', err.message);
      res.status(500).json({ error: 'File upload failed', detail: err.message });
    }
  }
);

/**
 * GET /api/files/:fileStorageId — fetch metadata for a tracked file
 */
router.get('/files/:fileStorageId', authenticateJWT, async (req, res) => {
  const pool = require('../db');
  try {
    const { rows } = await pool.query(
      `SELECT id, category, entity_type, entity_id, file_name, mime_type,
              file_size_bytes, public_url, uploaded_at, expires_at, deleted_at
       FROM file_storage WHERE id = $1`,
      [req.params.fileStorageId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'File not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch file metadata' });
  }
});

/**
 * GET /api/files/:fileStorageId/stream
 *
 * Proxies the Drive file back through the backend so the browser gets a
 * same-origin, CORS-free, range-capable response for <audio> playback.
 */
router.get('/files/:fileStorageId/stream', authenticateJWT, async (req, res) => {
  const pool = require('../db');

  try {
    const { rows } = await pool.query(
      `SELECT drive_file_id, mime_type, file_name, file_size_bytes, deleted_at
       FROM file_storage WHERE id = $1`,
      [req.params.fileStorageId]
    );
    if (rows.length === 0) return res.status(404).json({ error: 'File not found' });
    const file = rows[0];
    if (file.deleted_at) return res.status(410).json({ error: 'File has been deleted' });

    const driveClient = driveService.getDriveClient();

    // Always fetch the full file — browser will seek in its in-memory buffer.
    // Avoids the complexity of forwarding 206/Content-Range from Drive.
    const driveRes = await driveClient.files.get(
      { fileId: file.drive_file_id, alt: 'media' },
      { responseType: 'stream' }
    );

    res.setHeader('Content-Type', file.mime_type || 'application/octet-stream');
    res.setHeader('Accept-Ranges', 'none');
    if (file.file_size_bytes) res.setHeader('Content-Length', file.file_size_bytes);
    res.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(file.file_name || 'audio')}"`
    );

    res.status(200);
    driveRes.data.pipe(res);
  } catch (err) {
    console.error('[GET /api/files/stream]', err.message);
    if (!res.headersSent) res.status(500).json({ error: 'Stream failed', detail: err.message });
  }
});

module.exports = router;
