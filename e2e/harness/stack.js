'use strict';

// Starts the full local stack for an evidence run: throwaway Postgres, the backend (with
// every credential from backend-enroll/.env blanked), and the Vite frontend.

const fs = require('fs');
const path = require('path');
const http = require('http');
const { spawn, execSync } = require('child_process');
const db = require('./db');
const { seed } = require('./seed');

const ROOT = path.resolve(__dirname, '..', '..');
const BACKEND_PORT = 3101;
const FRONTEND_PORT = 5199;
const API = `http://localhost:${BACKEND_PORT}`;
const APP = `http://localhost:${FRONTEND_PORT}`;

const children = [];

function envKeysIn(file) {
  if (!fs.existsSync(file)) return [];
  return fs.readFileSync(file, 'utf8').split(/\r?\n/)
    .map(l => l.match(/^\s*([A-Z0-9_]+)\s*=/)?.[1]).filter(Boolean);
}

// dotenv never overrides a variable that already exists, so blanking every key the real
// .env defines guarantees the test backend cannot reach Neon, WhatsApp, SMTP, Drive or an LLM.
function backendEnv(llmLog) {
  const blank = {};
  for (const k of envKeysIn(path.join(ROOT, 'backend-enroll', '.env'))) blank[k] = '';
  return {
    ...process.env,
    ...blank,
    NODE_ENV: 'development',
    DISABLE_AUTH: 'true',
    DEV_PROFILE: 'admin',
    PORT: String(BACKEND_PORT),
    DATABASE_URL: db.DATABASE_URL,
    DRIVE_ENABLED: 'false',
    LLM_PROVIDER: 'groq',
    GOOGLE_CLIENT_ID: 'e2e-dummy',
    GOOGLE_CLIENT_SECRET: 'e2e-dummy',
    GOOGLE_CALLBACK_URL: `${API}/api/auth/google/callback`,
    FRONTEND_URL: APP,
    CORS_ORIGIN: APP,
    JWT_SECRET: 'e2e-only-secret',
    E2E_LLM_LOG: llmLog || '',
  };
}

function waitForHttp(url, label, timeoutMs = 60000) {
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const tick = () => {
      const req = http.get(url, (res) => { res.resume(); resolve(); });
      req.on('error', () => {
        if (Date.now() - start > timeoutMs) return reject(new Error(`${label} did not start within ${timeoutMs}ms`));
        setTimeout(tick, 500);
      });
    };
    tick();
  });
}

function launch(label, cmd, args, opts) {
  const child = spawn(cmd, args, { ...opts, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true });
  const logFile = path.join(opts.logDir, `${label}.log`);
  const out = fs.createWriteStream(logFile);
  child.stdout.pipe(out);
  child.stderr.pipe(out);
  children.push(child);
  return child;
}

async function startStack({ logDir, llmLog }) {
  fs.mkdirSync(logDir, { recursive: true });

  await db.startDb({ fresh: true });
  const { applied, failed } = await db.buildSchema();
  const seeded = await seed();

  launch('backend', process.execPath,
    ['-r', path.join(__dirname, 'mock-llm-preload.js'), 'index.js'],
    { cwd: path.join(ROOT, 'backend-enroll'), env: backendEnv(llmLog), logDir });
  await waitForHttp(`${API}/api/auth/config`, 'backend');

  launch('frontend', process.execPath,
    [path.join(ROOT, 'frontend-enroll', 'node_modules', 'vite', 'bin', 'vite.js'), '--port', String(FRONTEND_PORT), '--strictPort', '--host', 'localhost'],
    { cwd: path.join(ROOT, 'frontend-enroll'), env: { ...process.env, VITE_API_BASE_URL: API }, logDir });
  await waitForHttp(APP, 'frontend');

  return { api: API, app: APP, schema: { applied: applied.length, failed }, seeded };
}

async function stopStack() {
  for (const c of children.splice(0)) {
    try { execSync(`taskkill /pid ${c.pid} /T /F`, { stdio: 'ignore' }); } catch { /* already gone */ }
  }
  await db.stopDb().catch(() => {});
}

module.exports = { startStack, stopStack, API, APP };
