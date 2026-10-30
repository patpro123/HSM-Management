'use strict';

// Usage: node harness/run.js <scenario-name-prefix>   e.g.  node harness/run.js 01
//
// Boots the isolated stack, runs the scenario in a recorded browser per persona, and
// writes everything to e2e/evidence/<scenario>-<timestamp>/ :
//   screenshots (*.png), one video per persona (*.mp4), summary.md, llm-calls.jsonl, logs/

const fs = require('fs');
const path = require('path');
const { startStack, stopStack, API } = require('./stack');
const { openSession } = require('./recorder');

const SCENARIO_DIR = path.resolve(__dirname, '..', 'scenarios');
const EVIDENCE_DIR = path.resolve(__dirname, '..', 'evidence');

async function main() {
  const wanted = process.argv[2] || '';
  const file = fs.readdirSync(SCENARIO_DIR).find(f => f.startsWith(wanted) && f.endsWith('.js'));
  if (!file) throw new Error(`No scenario matching "${wanted}" in ${SCENARIO_DIR}`);
  const scenario = require(path.join(SCENARIO_DIR, file));

  const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const outDir = path.join(EVIDENCE_DIR, `${scenario.name}-${stamp}`);
  fs.mkdirSync(outDir, { recursive: true });
  const llmLog = path.join(outDir, 'llm-calls.jsonl');

  console.log(`\n${scenario.title}\nEvidence: ${outDir}\n`);
  let stack;
  try {
    stack = await startStack({ logDir: path.join(outDir, 'logs'), llmLog });
    console.log(`Stack up. Schema: ${stack.schema.applied} files applied, ${stack.schema.failed.length} skipped.\n`);

    // The dev backend holds one active profile, so personas run one after another.
    // `label` names the video and screenshots when one persona has more than one session.
    const session = async (profile, label) => {
      await fetch(`${API}/api/dev/switch-profile`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ profile }),
      }).then(r => { if (!r.ok) throw new Error(`switch-profile ${profile} failed: ${r.status}`); });
      const { token } = await (await fetch(`${API}/api/auth/dev-login`, { method: 'POST' })).json();
      console.log(`\n[${profile}]`);
      return openSession({ outDir, name: label || profile, api: API, app: stack.app, profile, token });
    };

    const { results, extra, evidence } = await scenario.run({ session, outDir, llmLog, seeded: stack.seeded });

    const lines = [`# ${scenario.title}`, '', `Run: ${stamp}`, '', '## Checks', ''];
    let failed = 0;
    for (const r of results) {
      for (const c of r.checks) { lines.push(`- ${c.ok ? 'PASS' : 'FAIL'}: ${c.label}${c.detail ? ` (${c.detail})` : ''}`); if (!c.ok) failed += 1; }
    }
    for (const [label, ok] of extra || []) { lines.push(`- ${ok ? 'PASS' : 'FAIL'}: ${label}`); if (!ok) failed += 1; }
    lines.push('', '## What the database and model log show', '', ...(evidence || []).map(e => `    ${e}`));
    lines.push('', '## Files', '', ...fs.readdirSync(outDir).filter(f => /\.(png|mp4)$/.test(f)).map(f => `- ${f}`));
    lines.push('', `Schema files skipped on the throwaway database: ${stack.schema.failed.map(f => f.label).join(', ') || 'none'}`);
    fs.writeFileSync(path.join(outDir, 'summary.md'), lines.join('\n') + '\n');

    console.log(`\n${failed === 0 ? 'ALL CHECKS PASSED' : `${failed} CHECK(S) FAILED`}\nSummary: ${path.join(outDir, 'summary.md')}`);
    process.exitCode = failed === 0 ? 0 : 1;
  } finally {
    await stopStack();
  }
}

main().catch(async (e) => { console.error(e); await stopStack(); process.exit(1); });
