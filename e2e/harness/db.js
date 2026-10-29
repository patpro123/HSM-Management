'use strict';

// Throwaway local Postgres for end-to-end evidence runs.
// Never reads backend-enroll/.env, so it can never reach the Neon database.

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');

const ROOT = path.resolve(__dirname, '..', '..');
const DATA_DIR = path.resolve(__dirname, '..', '.pgdata');
const PORT = 54329;
const USER = 'hsm_e2e';
const PASSWORD = 'hsm_e2e';
const DB_NAME = 'hsm_e2e';

const DATABASE_URL = `postgresql://${USER}:${PASSWORD}@127.0.0.1:${PORT}/${DB_NAME}`;

let server = null;

async function startDb({ fresh = true } = {}) {
  const { default: EmbeddedPostgres } = await import('embedded-postgres');
  if (fresh) fs.rmSync(DATA_DIR, { recursive: true, force: true });
  const needsInit = !fs.existsSync(path.join(DATA_DIR, 'PG_VERSION'));

  server = new EmbeddedPostgres({
    databaseDir: DATA_DIR, user: USER, password: PASSWORD, port: PORT, persistent: true,
    initdbFlags: ['--encoding=UTF8', '--locale=C'],
    onLog: () => {}, onError: (e) => { if (process.env.E2E_VERBOSE) console.error('[pg]', String(e)); },
  });
  if (needsInit) await server.initialise();
  await server.start();
  if (needsInit) await server.createDatabase(DB_NAME);
  return DATABASE_URL;
}

async function stopDb() {
  if (server) { await server.stop(); server = null; }
}

// Applies db/schema.sql, then every numbered migration after 004 in order.
// Returns { applied, failed } so a run can show exactly what did not load.
async function buildSchema() {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  const applied = [];
  const failed = [];

  const run = async (label, file) => {
    try {
      await client.query(fs.readFileSync(file, 'utf8'));
      applied.push(label);
    } catch (err) {
      failed.push({ label, error: err.message });
      await client.query('ROLLBACK').catch(() => {});
    }
  };

  // schema.sql references file_storage before migration 039 creates it, so a fresh build
  // needs that table first. Only 039's own CREATE TABLE/INDEX block is used here.
  const m039 = fs.readFileSync(path.join(ROOT, 'db', 'migrations', '039_file_storage.sql'), 'utf8');
  await client.query(m039.slice(0, m039.indexOf('-- homework_submissions')));

  await run('schema.sql', path.join(ROOT, 'db', 'schema.sql'));
  const migDir = path.join(ROOT, 'db', 'migrations');
  const migrations = fs.readdirSync(migDir)
    .filter(f => /^\d{3}_.*\.sql$/.test(f))
    .filter(f => parseInt(f.slice(0, 3), 10) >= 5)
    .sort();
  for (const f of migrations) await run(f, path.join(migDir, f));

  await client.end();
  return { applied, failed };
}

async function query(sql, params) {
  const client = new Client({ connectionString: DATABASE_URL });
  await client.connect();
  try { return await client.query(sql, params); } finally { await client.end(); }
}

module.exports = { startDb, stopDb, buildSchema, query, DATABASE_URL, PORT };

if (require.main === module) {
  (async () => {
    await startDb();
    const { applied, failed } = await buildSchema();
    console.log(`applied ${applied.length}, failed ${failed.length}`);
    for (const f of failed) console.log(`  FAIL ${f.label}: ${f.error}`);
    await stopDb();
  })().catch(async (e) => { console.error(e); await stopDb(); process.exit(1); });
}
