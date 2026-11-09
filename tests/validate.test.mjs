import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

function fixture(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'agent-skills-validation-'));
  t.after(() => {
    assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('agent-skills-validation-'));
    fs.rmSync(root, { recursive: true, force: true });
  });
  fs.mkdirSync(path.join(root, 'scripts'));
  fs.copyFileSync(path.join(repo, 'scripts/validate.mjs'), path.join(root, 'scripts/validate.mjs'));
  const skill = path.join(root, 'skills', 'pnmrvvtl-example');
  fs.mkdirSync(skill, { recursive: true });
  const entrypoint = path.join(skill, 'SKILL.md');
  const content = '---\nname: pnmrvvtl-example\ndescription: An abstract example workflow.\n---\n\n# Example\n';
  fs.writeFileSync(entrypoint, content);
  return {
    root, entrypoint, content,
    run: () => spawnSync(process.execPath, [path.join(root, 'scripts/validate.mjs')], { encoding: 'utf8', timeout: 10000 }),
  };
}

test('accepts a complete collection and rejects mismatched skill names', (t) => {
  const f = fixture(t);
  assert.equal(f.run().status, 0);
  fs.writeFileSync(f.entrypoint, f.content.replace('name: pnmrvvtl-example', 'name: mismatched'));
  const result = f.run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /frontmatter name/);
});

test('rejects missing dependencies and linked resources', (t) => {
  const f = fixture(t);
  fs.appendFileSync(f.entrypoint, '\nUse pnmrvvtl-missing. Read [details](references/missing.md).\n');
  const result = f.run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /unavailable skill/);
  assert.match(result.stderr, /missing linked file/);
});

test('rejects machine-specific paths and credential patterns', (t) => {
  const f = fixture(t);
  fs.appendFileSync(f.entrypoint, `\n${'C:'}/Projects/example-app\n${'ghp_'}${'x'.repeat(30)}\n`);
  const result = f.run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /machine-specific paths/);
  assert.match(result.stderr, /possible credential/);
});

test('rejects environment files even when they are hidden', (t) => {
  const f = fixture(t);
  fs.writeFileSync(path.join(f.root, '.env'), 'EXAMPLE=placeholder\n');
  const result = f.run();
  assert.equal(result.status, 1);
  assert.match(result.stderr, /environment files/);
});
