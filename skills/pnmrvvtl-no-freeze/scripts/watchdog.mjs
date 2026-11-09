#!/usr/bin/env node
// Run any agent CLI (codex, grok, claude -p, opencode, pi, a build...) so it can never hang the caller.
//
//   node watchdog.mjs [--timeout 90m] [--idle 20m] [--done-file <path>] [--log <path>] -- <command> [args...]
//
// - stdin is closed (EOF at once): agent CLIs block forever waiting on a non-TTY stdin (codex exec #20919).
// - --timeout: hard wall-clock limit.            → kill whole process tree, exit 124, "TIMEOUT"
// - --idle:    no output for this long.          → kill, exit 124, "STALLED"
// - --done-file: the agent's final report file (e.g. codex -o). Present + process still alive after 60 s grace
//              → the agent finished but hung on exit: kill, exit 0, "HUNG-AFTER-DONE".
// - Output goes to --log (appended) or stdout. Last line is always one status line starting with "watchdog:".
// Durations: 90s, 20m, 2h. Zero dependencies; Windows + POSIX.
import fs from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';

const argv = process.argv.slice(2);
const sep = argv.indexOf('--');
if (sep < 0 || sep === argv.length - 1) {
  console.error('usage: watchdog.mjs [--timeout 90m] [--idle 20m] [--done-file f] [--log f] -- <command> [args...]');
  process.exit(2);
}
const opts = argv.slice(0, sep);
const [cmd, ...args] = argv.slice(sep + 1);
const opt = (name, fallback) => { const i = opts.indexOf(`--${name}`); return i >= 0 ? opts[i + 1] : fallback; };
const ms = (v) => { const m = /^(\d+)(s|m|h)$/.exec(v); if (!m) throw new Error(`bad duration ${v}`); return Number(m[1]) * { s: 1e3, m: 6e4, h: 36e5 }[m[2]]; };

const timeout = ms(opt('timeout', '90m'));
const idle = ms(opt('idle', '20m'));
const doneFile = opt('done-file');
const log = opt('log') ? fs.createWriteStream(opt('log'), { flags: 'a' }) : process.stdout;

const win = process.platform === 'win32';
const child = spawn(cmd, args, {
  stdio: ['ignore', 'pipe', 'pipe'],
  shell: win && /\.(cmd|bat)$/i.test(cmd), // .cmd shims need a shell on Windows
  detached: !win, // own process group on POSIX so the whole tree can be killed
});
const started = Date.now();
let lastOutput = Date.now();
let doneSeenAt = 0;
let verdict = null;

for (const stream of [child.stdout, child.stderr]) {
  stream.on('data', (chunk) => { lastOutput = Date.now(); log.write(chunk); });
}

function killTree(reason, code) {
  verdict ??= { reason, code };
  if (win) spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
  else { try { process.kill(-child.pid, 'SIGKILL'); } catch { /* already gone */ } }
}

const tick = setInterval(() => {
  const now = Date.now();
  if (now - started > timeout) return killTree('TIMEOUT', 124);
  if (now - lastOutput > idle) return killTree('STALLED', 124);
  if (doneFile && fs.existsSync(doneFile) && fs.statSync(doneFile).size > 0) {
    doneSeenAt ||= now;
    if (now - doneSeenAt > 60_000) killTree('HUNG-AFTER-DONE', 0);
  }
}, 5_000);

child.on('exit', (code, signal) => {
  clearInterval(tick);
  const secs = Math.round((Date.now() - started) / 1000);
  const final = verdict ?? { reason: `EXIT ${code ?? signal}`, code: code ?? 1 };
  const line = `watchdog: ${final.reason} after ${secs}s — ${cmd}\n`;
  log.write(line);
  if (log !== process.stdout) process.stdout.write(line);
  process.exitCode = final.code;
});
