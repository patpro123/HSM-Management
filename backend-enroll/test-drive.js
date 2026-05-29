/**
 * Standalone test for driveService — run before setting DRIVE_ENABLED=true.
 *
 * Prerequisites:
 *   1. GOOGLE_SERVICE_ACCOUNT_JSON_B64 (or GOOGLE_SERVICE_ACCOUNT_JSON) set in .env
 *   2. DRIVE_FOLDER_MARKETING set in .env (used for the test upload — permanent category)
 *   3. Backend DB accessible (used to INSERT/SELECT file_storage rows)
 *
 * Run: node test-drive.js
 */
require('dotenv').config();

const { upload, deleteFile, cleanupExpired, validCategories } = require('./services/driveService');

async function main() {
  console.log('Valid categories:', validCategories());

  // 1. Upload a small test file
  console.log('\n--- Upload test ---');
  const buffer = Buffer.from('HSM Drive integration test file', 'utf8');
  const result = await upload({
    buffer,
    fileName:   `hsm_test_${Date.now()}.txt`,
    mimeType:   'text/plain',
    category:   'marketing',   // permanent — won't be auto-deleted
    entityType: 'test',
    entityId:   null,
  });
  console.log('fileStorageId:', result.fileStorageId);
  console.log('driveFileId:  ', result.driveFileId);
  console.log('publicUrl:    ', result.publicUrl);
  console.log('Open the URL above in a browser — it should download the test file.');

  // 2. Cleanup dry run (nothing expired yet)
  console.log('\n--- Cleanup dry run ---');
  const cleanup = await cleanupExpired();
  console.log('cleanup result:', cleanup);  // expect { processed: 0, errors: 0 }

  // 3. Delete the test file we just uploaded
  console.log('\n--- Delete test file from Drive ---');
  await deleteFile(result.driveFileId);
  console.log('Done. Test file removed from Drive.');

  process.exit(0);
}

main().catch((err) => {
  console.error('test-drive.js failed:', err.message);
  process.exit(1);
});
