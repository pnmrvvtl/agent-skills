#!/usr/bin/env node
// Turns any supported design source into one normalized tree that verify.mjs reads:
//   --from figma-api     Figma REST API (FIGMA_TOKEN), or a saved /nodes response plus a rendered PNG
//   --from figma-export  JSON written by a Figma plugin export: Figma-shaped nodes, base64 `png` on some of them
//   --from raster        a screenshot or a rendered PDF page; nodes are added afterwards by measurement
// The tree lists every node under the chosen root with its box relative to the root, its paint and text
// properties, and whether the parity gate requires it to be mapped. Nothing here needs a package install.
import fs from 'node:fs';
import path from 'node:path';

const SHAPES = new Set(['VECTOR', 'ELLIPSE', 'RECTANGLE', 'LINE', 'STAR', 'POLYGON', 'REGULAR_POLYGON', 'BOOLEAN_OPERATION', 'TEXT']);

const args = parseArgs(process.argv.slice(2));
if (!args.from || !args.out) usage();
const outPath = path.resolve(args.out);
const refPath = path.resolve(args['image-out'] ?? outPath.replace(/\.tree\.json$|\.json$/, '') + '.ref.png');

const handlers = { 'figma-export': fromExport, 'figma-api': fromApi, raster: fromRaster };
if (!handlers[args.from]) usage(`unknown --from ${args.from}`);
const tree = await handlers[args.from]();
tree.image.file = path.relative(path.dirname(outPath), refPath).replaceAll('\\', '/');

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(tree, null, 2) + '\n');
const required = tree.nodes.filter((n) => n.required).length;
console.log(`wrote ${outPath}`);
console.log(`root ${tree.root.name} ${tree.root.width}x${tree.root.height}, ${tree.nodes.length} nodes, ${required} required`);
console.log(`reference ${refPath} at scale ${tree.source.scale}, crop ${JSON.stringify(tree.image.crop)}`);

// ---------- sources ----------

async function fromExport() {
  if (!args.input || !args.node) usage('figma-export needs --input <file|dir> --node <id|name:...>');
  const files = listJson(path.resolve(args.input));
  for (const file of files) {
    const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
    const tops = [doc.frames, doc.componentSets, doc.document]
      .flatMap((v) => (Array.isArray(v) ? v : v && typeof v === 'object' ? (v.id ? [v] : Object.values(v)) : []))
      .filter((n) => n && typeof n === 'object');
    const hit = findNode(tops, matcher(args.node));
    if (!hit) continue;
    const withPng = [...hit.chain, hit.node].reverse().find((n) => typeof n.png === 'string');
    if (!withPng) fail(`node found in ${file}, but neither it nor an ancestor carries a png to compare pixels against`);
    const png = Buffer.from(withPng.png.replace(/^data:image\/png;base64,/, ''), 'base64');
    fs.mkdirSync(path.dirname(refPath), { recursive: true });
    fs.writeFileSync(refPath, png);
    const tree = normalize(hit.node, hit.chain, { kind: 'figma-export', ref: `${path.basename(file)}#${hit.node.id}`, exportedAt: doc.meta?.exportedAt });
    placeImage(tree, hit.node, withPng, pngSize(png));
    return tree;
  }
  fail(`node ${args.node} not found in ${files.length} file(s)`);
}

async function fromApi() {
  if (!args.node) usage('figma-api needs --node <id>');
  const id = args.node.includes(':') ? args.node : args.node.replace('-', ':');
  const scale = Number(args.scale ?? 2);
  let document;
  let png;
  if (args.input) {
    const saved = JSON.parse(fs.readFileSync(path.resolve(args.input), 'utf8'));
    document = saved.nodes?.[id]?.document ?? saved.document ?? saved;
    if (!args.image) usage('an offline figma-api run needs --image <png rendered by /v1/images at --scale>');
    png = fs.readFileSync(path.resolve(args.image));
  } else {
    if (!args.key) usage('figma-api needs --key <file key> (or --input for a saved response)');
    const token = process.env.FIGMA_TOKEN;
    if (!token) fail('FIGMA_TOKEN is not set; see references/figma.md for setup');
    const headers = { 'X-Figma-Token': token };
    const base = `https://api.figma.com/v1`;
    const nodes = await getJson(`${base}/files/${args.key}/nodes?ids=${encodeURIComponent(id)}`, headers);
    document = nodes.nodes?.[id]?.document;
    if (!document) fail(`node ${id} not returned by the API`);
    const images = await getJson(`${base}/images/${args.key}?ids=${encodeURIComponent(id)}&format=png&scale=${scale}`, headers);
    const url = images.images?.[id];
    if (!url) fail(`no rendered image for ${id}: ${JSON.stringify(images.err ?? images)}`);
    const res = await fetch(url);
    if (!res.ok) fail(`image download failed: HTTP ${res.status}`);
    png = Buffer.from(await res.arrayBuffer());
  }
  fs.mkdirSync(path.dirname(refPath), { recursive: true });
  fs.writeFileSync(refPath, png);
  const tree = normalize(document, [], { kind: 'figma-api', ref: `${args.key ?? 'saved'}#${id}` });
  placeImage(tree, document, document, pngSize(png));
  return tree;
}

async function fromRaster() {
  if (!args.image || !args.scale) usage('raster needs --image <png> --scale <image px per css px>');
  const png = fs.readFileSync(path.resolve(args.image));
  const size = pngSize(png);
  const scale = Number(args.scale);
  fs.mkdirSync(path.dirname(refPath), { recursive: true });
  if (path.resolve(args.image) !== refPath) fs.writeFileSync(refPath, png);
  const width = round(size.width / scale);
  const height = round(size.height / scale);
  return {
    source: { kind: 'raster', ref: path.basename(args.image), scale },
    root: { id: 'root', name: args.name ?? 'root', width, height },
    image: { crop: { x: 0, y: 0, width: size.width, height: size.height } },
    // Raster sources carry no node tree. Measured elements are appended here as nodes with
    // "source": "measured" (references/measuring-rasters.md); per-region pixels cover the rest.
    nodes: [{ id: 'root', name: args.name ?? 'root', type: 'FRAME', parent: null, x: 0, y: 0, width, height, visible: true, required: false, source: 'measured' }],
  };
}

// ---------- normalization ----------

function normalize(rootNode, chain, source) {
  const rootBox = rootNode.absoluteBoundingBox;
  if (!rootBox) fail(`node ${rootNode.id} has no absoluteBoundingBox`);
  const inheritedVisible = chain.every((n) => n.visible !== false);
  const nodes = [];
  const walk = (node, parent, visibleAbove, insideBoolean) => {
    const visible = visibleAbove && node.visible !== false;
    nodes.push(describe(node, parent, rootBox, visible, insideBoolean));
    for (const child of node.children ?? []) walk(child, node.id, visible, insideBoolean || node.type === 'BOOLEAN_OPERATION');
  };
  walk(rootNode, null, inheritedVisible, false);
  const scale = Number(args.scale ?? 1);
  return {
    source: { ...source, scale },
    root: { id: rootNode.id, name: rootNode.name, width: round(rootBox.width), height: round(rootBox.height) },
    image: {},
    nodes,
  };
}

function describe(node, parent, rootBox, visible, insideBoolean) {
  const box = node.absoluteBoundingBox ?? { x: rootBox.x, y: rootBox.y, width: 0, height: 0 };
  const render = node.absoluteRenderBounds;
  const fills = (node.fills ?? []).filter((f) => f.visible !== false);
  const strokes = (node.strokes ?? []).filter((s) => s.visible !== false);
  const effects = (node.effects ?? []).filter((e) => e.visible !== false);
  const solid = fills.find((f) => f.type === 'SOLID');
  const paints = fills.length > 0 || strokes.length > 0 || effects.length > 0;
  const out = {
    id: node.id,
    name: node.name,
    type: node.type,
    parent,
    x: round(box.x - rootBox.x),
    y: round(box.y - rootBox.y),
    width: round(box.width),
    height: round(box.height),
    visible,
    // The gate demands a mapping for everything that puts ink on the screen. Pure wrappers (frames,
    // groups, instances without their own paint) may be mapped, but are not required.
    required: visible && !node.isMask && !insideBoolean && node.id !== undefined && (SHAPES.has(node.type) || paints) && box.width > 0 && box.height > 0,
    source: 'design',
  };
  if (parent === null) out.required = false;
  if (render) out.render = { x: round(render.x - rootBox.x), y: round(render.y - rootBox.y), width: round(render.width), height: round(render.height) };
  if (solid) out.fill = rgba(solid.color, (solid.color.a ?? 1) * (solid.opacity ?? 1));
  else if (fills.length) out.fillKind = fills.map((f) => f.type).join(',');
  const radius = radii(node);
  if (radius) out.radius = radius;
  if (typeof node.opacity === 'number' && node.opacity !== 1) out.opacity = round(node.opacity, 3);
  if (strokes.length) out.strokes = { count: strokes.length, weight: num(node.strokeWeight), align: node.strokeAlign };
  if (effects.length) out.effects = effects.map((e) => e.type);
  if (node.type === 'TEXT') out.text = text(node);
  return out;
}

function text(node) {
  const st = node.style ?? node;
  const fontSize = num(st.fontSize);
  const lh = node.lineHeight;
  let lineHeightPx = num(st.lineHeightPx);
  if (lineHeightPx === undefined && lh && typeof lh === 'object') {
    if (lh.unit === 'PIXELS') lineHeightPx = lh.value;
    if (lh.unit === 'PERCENT' && fontSize) lineHeightPx = (fontSize * lh.value) / 100;
  }
  if (node.style && node.style.lineHeightUnit === 'INTRINSIC_%') lineHeightPx = undefined;
  let letterSpacingPx = typeof st.letterSpacing === 'number' ? st.letterSpacing : undefined;
  const ls = node.letterSpacing;
  if (letterSpacingPx === undefined && ls && typeof ls === 'object') {
    letterSpacingPx = ls.unit === 'PIXELS' ? ls.value : ls.unit === 'PERCENT' && fontSize ? (fontSize * ls.value) / 100 : undefined;
  }
  return {
    characters: node.characters,
    family: st.fontFamily ?? node.fontName?.family,
    style: node.fontName?.style ?? st.fontPostScriptName,
    fontSize,
    fontWeight: num(st.fontWeight),
    lineHeightPx: lineHeightPx === undefined ? undefined : round(lineHeightPx),
    letterSpacingPx: letterSpacingPx === undefined ? undefined : round(letterSpacingPx, 3),
    textCase: st.textCase ?? node.textCase,
    align: st.textAlignHorizontal ?? node.textAlignHorizontal,
    autoResize: st.textAutoResize ?? node.textAutoResize,
  };
}

function radii(node) {
  if (Array.isArray(node.rectangleCornerRadii)) return node.rectangleCornerRadii.map((r) => round(r));
  const corners = [node.topLeftRadius, node.topRightRadius, node.bottomRightRadius, node.bottomLeftRadius];
  if (corners.every((r) => typeof r === 'number') && corners.some((r) => r > 0)) return corners.map((r) => round(r));
  if (typeof node.cornerRadius === 'number' && node.cornerRadius > 0) return [0, 0, 0, 0].map(() => round(node.cornerRadius));
  return undefined;
}

// The PNG covers the node that carries it: its bounding box, or its render bounds when effects bleed
// past the box. Whichever size the image matches sets the origin and the scale; the target is cropped
// out of it by its own bounding box.
function placeImage(tree, target, carrier, size) {
  const box = carrier.absoluteBoundingBox;
  const render = carrier.absoluteRenderBounds;
  const candidates = [box, render].filter(Boolean);
  let origin = candidates[0];
  let scale = size.width / origin.width;
  for (const c of candidates) {
    const s = size.width / c.width;
    if (Math.abs(size.height / c.height - s) < 0.02 && Math.abs(s - Math.round(s * 4) / 4) < 0.02) {
      origin = c;
      scale = Math.round(s * 4) / 4;
      break;
    }
  }
  const t = target.absoluteBoundingBox;
  tree.source.scale = scale;
  tree.image.crop = {
    x: round((t.x - origin.x) * scale),
    y: round((t.y - origin.y) * scale),
    width: round(t.width * scale),
    height: round(t.height * scale),
  };
  tree.image.carrier = { id: carrier.id, name: carrier.name, size };
}

// ---------- helpers ----------

function findNode(tops, match) {
  const stack = tops.map((n) => ({ node: n, chain: [] }));
  while (stack.length) {
    const { node, chain } = stack.pop();
    if (match(node)) return { node, chain };
    for (const child of node.children ?? []) stack.push({ node: child, chain: [...chain, node] });
  }
  return null;
}

function matcher(spec) {
  if (spec.startsWith('name:')) {
    const name = spec.slice(5);
    return (n) => n.name === name;
  }
  const id = spec.includes(':') || spec.startsWith('I') ? spec : spec.replace('-', ':');
  return (n) => n.id === id;
}

function listJson(p) {
  if (!fs.existsSync(p)) fail(`${p} does not exist`);
  if (fs.statSync(p).isFile()) return [p];
  return fs.readdirSync(p).filter((f) => f.endsWith('.json')).sort().map((f) => path.join(p, f));
}

function pngSize(buf) {
  if (buf.readUInt32BE(0) !== 0x89504e47) fail('reference image is not a PNG');
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

async function getJson(url, headers) {
  const res = await fetch(url, { headers });
  if (!res.ok) fail(`${url.split('?')[0]}: HTTP ${res.status} ${res.status === 403 ? '(token expired, revoked or lacks file access)' : ''}`);
  return res.json();
}

function rgba(c, a) {
  const ch = (v) => Math.round(v * 255);
  return `rgba(${ch(c.r)}, ${ch(c.g)}, ${ch(c.b)}, ${round(a, 3)})`;
}

function num(v) {
  return typeof v === 'number' && Number.isFinite(v) ? v : undefined;
}

function round(v, digits = 2) {
  const f = 10 ** digits;
  return Math.round(v * f) / f;
}

function parseArgs(list) {
  const out = {};
  for (let i = 0; i < list.length; i += 1) {
    if (!list[i].startsWith('--')) continue;
    const key = list[i].slice(2);
    out[key] = list[i + 1] && !list[i + 1].startsWith('--') ? list[(i += 1)] : true;
  }
  return out;
}

function usage(message) {
  if (message) console.error(message);
  console.error(`usage:
  node extract.mjs --from figma-export --input <export.json|dir> --node <id|name:Layer name> --out design/<feature>.tree.json [--image-out <png>]
  node extract.mjs --from figma-api --key <file key> --node <id> [--scale 2] --out design/<feature>.tree.json   (FIGMA_TOKEN)
  node extract.mjs --from figma-api --input <saved /nodes response> --image <rendered png> --node <id> --scale <n> --out ...
  node extract.mjs --from raster --image <png> --scale <image px per css px> --out design/<feature>.tree.json`);
  process.exit(2);
}

function fail(message) {
  console.error(`extract: ${message}`);
  process.exit(1);
}
