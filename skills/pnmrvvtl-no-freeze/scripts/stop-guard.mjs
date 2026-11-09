#!/usr/bin/env node
// "Don't stop while work remains" guard. Two modes, one contract file: <project>/.no-freeze.json
//   { "active": true, "doneCheck": "<shell command, exit 0 = all work done>", "maxBlocks": 20 }
//
// 1. Claude Code Stop hook (settings.json → hooks.Stop → command: node <this file>):
//    reads the hook JSON on stdin; while active and doneCheck fails it answers
//    {"decision":"block","reason":...} so the agent cannot end its turn and idle.
// 2. Any other CLI (codex, grok, opencode, pi...): `node stop-guard.mjs --check [dir]`
//    exits 0 when done/inactive, 1 while work remains — drive an outer loop:
//    until node stop-guard.mjs --check; do <agent-cli resume/continue>; done
//
// Safety valve: after maxBlocks consecutive blocks without the doneCheck passing, the stop is allowed
// (prevents an infinite loop on a genuinely stuck task). Counter lives in .no-freeze.state.
// To stand down on purpose: set "active": false (and say why to the user).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const checkMode = process.argv[2] === '--check';
let hook = {};
if (!checkMode) {
  try { hook = JSON.parse(fs.readFileSync(0, 'utf8') || '{}'); } catch { hook = {}; }
}
const dir = (checkMode ? process.argv[3] : hook.cwd) || process.cwd();
const contractFile = path.join(dir, '.no-freeze.json');
const stateFile = path.join(dir, '.no-freeze.state');

const allow = (msg) => { if (msg) console.error(`no-freeze: ${msg}`); process.exit(0); };
if (!fs.existsSync(contractFile)) allow();
const contract = JSON.parse(fs.readFileSync(contractFile, 'utf8'));
if (!contract.active) allow();

const res = spawnSync(contract.doneCheck, { cwd: dir, shell: true, encoding: 'utf8', timeout: 120_000 });
if (res.status === 0) {
  fs.rmSync(stateFile, { force: true });
  allow('doneCheck passed — work complete');
}
const why = `${res.stdout ?? ''}${res.stderr ?? ''}`.trim().split('\n').slice(-5).join(' | ') || `exit ${res.status}`;

if (checkMode) {
  console.log(`work remains: ${why}`);
  process.exit(1);
}

const blocks = (fs.existsSync(stateFile) ? Number(fs.readFileSync(stateFile, 'utf8')) || 0 : 0) + 1;
fs.writeFileSync(stateFile, String(blocks));
if (blocks > (contract.maxBlocks ?? 20)) allow(`gave up after ${blocks - 1} blocks without progress: ${why}`);

console.log(JSON.stringify({
  decision: 'block',
  reason: `Work is not finished (${why}). Do not end the turn. Now: 1) check every running job — kill any whose `
    + 'final report exists while its process is alive, or whose log stopped growing; 2) start the next step; '
    + '3) if you must wait, arm a heartbeat (background `sleep 1800`) before ending. If genuinely blocked, set '
    + `"active": false in .no-freeze.json and tell the user why. (block ${blocks}/${contract.maxBlocks ?? 20})`,
}));
