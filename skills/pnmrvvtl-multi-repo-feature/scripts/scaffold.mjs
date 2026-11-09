#!/usr/bin/env node
// Create the knowledge-base skeleton for a multi-repo feature from assets/templates/.
//
//   node scaffold.mjs <target-dir> [--feature <name>] [--branch <name>]
//                     [--main-repo <path>] [--library <path>] [--host <path>] [--force]
//
// Idempotent: existing files are left untouched unless --force. Prints CREATE/SKIP per file.
// Zero dependencies; Windows + POSIX.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const templatesDir = path.join(here, '..', 'assets', 'templates');

const argv = process.argv.slice(2);
const target = argv.find((a) => !a.startsWith('--'));
if (!target) {
  console.error('usage: scaffold.mjs <target-dir> [--feature <name>] [--branch <name>] [--main-repo <p>] [--library <p>] [--host <p>] [--force]');
  process.exit(2);
}
const opt = (name, fallback) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : fallback;
};
const force = argv.includes('--force');
const tokens = {
  FEATURE: opt('feature', path.basename(target)),
  BRANCH: opt('branch', 'feat/<feature>'),
  MAIN_REPO: opt('main-repo', '<main-repo-path>'),
  LIBRARY: opt('library', '<library-path>'),
  HOST: opt('host', '<host-path>'),
  DATE: new Date().toISOString().slice(0, 10),
};

if (!fs.existsSync(templatesDir)) {
  console.error(`no templates at ${templatesDir}`);
  process.exit(2);
}

const fill = (s) => s.replace(/\{\{(\w+)\}\}/g, (_, k) => (k in tokens ? tokens[k] : `{{${k}}}`));
fs.mkdirSync(target, { recursive: true });
for (const sub of ['phases', 'prompts', 'baselines']) fs.mkdirSync(path.join(target, sub), { recursive: true });

for (const name of fs.readdirSync(templatesDir)) {
  const src = path.join(templatesDir, name);
  if (!fs.statSync(src).isFile()) continue;
  const dest = path.join(target, name);
  if (fs.existsSync(dest) && !force) {
    console.log(`SKIP   ${name}`);
    continue;
  }
  fs.writeFileSync(dest, fill(fs.readFileSync(src, 'utf8')));
  console.log(`CREATE ${name}`);
}
console.log(`scaffolded ${tokens.FEATURE} in ${path.resolve(target)}`);
