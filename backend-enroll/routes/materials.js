'use strict';

const express = require('express');
const jwt     = require('jsonwebtoken');
const router  = express.Router();
const pool    = require('../db');
const { authenticateJWT } = require('../auth/jwtMiddleware');
const { authorizeRole }   = require('../auth/rbacMiddleware');

const JWT_SECRET = process.env.JWT_SECRET || 'default-secret-key-change-in-prod';

const MATERIAL_TYPES = ['audio', 'video', 'image', 'document'];

// <img>/<audio>/<video> src attributes can't send an Authorization header, so the
// inline-preview stream accepts the JWT via ?token= as well — same pattern already
// used by the notifications SSE stream for the same reason.
function authenticateFromQueryOrHeader(req, res, next) {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : req.query.token;
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) return res.status(403).json({ error: 'Invalid or expired token' });
    req.user = user;
    next();
  });
}

function inferMaterialType(mimeType) {
  if (!mimeType) return 'document';
  if (mimeType.startsWith('audio/')) return 'audio';
  if (mimeType.startsWith('video/')) return 'video';
  if (mimeType.startsWith('image/')) return 'image';
  return 'document';
}

// POST /api/materials — teacher/admin records or uploads a new library item
router.post('/', authenticateJWT, authorizeRole(['admin', 'teacher']), async (req, res) => {
  const { title, description, instrument_id, file_data, file_name, mime_type } = req.body;

  if (!title?.trim())       return res.status(400).json({ error: 'title is required' });
  if (!instrument_id)       return res.status(400).json({ error: 'instrument_id is required' });
  if (!file_data)           return res.status(400).json({ error: 'file_data is required' });

  const mimeType     = mime_type || 'application/octet-stream';
  const materialType = inferMaterialType(mimeType);

  try {
    const driveService = require('../services/driveService');

    const instrumentRes = await pool.query('SELECT name FROM instruments WHERE id = $1', [instrument_id]);
    if (instrumentRes.rows.length === 0) {
      return res.status(400).json({ error: 'Unknown instrument_id' });
    }

    const base64Part = file_data.includes(',') ? file_data.split(',')[1] : file_data;
    const buffer      = Buffer.from(base64Part, 'base64');
    const fileName    = driveService.buildMaterialFileName({
      instrument:   instrumentRes.rows[0].name,
      title:        title.trim(),
      originalName: file_name || 'material',
    });

    const { fileStorageId } = await driveService.upload({
      buffer,
      fileName,
      mimeType,
      category:   'teaching_material',
      entityType: 'teaching_material',
    });

    const insertRes = await pool.query(
      `INSERT INTO teaching_materials
         (title, description, instrument_id, material_type, file_storage_id, created_by_user_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, title, description, instrument_id, material_type, created_at`,
      [title.trim(), description?.trim() || null, instrument_id, materialType, fileStorageId, req.user.id]
    );

    await driveService.setEntityId(fileStorageId, insertRes.rows[0].id);

    res.status(201).json({ material: insertRes.rows[0] });
  } catch (err) {
    console.error('[POST /materials]', err);
    res.status(502).json({ error: 'Failed to save material. Please try again.' });
  }
});

// GET /api/materials?instrument_id=&type=&q=&limit= — search the shared library.
// instrument_id alone returns every artefact type for that instrument; type further narrows.
router.get('/', authenticateJWT, authorizeRole(['admin', 'teacher']), async (req, res) => {
  const { instrument_id, type, q, limit } = req.query;

  if (type && !MATERIAL_TYPES.includes(type)) {
    return res.status(400).json({ error: `type must be one of: ${MATERIAL_TYPES.join(', ')}` });
  }

  const conditions = ['m.is_active = TRUE'];
  const params     = [];

  if (instrument_id) {
    params.push(instrument_id);
    conditions.push(`m.instrument_id = $${params.length}`);
  }
  if (type) {
    params.push(type);
    conditions.push(`m.material_type = $${params.length}`);
  }
  if (q?.trim()) {
    params.push(`%${q.trim()}%`);
    conditions.push(`m.title ILIKE $${params.length}`);
  }
  params.push(Math.min(parseInt(limit, 10) || 50, 200));
  const limitParam = `$${params.length}`;

  try {
    const result = await pool.query(
      `SELECT
         m.id, m.title, m.description, m.material_type, m.created_at,
         m.instrument_id, i.name AS instrument_name,
         fs.public_url, fs.file_name, fs.mime_type,
         m.created_by_user_id, u.name AS created_by_name
       FROM teaching_materials m
       JOIN instruments  i  ON i.id = m.instrument_id
       JOIN file_storage fs ON fs.id = m.file_storage_id
       LEFT JOIN users   u  ON u.id = m.created_by_user_id
       WHERE ${conditions.join(' AND ')}
       ORDER BY m.created_at DESC
       LIMIT ${limitParam}`,
      params
    );
    res.json({ materials: result.rows });
  } catch (err) {
    console.error('[GET /materials]', err);
    res.status(500).json({ error: 'Failed to search materials' });
  }
});

// GET /api/materials/:id — single item detail (for preview before attaching)
router.get('/:id', authenticateJWT, authorizeRole(['admin', 'teacher']), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         m.id, m.title, m.description, m.material_type, m.created_at,
         m.instrument_id, i.name AS instrument_name,
         fs.public_url, fs.file_name, fs.mime_type,
         m.created_by_user_id, u.name AS created_by_name
       FROM teaching_materials m
       JOIN instruments  i  ON i.id = m.instrument_id
       JOIN file_storage fs ON fs.id = m.file_storage_id
       LEFT JOIN users   u  ON u.id = m.created_by_user_id
       WHERE m.id = $1 AND m.is_active = TRUE`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Material not found' });
    res.json({ material: result.rows[0] });
  } catch (err) {
    console.error('[GET /materials/:id]', err);
    res.status(500).json({ error: 'Failed to fetch material' });
  }
});

// GET /api/materials/:id/file — streams the file inline (not a forced download) so
// <img>/<audio>/<video> can render it directly. Drive's own public_url always sends
// Content-Disposition: attachment, which browsers won't render inline — this proxies
// the bytes through the server without that header so genuine preview works.
router.get('/:id/file', authenticateFromQueryOrHeader, authorizeRole(['admin', 'teacher']), async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT fs.drive_file_id, fs.mime_type
       FROM teaching_materials m
       JOIN file_storage fs ON fs.id = m.file_storage_id
       WHERE m.id = $1 AND m.is_active = TRUE`,
      [req.params.id]
    );
    if (result.rows.length === 0) return res.status(404).json({ error: 'Material not found' });

    const driveService = require('../services/driveService');
    const { stream, mimeType } = await driveService.getFileStream(result.rows[0].drive_file_id);
    res.setHeader('Content-Type', mimeType || result.rows[0].mime_type || 'application/octet-stream');
    res.setHeader('Cache-Control', 'private, max-age=3600');
    stream.pipe(res);
    stream.on('error', () => res.status(500).end());
  } catch (err) {
    console.error('[GET /materials/:id/file]', err);
    res.status(500).json({ error: 'Failed to stream material' });
  }
});

// DELETE /api/materials/:id — admin or the teacher who created it. Soft-delete only —
// past assignments keep referencing the underlying file_storage row via
// homework_attachments.source_material_id, it just disappears from library search.
router.delete('/:id', authenticateJWT, authorizeRole(['admin', 'teacher']), async (req, res) => {
  try {
    const existing = await pool.query(
      'SELECT id, created_by_user_id FROM teaching_materials WHERE id = $1 AND is_active = TRUE',
      [req.params.id]
    );
    if (existing.rows.length === 0) return res.status(404).json({ error: 'Material not found' });

    const isAdmin = req.user.roles?.includes('admin');
    const isOwner = req.user.id && req.user.id === existing.rows[0].created_by_user_id;
    if (!isAdmin && !isOwner) {
      return res.status(403).json({ error: 'Only an admin or the teacher who added this material can remove it' });
    }

    await pool.query('UPDATE teaching_materials SET is_active = FALSE, updated_at = NOW() WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    console.error('[DELETE /materials/:id]', err);
    res.status(500).json({ error: 'Failed to remove material' });
  }
});

module.exports = router;
