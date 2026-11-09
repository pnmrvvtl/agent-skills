#!/usr/bin/env node
// Validate the collection without installing packages or executing skill payloads.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const skillsRoot = path.join(root, 'skills');
const folders = fs.readdirSync(skillsRoot, { withFileTypes: true }).filter((entry) => entry.isDirectory());
const names = new Set(folders.map((entry) => entry.name));
const errors = [];
let checked = 0;

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (['.git', 'node_modules', '.test-output'].includes(entry.name)) return [];
    const full = path.join(dir, entry.name);
    if (entry.isSymbolicLink()) {
      errors.push(`${path.relative(root, full)}: symlinks are not distributable payloads`);
      return [];
    }
    return entry.isDirectory() ? walk(full) : [full];
  });
}

for (const { name } of folders) {
  const entrypoint = path.join(skillsRoot, name, 'SKILL.md');
  if (!fs.existsSync(entrypoint)) {
    errors.push(`${name}: missing SKILL.md`);
    continue;
  }
  const content = fs.readFileSync(entrypoint, 'utf8');
  const header = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(content)?.[1];
  if (!header || !new RegExp(`^name: ${name}$`, 'm').test(header.replaceAll('\r', ''))) {
    errors.push(`${name}: frontmatter name must match directory`);
  }
  if (!header || !/^description: .+/m.test(header)) errors.push(`${name}: missing description`);
  if (!/^[a-z0-9-]{1,64}$/.test(name)) errors.push(`${name}: invalid skill name`);
}

for (const file of walk(root)) {
  const relative = path.relative(root, file);
  if (/^\.env(?:\.|$)/.test(path.basename(file)) && path.basename(file) !== '.env.example') {
    errors.push(`${relative}: environment files must not be distributed`);
    continue;
  }
  if (!/\.(md|yaml|json|mjs|ps1|sh)$/.test(file) && path.basename(file) !== 'Dockerfile') continue;
  checked += 1;
  const content = fs.readFileSync(file, 'utf8');
  if (/[A-Z]:[\\/](?:Projects|Users|AI|models)[\\/]|\/(?:Users|home)\/(?!node(?:[\/\s'"`]|$))[^<\s/]+\//i.test(content)) {
    errors.push(`${relative}: replace machine-specific paths with placeholders`);
  }
  if (/-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----|\b(?:ghp_|github_pat_|sk-proj-)[A-Za-z0-9_]{20,}/.test(content)) {
    errors.push(`${relative}: possible credential`);
  }
  if (content.includes('\uFFFD')) errors.push(`${relative}: invalid Unicode replacement character`);
  if (file.endsWith('.json')) {
    try { JSON.parse(content); } catch { errors.push(`${relative}: invalid JSON`); }
  }
  if (!relative.startsWith(`skills${path.sep}`)) continue;
  for (const match of content.matchAll(/\bpnmrvvtl-[a-z0-9-]+/g)) {
    if (!names.has(match[0])) errors.push(`${relative}: unavailable skill ${match[0]}`);
  }
  if (!file.endsWith('.md')) continue;
  for (const match of content.matchAll(/\[[^\]]*\]\(((?:references|assets|scripts)\/[^)\s]+)\)/g)) {
    const target = match[1].split('#')[0];
    if (!fs.existsSync(path.resolve(path.dirname(file), target))) errors.push(`${relative}: missing linked file ${target}`);
  }
}

if (errors.length) {
  console.error([...new Set(errors)].join('\n'));
  process.exitCode = 1;
} else {
  console.log(`Validated ${names.size} skills and ${checked} text files; no structural or path/credential-pattern findings.`);
  console.log('Manually review examples for identifying names before publishing.');
}
