#!/usr/bin/env node
// Scan a repository for the mechanical gate-gaming patterns that were caught in practice.
//
//   node scan-gate-gaming.mjs <repo-root> [--allow <path-substring>]... [--allowlist rules.json]
//
// Exit 0 = clean, 1 = findings, 2 = usage error. Prints one line per finding:
//   <path>:<line>  <rule>  <snippet>
//
// This is a floor, not a substitute for reviewing the diff. Non-mechanical games (a compensating
// offset that looks like a real value, a spec that "happens" to align) still need the orchestrator's
// eye. Zero dependencies; Windows + POSIX.
import fs from 'node:fs';
import path from 'node:path';

const argv = process.argv.slice(2);
const root = argv.find((a) => !a.startsWith('--'));
if (!root) {
  console.error('usage: scan-gate-gaming.mjs <repo-root> [--allow <path-substring>]... [--allowlist rules.json]');
  process.exit(2);
}
const listArg = (name) => {
  const out = [];
  for (let i = 0; i < argv.length; i++) if (argv[i] === `--${name}` && argv[i + 1]) out.push(argv[i + 1]);
  return out;
};
const allows = listArg('allow');
const allowlistFile = listArg('allowlist')[0];
let disabled = new Set();
if (allowlistFile && fs.existsSync(allowlistFile)) {
  const cfg = JSON.parse(fs.readFileSync(allowlistFile, 'utf8'));
  for (const p of cfg.paths ?? []) allows.push(p);
  disabled = new Set(cfg.disabledRules ?? []);
}

const SKIP_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', 'coverage', '.next', 'test-results',
  'playwright-report', 'agent-scratch', 'scratchpad', '.turbo', 'out', '.cache',
]);
const EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs', '.mts', '.cts', '.scss', '.css']);

const isAllowed = (rel) => allows.some((a) => rel.includes(a.replaceAll('\\', '/')));
const isSpec = (rel) => /\.(spec|test)\.[cm]?[jt]sx?$/.test(rel);
const isIcon = (rel) => /icon/i.test(rel);

const RULES = [
  { id: 'bare-snapshot', exts: 'code', spec: true, re: /(?<!expectFigma)toHaveScreenshot\s*\(/,
    why: 'use the project visual wrapper, not a bare snapshot' },
  { id: 'mask', exts: 'code', spec: true, re: /\bmask\s*:/,
    why: 'masks hide the region being measured; use a declared overlay/allowlist' },
  { id: 'raised-tolerance', exts: 'code',
    re: /maxDiffPixelRatio\s*:\s*(0?\.\d+|[1-9]\d*)/,
    check: (line, prev, next, m) => Number(m[1]) > RULES_CEILING,
    why: 'tolerance above the agreed ceiling' },
  { id: 'reasonless-skip', exts: 'code', spec: true,
    re: /\btest\.(skip|fixme)\s*\(/,
    check: (line, prev, next) => {
      const rest = line.replace(/\btest\.(skip|fixme)\s*\(/, '');
      const quoted = /['"`]/.test(rest) || /['"`]/.test(next);
      const commented = /^\s*(\/\/|\*|\/\*)/.test(prev);
      return !quoted && !commented;
    },
    why: 'test.skip/fixme with no quoted reason on the call or a comment above' },
  { id: 'test-only', exts: 'code', spec: true, re: /\btest\.only\s*\(/,
    why: 'test.only silences the rest of the suite' },
  { id: 'ts-suppression', exts: 'code', re: /@ts-(ignore|expect-error|nocheck)/,
    why: 'suppressing the type checker instead of fixing the type' },
  { id: 'any-cast', exts: 'code', re: /\bas\s+any\b|:\s*any\b|<any>|\bas\s+unknown\s+as\b/,
    why: 'any / double cast to silence types' },
  { id: 'eslint-disable', exts: 'code', re: /eslint-disable(-next-line|-line)?\b/,
    why: 'suppression instead of a fix' },
  { id: 'layout-mutation', exts: 'code', spec: true, re: /(\.style\.|setProperty\s*\(|style\.setAttribute)/,
    why: 'a spec must never move product layout' },
  { id: 'hand-drawn-icon', exts: 'code', icon: true,
    re: /<path\b/,
    check: (line, _prev, _next, _m, fileText) => !/figma:/i.test(fileText) && !/figma\//i.test(fileText),
    why: 'icon path with no figma:<nodeId> citation — take the export verbatim' },
];
const RULES_CEILING = (JSON.parse(
  allowlistFile && fs.existsSync(allowlistFile) ? fs.readFileSync(allowlistFile, 'utf8') : '{}',
).ceiling) ?? 0.01;

const findings = [];
function scanFile(abs) {
  const rel = path.relative(root, abs).replaceAll('\\', '/');
  if (isAllowed(rel)) return;
  const text = fs.readFileSync(abs, 'utf8');
  const lines = text.split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const rule of RULES) {
      if (disabled.has(rule.id)) continue;
      if (rule.spec && !isSpec(rel)) continue;
      if (rule.icon && !isIcon(rel)) continue;
      const m = rule.re.exec(line);
      if (!m) continue;
      if (rule.check && !rule.check(line, lines[i - 1] ?? '', lines[i + 1] ?? '', m, text)) continue;
      findings.push({ rel, line: i + 1, rule: rule.id, why: rule.why, text: line.trim().slice(0, 120) });
    }
  }
}
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      walk(path.join(dir, entry.name));
    } else if (EXTS.has(path.extname(entry.name))) {
      scanFile(path.join(dir, entry.name));
    }
  }
}

walk(path.resolve(root));
for (const f of findings) console.log(`${f.rel}:${f.line}  ${f.rule}  ${f.text}\n    -> ${f.why}`);
console.log(`scan-gate-gaming: ${findings.length} finding(s) in ${root}`);
process.exit(findings.length ? 1 : 0);
