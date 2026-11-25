#!/usr/bin/env node
// The design parity gate. Reads the normalized tree (extract.mjs) and the spec that maps design nodes to
// page elements, drives the page in a real browser and checks, in this order:
//   coverage  every required design node is mapped to an element or carries a written n/a reason
//   geometry  each mapped node's box, relative to the root, against the design
//   style     fill, radius, opacity and text metrics against the design, unless overridden with a reason
//   pixels    the root's screenshot against the reference image, per region, text masked by default
// It writes report.md, results.json and the images, and exits 1 when any row fails. That exit code is
// the verdict; a report may not say the design matches while it is non-zero.
// Playwright is resolved from the project the command runs in; nothing is installed.
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

const args = parseArgs(process.argv.slice(2));
if (!args.spec) usage();
const specPath = path.resolve(args.spec);
const base = readJson(specPath);
const stateName = args.state ?? 'default';
const spec = stateName === 'default' ? base : { ...base, ...(base.states?.[stateName] ?? fail(`spec has no state "${stateName}"`)) };
const treePath = path.resolve(path.dirname(specPath), args.tree ?? spec.tree ?? fail('spec names no tree'));
const tree = readJson(treePath);
const url = args.url ?? spec.url ?? fail('no --url and no "url" in the spec');
const out = path.resolve(args.out ?? `design-parity-${stateName}`);
fs.mkdirSync(out, { recursive: true });
const tol = { px: 0.5, textPx: 1, colour: 2, alpha: 0.02, opacity: 0.01, cell: 16, cellMax: 0.1, pixel: 48, ...base.tolerance, ...spec.tolerance };
const scale = tree.source?.scale ?? 1;
const map = spec.nodes ?? {};
const byId = new Map(tree.nodes.map((n) => [n.id, n]));
const rows = [];
const add = (check, node, expected, actual, status, note = '') =>
  rows.push({ check, id: node?.id ?? '', name: node?.name ?? '', expected: String(expected ?? ''), actual: String(actual ?? ''), status, note });

// ---------- coverage ----------
for (const node of tree.nodes) {
  if (node.id === tree.root.id) continue;
  const entry = map[node.id];
  if (entry === undefined) {
    if (node.required) add('coverage', node, 'mapped or n/a', 'unmapped', 'FAIL', `${node.type} ${box(node)}`);
    continue;
  }
  if (typeof entry === 'object' && 'na' in entry) {
    if (!String(entry.na).trim()) add('coverage', node, 'n/a with a reason', 'empty reason', 'FAIL');
    else add('coverage', node, 'n/a', entry.na, 'N/A', `${node.type} ${box(node)}`);
  }
}
for (const id of Object.keys(map)) {
  if (!byId.has(id)) add('coverage', { id, name: '?' }, 'node in tree', 'not in tree', 'FAIL', 'stale mapping');
}

// ---------- browser ----------
const { chromium } = loadPlaywright();
const browser = await chromium.launch();
try {
  const context = await browser.newContext({ viewport: spec.viewport ?? { width: 1440, height: 900 }, deviceScaleFactor: scale });
  const page = await context.newPage();
  await page.goto(url, { waitUntil: 'load', timeout: 120000 });
  const root = page.locator(spec.rootSelector ?? fail('spec has no rootSelector')).first();
  await root.waitFor({ state: 'visible', timeout: 30000 });
  await page.addStyleTag({ content: '*,*::before,*::after{transition:none!important;animation:none!important;caret-color:transparent!important}' });
  await root.scrollIntoViewIfNeeded();
  for (const step of spec.before ?? []) await runStep(page, step);
  await page.waitForTimeout(Number(spec.settleMs ?? 300));

  const entries = Object.entries(map)
    .filter(([id, e]) => byId.has(id) && !(typeof e === 'object' && 'na' in e))
    .map(([id, e]) => [id, typeof e === 'string' ? e : e.selector, byId.get(id).type === 'TEXT']);
  const measured = await root.evaluate(measure, entries);

  // ---------- geometry ----------
  const r = measured.root;
  const rootOk = Math.abs(r.width - tree.root.width) <= tol.px && Math.abs(r.height - tree.root.height) <= tol.px;
  add('geometry', tree.root, `${tree.root.width}x${tree.root.height}`, `${fmt(r.width)}x${fmt(r.height)}`, rootOk ? 'PASS' : 'FAIL', 'root size');
  for (const [id] of entries) {
    const node = byId.get(id);
    const m = measured.nodes[id];
    const entry = typeof map[id] === 'object' ? map[id] : {};
    if (m.error) {
      add('geometry', node, box(node), m.error, 'FAIL', `selector ${entries.find((e) => e[0] === id)[1]}`);
      continue;
    }
    const limit = node.type === 'TEXT' ? tol.textPx : tol.px;
    const skip = entry.skip ?? {};
    if (!skip.geometry) {
      const d = Math.max(Math.abs(m.x - node.x), Math.abs(m.y - node.y), Math.abs(m.width - node.width), Math.abs(m.height - node.height));
      add('geometry', node, box(node), box(m), d <= limit ? 'PASS' : 'FAIL', `max delta ${fmt(d)}px, limit ${limit}`);
    } else add('geometry', node, box(node), box(m), 'SKIP', skip.geometry);
    styleChecks(node, m, entry, skip);
  }

  // ---------- pixels ----------
  if (spec.pixels !== false && tree.image?.crop) {
    // Clip on whole CSS pixels around the root; its fractional offset is undone when the images are aligned.
    const rb = await root.boundingBox();
    const clip = { x: Math.floor(rb.x), y: Math.floor(rb.y) };
    clip.width = Math.ceil(rb.x + rb.width) - clip.x;
    clip.height = Math.ceil(rb.y + rb.height) - clip.y;
    const frac = { x: rb.x - clip.x, y: rb.y - clip.y };
    const shot = await page.screenshot({ clip, animations: 'disabled', caret: 'hide', scale: 'device' });
    fs.writeFileSync(path.join(out, 'actual.png'), shot);
    const refFile = path.resolve(path.dirname(treePath), args.ref ?? tree.image.file);
    if (!fs.existsSync(refFile)) {
      add('pixels', tree.root, refFile, 'reference image missing', 'FAIL', 're-run extract.mjs');
    } else {
      const masks = [];
      if (spec.maskText !== false) {
        for (const n of tree.nodes) if (n.type === 'TEXT' && n.visible) masks.push({ ...pick(n), why: 'text' });
      }
      for (const m of spec.masks ?? []) {
        if (!m.reason) add('pixels', { id: m.node ?? 'rect' }, 'mask with a reason', 'no reason', 'FAIL');
        const n = m.node ? byId.get(m.node) : null;
        masks.push({ ...(n ? pick(n) : m.rect), why: m.reason });
      }
      const diffPage = await context.newPage();
      const res = await diffPage.evaluate(diffImages, {
        ref: fs.readFileSync(refFile).toString('base64'),
        act: shot.toString('base64'),
        crop: tree.image.crop,
        W: tree.root.width,
        H: tree.root.height,
        scale,
        masks,
        bg: measured.background,
        tol,
        frac,
      });
      fs.writeFileSync(path.join(out, 'reference.png'), Buffer.from(res.refB64, 'base64'));
      fs.writeFileSync(path.join(out, 'diff.png'), Buffer.from(res.heatB64, 'base64'));
      fs.writeFileSync(path.join(out, 'compare.png'), Buffer.from(res.compB64, 'base64'));
      const bad = res.cells.filter((c) => c.ratio > tol.cellMax);
      for (const c of bad.slice(0, 20)) {
        const over = tree.nodes.filter((n) => n.visible && n.id !== tree.root.id && overlaps(n, c)).map((n) => n.name).slice(0, 4).join(', ');
        add('pixels', { id: `cell ${c.x},${c.y}`, name: over }, `<= ${tol.cellMax * 100}% differing`, `${fmt(c.ratio * 100)}%`, 'FAIL', `${c.w}x${c.h} region`);
      }
      if (bad.length > 20) add('pixels', { id: 'cells' }, '', `${bad.length - 20} more failing regions`, 'FAIL');
      if (!bad.length) {
        const worst = res.cells.reduce((a, c) => (c.ratio > a.ratio ? c : a), { ratio: 0, x: 0, y: 0 });
        add('pixels', tree.root, `every region <= ${tol.cellMax * 100}%`, `worst ${fmt(worst.ratio * 100)}% at ${worst.x},${worst.y}`, 'PASS', `${res.cells.length} regions, ${masks.length} masked boxes, aligned by ${res.shift.x},${res.shift.y}px`);
      }
    }
  }
} finally {
  await browser.close();
}

// ---------- not checked automatically, listed so nobody assumes they were ----------
for (const node of tree.nodes) {
  if (!node.visible || map[node.id] === undefined || (typeof map[node.id] === 'object' && 'na' in map[node.id])) continue;
  if (node.effects) add('manual', node, node.effects.join(', '), 'not compared', 'MANUAL', 'effects: compare box-shadow / filter by hand');
  if (node.strokes) add('manual', node, `stroke ${node.strokes.weight ?? '?'} ${node.strokes.align ?? ''}`, 'not compared', 'MANUAL', 'strokes: compare border / outline by hand');
  if (node.fillKind) add('manual', node, node.fillKind, 'not compared', 'MANUAL', 'non-solid fill');
}

const failed = rows.filter((x) => x.status === 'FAIL');
const verdict = failed.length ? 'FAIL' : 'PASS';
fs.writeFileSync(path.join(out, 'results.json'), JSON.stringify({ verdict, state: stateName, url, tree: treePath, tolerance: tol, rows }, null, 2));
fs.writeFileSync(path.join(out, 'report.md'), report(verdict));
console.log(`${verdict}: ${failed.length} failing, ${rows.filter((x) => x.status === 'PASS').length} passing, ${rows.filter((x) => x.status === 'N/A').length} n/a, ${rows.filter((x) => x.status === 'MANUAL').length} manual`);
for (const f of failed.slice(0, 15)) console.log(`  FAIL ${f.check} ${f.id} ${f.name}: expected ${f.expected}, got ${f.actual} ${f.note}`);
console.log(`report: ${path.join(out, 'report.md')}`);
process.exitCode = failed.length ? 1 : 0;

// ---------- checks ----------

function styleChecks(node, m, entry, skip) {
  const expect = entry.expect ?? {};
  const check = (prop, designValue, actual, compare, unit = '') => {
    if (skip[prop]) return add('style', node, `${prop} ${designValue}`, actual, 'SKIP', skip[prop]);
    const override = expect[prop];
    const wanted = override ? override.v : designValue;
    if (wanted === undefined || wanted === null) return;
    if (override && !override.reason) add('style', node, `${prop} override`, 'no reason', 'FAIL');
    const ok = compare(wanted, actual);
    const note = override ? `design ${designValue}${unit}; expected per spec: ${override.reason}` : '';
    add('style', node, `${prop} ${wanted}${unit}`, actual, ok ? 'PASS' : 'FAIL', note);
  };
  const paint = node.type === 'TEXT' ? m.color : m.svg ? m.fill : m.background;
  if (node.fill) check('fill', node.fill, paint, (a, b) => sameColour(a, b));
  if (node.radius && !m.svg) check('radius', node.radius.join(' '), m.radius.join(' '), (a, b) => String(a).split(' ').every((v, i) => Math.abs(Number(v) - parseFloat(String(b).split(' ')[i])) <= tol.px), 'px');
  if (node.opacity !== undefined || Number(m.opacity) !== 1) check('opacity', node.opacity ?? 1, m.opacity, (a, b) => Math.abs(Number(a) - Number(b)) <= tol.opacity);
  if (node.text) {
    const t = node.text;
    check('fontSize', t.fontSize, m.fontSize, (a, b) => Math.abs(Number(a) - parseFloat(b)) <= 0.01, 'px');
    check('fontWeight', t.fontWeight, m.fontWeight, (a, b) => Math.abs(Number(a) - Number(b)) <= 0.5);
    if (m.lineHeight !== 'normal') check('lineHeight', t.lineHeightPx, m.lineHeight, (a, b) => Math.abs(Number(a) - parseFloat(b)) <= tol.px, 'px');
    const ls = m.letterSpacing === 'normal' ? '0px' : m.letterSpacing;
    check('letterSpacing', t.letterSpacingPx, ls, (a, b) => Math.abs(Number(a) - parseFloat(b)) <= 0.05, 'px');
    if (t.characters !== undefined && m.text.trim() !== t.characters.trim()) {
      add('content', node, JSON.stringify(t.characters), JSON.stringify(m.text.trim()), 'INFO', 'text differs: fine for data, wrong for a fixed label');
    }
  }
}

function sameColour(a, b) {
  const pa = parseColour(a);
  const pb = parseColour(b);
  if (!pa || !pb) return false;
  return pa.slice(0, 3).every((v, i) => Math.abs(v - pb[i]) <= tol.colour) && Math.abs(pa[3] - pb[3]) <= tol.alpha;
}

function parseColour(s) {
  const m = /rgba?\(([^)]+)\)/.exec(String(s));
  if (!m) return null;
  const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
  return [p[0], p[1], p[2], p[3] ?? 1];
}

// ---------- browser-side functions (serialized into the page) ----------

function measure(rootEl, list) {
  const rr = rootEl.getBoundingClientRect();
  const nodes = {};
  for (const [id, selector, isText] of list) {
    let el;
    try {
      if (!selector || selector === ':scope') el = rootEl;
      else if (selector.startsWith('document:')) el = document.querySelector(selector.slice(9));
      else el = rootEl.querySelector(selector);
    } catch (e) {
      nodes[id] = { error: `bad selector: ${e.message}` };
      continue;
    }
    if (!el) {
      nodes[id] = { error: 'selector matched nothing' };
      continue;
    }
    let r = el.getBoundingClientRect();
    const s = getComputedStyle(el);
    if (isText) {
      // The ink's width, the line boxes' height: what a Figma text node's box is.
      const range = document.createRange();
      range.selectNodeContents(el);
      const tr = range.getBoundingClientRect();
      const lh = parseFloat(s.lineHeight);
      if (tr.width > 0) {
        const lines = new Set([...range.getClientRects()].filter((q) => q.width > 0).map((q) => Math.round(q.top))).size || 1;
        const lead = Number.isFinite(lh) ? (lh - tr.height / lines) / 2 : 0;
        r = { left: tr.left, top: tr.top - lead, width: tr.width, height: Number.isFinite(lh) ? lh * lines : tr.height };
      }
    }
    nodes[id] = {
      x: r.left - rr.left,
      y: r.top - rr.top,
      width: r.width,
      height: r.height,
      svg: el instanceof SVGElement,
      background: s.backgroundColor,
      color: s.color,
      fill: s.fill,
      opacity: s.opacity,
      radius: [s.borderTopLeftRadius, s.borderTopRightRadius, s.borderBottomRightRadius, s.borderBottomLeftRadius].map((v) => parseFloat(v) || 0),
      fontSize: s.fontSize,
      fontWeight: s.fontWeight,
      lineHeight: s.lineHeight,
      letterSpacing: s.letterSpacing,
      text: el.textContent ?? '',
    };
  }
  // What shows through the transparent parts of the root: the first painted ancestor above it.
  let background = 'rgb(255, 255, 255)';
  for (let el = rootEl.parentElement; el; el = el.parentElement) {
    const bg = getComputedStyle(el).backgroundColor;
    if (bg && !/rgba\(.*,\s*0\)$/.test(bg) && bg !== 'transparent') {
      background = bg;
      break;
    }
  }
  return { root: { width: rr.width, height: rr.height }, nodes, background };
}

async function diffImages({ ref, act, crop, W, H, scale, masks, bg, tol, frac }) {
  const load = (b64) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = `data:image/png;base64,${b64}`;
  });
  const [refImg, actImg] = await Promise.all([load(ref), load(act)]);
  const w = Math.round(W * scale);
  const h = Math.round(H * scale);
  const canvas = (cw, ch) => {
    const c = document.createElement('canvas');
    c.width = cw;
    c.height = ch;
    return [c, c.getContext('2d', { willReadFrequently: true })];
  };
  const [refC, refX] = canvas(w, h);
  refX.fillStyle = bg;
  refX.fillRect(0, 0, w, h);
  refX.drawImage(refImg, crop.x, crop.y, crop.width, crop.height, 0, 0, w, h);
  const A = refX.getImageData(0, 0, w, h).data;
  const [actC, actX] = canvas(w, h);
  const drawActual = (sx, sy) => {
    actX.fillStyle = bg;
    actX.fillRect(0, 0, w, h);
    actX.drawImage(actImg, (-frac.x + sx) * scale, (-frac.y + sy) * scale);
    return actX.getImageData(0, 0, w, h).data;
  };
  const masked = new Uint8Array(w * h);
  for (const m of masks) {
    const x0 = Math.max(0, Math.floor(m.x * scale));
    const y0 = Math.max(0, Math.floor(m.y * scale));
    const x1 = Math.min(w, Math.ceil((m.x + m.width) * scale));
    const y1 = Math.min(h, Math.ceil((m.y + m.height) * scale));
    for (let y = y0; y < y1; y += 1) masked.fill(1, y * w + x0, y * w + x1);
  }
  // Position is the geometry check's job. Here the page is aligned to the design within one CSS pixel
  // first, so the regions report wrong shapes and missing ink rather than sub-pixel placement.
  const differs = (B, p) => Math.max(Math.abs(A[p] - B[p]), Math.abs(A[p + 1] - B[p + 1]), Math.abs(A[p + 2] - B[p + 2])) > tol.pixel;
  let shift = { x: 0, y: 0 };
  let best = Infinity;
  for (const sy of [0, -0.5, 0.5, -1, 1]) {
    for (const sx of [0, -0.5, 0.5, -1, 1]) {
      const D = drawActual(sx, sy);
      let n = 0;
      for (let i = 0; i < w * h; i += 1) if (!masked[i] && differs(D, i * 4)) n += 1;
      if (n < best) {
        best = n;
        shift = { x: sx, y: sy };
      }
    }
  }
  const B = drawActual(shift.x, shift.y);
  const cellPx = Math.max(1, Math.round(tol.cell * scale));
  const cols = Math.ceil(w / cellPx);
  const rowsN = Math.ceil(h / cellPx);
  const counts = new Array(cols * rowsN).fill(0);
  const totals = new Array(cols * rowsN).fill(0);
  const [heatC, heatX] = canvas(w, h);
  const heat = heatX.createImageData(w, h);
  for (let y = 0; y < h; y += 1) {
    for (let x = 0; x < w; x += 1) {
      const i = y * w + x;
      const p = i * 4;
      const grey = 0.3 * A[p] + 0.59 * A[p + 1] + 0.11 * A[p + 2];
      const light = 255 - (255 - grey) * 0.35;
      heat.data[p + 3] = 255;
      if (masked[i]) {
        heat.data[p] = light * 0.85;
        heat.data[p + 1] = light * 0.9;
        heat.data[p + 2] = 255;
        continue;
      }
      const cell = Math.floor(y / cellPx) * cols + Math.floor(x / cellPx);
      totals[cell] += 1;
      if (differs(B, p)) {
        counts[cell] += 1;
        heat.data[p] = 230;
        heat.data[p + 1] = 30;
        heat.data[p + 2] = 30;
      } else {
        heat.data[p] = light;
        heat.data[p + 1] = light;
        heat.data[p + 2] = light;
      }
    }
  }
  heatX.putImageData(heat, 0, 0);
  const cells = [];
  heatX.strokeStyle = 'rgb(230, 30, 30)';
  heatX.lineWidth = Math.max(1, scale);
  for (let cy = 0; cy < rowsN; cy += 1) {
    for (let cx = 0; cx < cols; cx += 1) {
      const k = cy * cols + cx;
      if (!totals[k]) continue;
      const ratio = counts[k] / totals[k];
      const cell = { x: (cx * cellPx) / scale, y: (cy * cellPx) / scale, w: Math.min(cellPx, w - cx * cellPx) / scale, h: Math.min(cellPx, h - cy * cellPx) / scale, ratio };
      cells.push(cell);
      if (ratio > tol.cellMax) heatX.strokeRect(cx * cellPx + 0.5, cy * cellPx + 0.5, cellPx - 1, cellPx - 1);
    }
  }
  const gap = Math.round(8 * scale);
  const [compC, compX] = canvas(w * 3 + gap * 2, h);
  compX.fillStyle = 'rgb(255, 0, 255)';
  compX.fillRect(0, 0, compC.width, h);
  compX.drawImage(refC, 0, 0);
  compX.drawImage(actC, w + gap, 0);
  compX.drawImage(heatC, (w + gap) * 2, 0);
  const b64 = (c) => c.toDataURL('image/png').split(',')[1];
  cells.sort((a, b) => b.ratio - a.ratio);
  return { cells, shift, refB64: b64(refC), heatB64: b64(heatC), compB64: b64(compC) };
}

// ---------- helpers ----------

async function runStep(page, step) {
  if (step.hover) await page.locator(step.hover).first().hover();
  else if (step.click) await page.locator(step.click).first().click();
  else if (step.press) {
    await page.locator(step.press).first().hover();
    await page.mouse.down();
  } else if (step.focus) await page.locator(step.focus).first().focus();
  else if (step.scroll) await page.locator(step.scroll).first().scrollIntoViewIfNeeded();
  else if (step.style) await page.addStyleTag({ content: step.style });
  else if (step.wait) await page.waitForTimeout(Number(step.wait));
  else fail(`unknown before step ${JSON.stringify(step)}`);
}

function report(verdict) {
  const order = { FAIL: 0, MANUAL: 1, 'N/A': 2, SKIP: 3, INFO: 4, PASS: 5 };
  const sorted = [...rows].sort((a, b) => order[a.status] - order[b.status]);
  const esc = (s) => String(s).replaceAll('|', '\\|');
  const lines = [
    `# Design parity: ${verdict}`,
    '',
    `- state: ${stateName}`,
    `- page: ${url}`,
    `- design: ${tree.source.kind} ${tree.source.ref ?? ''}, root "${tree.root.name}" ${tree.root.width}x${tree.root.height}, scale ${scale}`,
    `- tolerance: ${JSON.stringify(tol)}`,
    `- images: compare.png (design | page | differences), diff.png, actual.png, reference.png`,
    '',
    '| status | check | node | name | expected | actual | note |',
    '|---|---|---|---|---|---|---|',
    ...sorted.map((x) => `| ${x.status} | ${x.check} | ${esc(x.id)} | ${esc(x.name)} | ${esc(x.expected)} | ${esc(x.actual)} | ${esc(x.note)} |`),
    '',
  ];
  return lines.join('\n');
}

function loadPlaywright() {
  const req = createRequire(path.join(process.cwd(), 'package.json'));
  for (const name of ['playwright', '@playwright/test', 'playwright-core']) {
    try {
      return req(name);
    } catch {
      // try the next one
    }
  }
  fail('Playwright is not resolvable from this directory. Run the gate from the project that has it.');
}

function overlaps(n, c) {
  return n.x < c.x + c.w && n.x + n.width > c.x && n.y < c.y + c.h && n.y + n.height > c.y;
}

function pick(n) {
  return { x: n.x, y: n.y, width: n.width, height: n.height };
}

function box(b) {
  return `${fmt(b.x)},${fmt(b.y)} ${fmt(b.width)}x${fmt(b.height)}`;
}

function fmt(v) {
  return String(Math.round(Number(v) * 100) / 100);
}

function readJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch (e) {
    return fail(`cannot read ${p}: ${e.message}`);
  }
}

function parseArgs(list) {
  const res = {};
  for (let i = 0; i < list.length; i += 1) {
    if (!list[i].startsWith('--')) continue;
    const key = list[i].slice(2);
    res[key] = list[i + 1] && !list[i + 1].startsWith('--') ? list[(i += 1)] : true;
  }
  return res;
}

function usage() {
  console.error('usage: node verify.mjs --spec design/<feature>.spec.json [--state <name>] [--url <page>] [--tree <tree.json>] [--ref <png>] [--out <dir>]');
  process.exit(2);
}

function fail(message) {
  console.error(`verify: ${message}`);
  process.exit(2);
}
