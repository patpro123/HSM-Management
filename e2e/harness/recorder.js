'use strict';

// Browser capture for one persona: records a video, takes numbered screenshots, and
// collects pass/fail checks so every claim in the evidence is asserted, not just shown.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const VIEWPORT = { width: 1280, height: 800 };

// A full ffmpeg build (VP8 + H.264). Playwright's own bundled build has no VP8 encoder,
// which its video recorder needs, so recording silently produces nothing with it.
function findFfmpeg() {
  if (process.env.E2E_FFMPEG) return process.env.E2E_FFMPEG;
  const packages = path.join(process.env.LOCALAPPDATA || '', 'Microsoft', 'WinGet', 'Packages');
  const walk = (dir, depth) => {
    if (depth < 0 || !fs.existsSync(dir)) return null;
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isFile() && e.name === 'ffmpeg.exe') return full;
      if (e.isDirectory()) { const hit = walk(full, depth - 1); if (hit) return hit; }
    }
    return null;
  };
  const fromWinget = fs.existsSync(packages)
    ? fs.readdirSync(packages).filter(d => /ffmpeg/i.test(d)).map(d => walk(path.join(packages, d), 3)).find(Boolean)
    : null;
  return fromWinget || 'ffmpeg';
}

// Playwright's video recorder looks for ffmpeg-<revision>/ffmpeg-win64.exe for its pinned
// revision. Point it at a private browsers folder that holds the ffmpeg found above under
// that name, so nothing in your Playwright cache is touched.
function prepareFfmpeg() {
  const source = findFfmpeg();
  if (!fs.existsSync(source)) return;
  const root = path.resolve(__dirname, '..', '.browsers');
  const manifest = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'node_modules', 'playwright-core', 'browsers.json'), 'utf8'));
  const rev = (manifest.browsers.find(b => b.name === 'ffmpeg') || {}).revision;
  if (!rev) return;
  const dest = path.join(root, `ffmpeg-${rev}`, 'ffmpeg-win64.exe');
  fs.mkdirSync(path.dirname(dest), { recursive: true });
  // A later session in the same run finds the copy in use by the previous browser; keep it.
  const sameFile = fs.existsSync(dest) && fs.statSync(dest).size === fs.statSync(source).size;
  if (!sameFile) fs.copyFileSync(source, dest);
  process.env.PLAYWRIGHT_BROWSERS_PATH = root;
}

// Uses a Chromium that is already installed (override with E2E_CHROMIUM) so the harness
// does not depend on the exact build the pinned Playwright version would download.
function findChromium() {
  if (process.env.E2E_CHROMIUM) return process.env.E2E_CHROMIUM;
  const base = path.join(process.env.LOCALAPPDATA || '', 'ms-playwright');
  const builds = fs.existsSync(base) ? fs.readdirSync(base).filter(d => /^chromium-\d+$/.test(d)).sort().reverse() : [];
  for (const b of builds) {
    const exe = path.join(base, b, 'chrome-win64', 'chrome.exe');
    if (fs.existsSync(exe)) return exe;
  }
  return undefined;
}

async function openSession({ outDir, name, api, app, profile, token }) {
  fs.mkdirSync(outDir, { recursive: true });
  const videoDir = path.join(outDir, `.video-${name}`);
  prepareFfmpeg();
  // Playwright reads PLAYWRIGHT_BROWSERS_PATH when it is first loaded, so require it only now.
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ executablePath: findChromium() });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    recordVideo: { dir: videoDir, size: VIEWPORT },
  });
  await context.addInitScript((t) => { try { localStorage.setItem('jwt_token', t); } catch { /* ignore */ } }, token);
  const page = await context.newPage();

  let shotNo = 0;
  const checks = [];

  const api_ = {
    page,
    checks,
    async open() {
      await page.goto(app, { waitUntil: 'domcontentloaded' });
      // The chat button only renders once the signed-in app has loaded.
      await page.getByLabel('Open chat').waitFor({ timeout: 45000 });
      await page.waitForTimeout(1200);
    },
    async shot(label) {
      shotNo += 1;
      const file = `${name}-${String(shotNo).padStart(2, '0')}-${label.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.png`;
      await page.screenshot({ path: path.join(outDir, file) });
      return file;
    },
    check(label, ok, detail) {
      checks.push({ label, ok: !!ok, detail: detail ?? '' });
      console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}${detail ? ` — ${detail}` : ''}`);
    },
    async openChat() {
      await page.getByLabel('Open chat').click();
      await page.getByPlaceholder('Type a message…').waitFor();
    },
    // Types into the chat, waits for the server's reply, returns the parsed JSON.
    async ask(text) {
      const reply = page.waitForResponse(r => r.url().endsWith('/api/chat') && r.request().method() === 'POST');
      await page.getByPlaceholder('Type a message…').fill(text);
      await page.getByLabel('Send').click();
      const res = await reply;
      const body = await res.json().catch(() => ({}));
      await page.waitForTimeout(900);
      return { status: res.status(), ...body };
    },
    // Calls the backend directly as this persona (the dev backend resolves identity from the
    // active profile, so this is the same user the browser is signed in as).
    async call(method, route, body, headers = {}) {
      const res = await fetch(`${api}${route}`, {
        method,
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}`, ...headers },
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      return { status: res.status, ...(await res.json().catch(() => ({}))) };
    },
    async close() {
      await context.close();
      await browser.close();
      const vids = fs.existsSync(videoDir) ? fs.readdirSync(videoDir).filter(f => f.endsWith('.webm')) : [];
      let mp4 = null;
      if (vids.length) {
        mp4 = `${name}.mp4`;
        execFileSync(findFfmpeg(), ['-y', '-loglevel', 'error', '-i', path.join(videoDir, vids[0]),
          '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path.join(outDir, mp4)]);
      }
      fs.rmSync(videoDir, { recursive: true, force: true });
      return { video: mp4, checks };
    },
  };
  return api_;
}

module.exports = { openSession };
