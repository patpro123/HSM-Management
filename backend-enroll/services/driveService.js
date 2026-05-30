'use strict';

const { google } = require('googleapis');
const { Readable } = require('stream');
const pool = require('../db');

// ── Auth ──────────────────────────────────────────────────────────────────────
// Preferred: OAuth2 refresh token (GOOGLE_DRIVE_REFRESH_TOKEN) — works with
// personal Google Drive, files stored under the account owner's quota.
//
// Fallback: Service Account JWT — only works with Google Workspace Shared Drives.

let _authClient = null;

function getAuthClient() {
  if (_authClient) return _authClient;

  if (process.env.GOOGLE_DRIVE_REFRESH_TOKEN) {
    // OAuth2 path — uses the Drive owner's account quota
    const oauth2 = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2.setCredentials({ refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN });
    _authClient = oauth2;
    return _authClient;
  }

  // Service Account path — requires Google Workspace Shared Drives
  const raw =
    process.env.GOOGLE_SERVICE_ACCOUNT_JSON_B64
      ? Buffer.from(process.env.GOOGLE_SERVICE_ACCOUNT_JSON_B64, 'base64').toString('utf8')
      : process.env.GOOGLE_SERVICE_ACCOUNT_JSON;

  if (!raw) {
    throw new Error(
      'Google Drive auth not configured. ' +
      'Set GOOGLE_DRIVE_REFRESH_TOKEN (recommended) or GOOGLE_SERVICE_ACCOUNT_JSON_B64.'
    );
  }

  const key = JSON.parse(raw);
  _authClient = new google.auth.JWT({
    email:  key.client_email,
    key:    key.private_key,
    scopes: ['https://www.googleapis.com/auth/drive'],
  });
  return _authClient;
}

function getDriveClient() {
  return google.drive({ version: 'v3', auth: getAuthClient() });
}

// ── Filename builder ──────────────────────────────────────────────────────────

function _safePart(str) {
  return (str || '').trim()
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/**
 * Builds a human-readable Drive filename.
 *
 * @param {object} opts
 * @param {string}      opts.studentName   - e.g. "Ramesh Kumar"
 * @param {string|null} opts.instrument    - e.g. "Guitar" (optional)
 * @param {string}      opts.originalName  - original file name (for extension)
 * @param {Date}        [opts.date]        - defaults to now
 * @returns {string}  e.g. "Ramesh_Kumar_Guitar_2026-05-29.webm"
 */
function buildDriveFileName({ studentName, instrument, originalName, date }) {
  const d       = date || new Date();
  const dateStr = d.toISOString().slice(0, 10);                          // YYYY-MM-DD
  const timeStr = d.toISOString().slice(11, 19).replace(/:/g, '');       // HHMMSS
  const ext     = (originalName || 'file').split('.').pop().toLowerCase() || 'bin';
  const parts   = [
    _safePart(studentName),
    instrument ? _safePart(instrument) : null,
    `${dateStr}_${timeStr}`,
  ].filter(Boolean);
  return `${parts.join('_')}.${ext}`;
}

// ── Category configuration ────────────────────────────────────────────────────

const CATEGORY_CONFIG = {
  homework_audio: {
    folderId:      () => process.env.DRIVE_FOLDER_HOMEWORK_AUDIO,
    retentionDays: () => parseInt(process.env.DRIVE_RETENTION_HOMEWORK_AUDIO    ?? '90',  10),
  },
  student_document: {
    folderId:      () => process.env.DRIVE_FOLDER_STUDENT_DOCUMENTS,
    retentionDays: () => parseInt(process.env.DRIVE_RETENTION_STUDENT_DOCUMENTS ?? '90',  10),
  },
  profile_image: {
    folderId:      () => process.env.DRIVE_FOLDER_PROFILE_IMAGES,
    retentionDays: () => parseInt(process.env.DRIVE_RETENTION_PROFILE_IMAGES    ?? '0',   10), // permanent
  },
  trinity_recording: {
    folderId:      () => process.env.DRIVE_FOLDER_TRINITY_RECORDINGS,
    retentionDays: () => parseInt(process.env.DRIVE_RETENTION_TRINITY_RECORDINGS ?? '365', 10),
  },
  marketing: {
    folderId:      () => process.env.DRIVE_FOLDER_MARKETING,
    retentionDays: () => parseInt(process.env.DRIVE_RETENTION_MARKETING         ?? '0',   10), // permanent
  },
};

/**
 * @param {string} category
 * @returns {{ folderId: string, retentionDays: number }}
 */
function getCategoryConfig(category) {
  const cfg = CATEGORY_CONFIG[category];
  if (!cfg) {
    throw new Error(
      `Unknown file category: "${category}". Valid: ${Object.keys(CATEGORY_CONFIG).join(', ')}`
    );
  }
  const folderId = cfg.folderId();
  if (!folderId) {
    throw new Error(
      `Drive folder not configured for category "${category}". ` +
      `Set DRIVE_FOLDER_${category.toUpperCase().replace(/-/g, '_')}.`
    );
  }
  return { folderId, retentionDays: cfg.retentionDays() };
}

// ── Core operations ───────────────────────────────────────────────────────────

/**
 * Uploads a file buffer to Google Drive, sets it publicly readable,
 * inserts a file_storage tracking row, and returns the metadata.
 *
 * @param {object} params
 * @param {Buffer}      params.buffer     - file contents
 * @param {string}      params.fileName   - stored file name on Drive
 * @param {string}      params.mimeType   - MIME type, e.g. 'audio/webm'
 * @param {string}      params.category   - key from CATEGORY_CONFIG
 * @param {string}      params.entityType - e.g. 'homework_submission', 'student'
 * @param {string|null} params.entityId   - UUID of the owning entity (may be null initially)
 * @returns {Promise<{ fileStorageId: string, publicUrl: string, driveFileId: string }>}
 */
async function upload({ buffer, fileName, mimeType, category, entityType, entityId }) {
  const { folderId, retentionDays } = getCategoryConfig(category);
  const drive = getDriveClient();

  // 1. Upload file to Drive folder
  const uploadRes = await drive.files.create({
    requestBody: {
      name:    fileName,
      parents: [folderId],
    },
    media: {
      mimeType,
      body: Readable.from(buffer),
    },
    fields: 'id',
  });
  const driveFileId = uploadRes.data.id;

  // 2. Make the file publicly readable (anyone with the link)
  await drive.permissions.create({
    fileId:      driveFileId,
    requestBody: { role: 'reader', type: 'anyone' },
  });

  // 3. Build direct-download URL (works in <audio src> and <a href> without redirect)
  const publicUrl = `https://drive.google.com/uc?export=download&id=${driveFileId}`;

  // 4. Calculate expiry
  let expiresAt = null;
  if (retentionDays > 0) {
    expiresAt = new Date(Date.now() + retentionDays * 86400 * 1000);
  }

  // 5. Insert tracking row
  const result = await pool.query(
    `INSERT INTO file_storage
       (drive_file_id, public_url, category, entity_type, entity_id,
        file_name, mime_type, file_size_bytes, expires_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id`,
    [
      driveFileId, publicUrl, category, entityType, entityId || null,
      fileName, mimeType, buffer.length, expiresAt,
    ]
  );

  const fileStorageId = result.rows[0].id;
  console.log(`[driveService] Uploaded "${fileName}" (${category}) → Drive ${driveFileId}`);
  return { fileStorageId, publicUrl, driveFileId };
}

/**
 * Updates entity_id on a file_storage row after the owning entity has been inserted.
 *
 * @param {string} fileStorageId - UUID of the file_storage row
 * @param {string} entityId      - UUID of the entity that owns this file
 */
async function setEntityId(fileStorageId, entityId) {
  await pool.query(
    'UPDATE file_storage SET entity_id = $1 WHERE id = $2',
    [entityId, fileStorageId]
  );
}

/**
 * Deletes a file from Google Drive. 404 is treated as non-fatal (already gone).
 *
 * @param {string} driveFileId
 */
async function deleteFile(driveFileId) {
  const drive = getDriveClient();
  try {
    await drive.files.delete({ fileId: driveFileId });
    console.log(`[driveService] Deleted Drive file ${driveFileId}`);
  } catch (err) {
    if (err.code === 404 || err.status === 404) {
      console.warn(`[driveService] File ${driveFileId} already absent from Drive`);
    } else {
      throw err;
    }
  }
}

/**
 * Finds all expired file_storage rows, deletes them from Drive,
 * and marks deleted_at in the DB. Safe to call repeatedly.
 *
 * @returns {Promise<{ processed: number, errors: number }>}
 */
async function cleanupExpired() {
  const { rows } = await pool.query(
    `SELECT id, drive_file_id, file_name
     FROM file_storage
     WHERE expires_at IS NOT NULL
       AND expires_at <= NOW()
       AND deleted_at IS NULL
     ORDER BY expires_at ASC`
  );

  let processed = 0;
  let errors    = 0;

  for (const row of rows) {
    try {
      await deleteFile(row.drive_file_id);
      await pool.query(
        'UPDATE file_storage SET deleted_at = NOW() WHERE id = $1',
        [row.id]
      );
      processed++;
    } catch (err) {
      console.error(`[driveService] Failed to delete ${row.id} (${row.file_name}):`, err.message);
      errors++;
    }
  }

  console.log(`[driveService] cleanupExpired: processed=${processed}, errors=${errors}`);
  return { processed, errors };
}

/**
 * Returns a list of valid category names for input validation.
 * @returns {string[]}
 */
function validCategories() {
  return Object.keys(CATEGORY_CONFIG);
}

module.exports = { upload, setEntityId, deleteFile, cleanupExpired, validCategories, getDriveClient, buildDriveFileName };
