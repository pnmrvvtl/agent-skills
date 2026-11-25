# Figma plugin export

What to do when the design arrives as files written by a Figma plugin instead of a link with API
access. No token is needed; the export carries the same node data the REST API returns.

## Recognising it

One or more JSON files, often split into batches and often tens of megabytes each, shaped like:

```json
{
  "meta": { "fileName": "...", "page": { "name": "Design" }, "batch": 0, "batchCount": 12, "exportedAt": "..." },
  "frames": [ { "id": "1:2", "type": "FRAME", "absoluteBoundingBox": { ... }, "fills": [ ... ], "children": [ ... ], "png": "<base64>" } ],
  "componentSets": { ... },
  "icons": { "<id>": { "name": "...", "svg": "<svg ...>" } },
  "styles": { ... },
  "variables": { ... }
}
```

The nodes use Figma's own field names: `absoluteBoundingBox`, `absoluteRenderBounds`, `fills`,
`strokes`, `effects`, `cornerRadius` and per-corner radii, auto-layout padding and `itemSpacing`,
`opacity`, `visible`, and on text nodes `characters`, `fontName`, `fontSize`, `fontWeight`,
`letterSpacing` and `lineHeight` as `{ unit, value }`. Never open these files in context: a single
batch can be larger than the whole context window. `scripts/extract.mjs` parses them.

## What it can and cannot give

| Property | Available |
|---|---|
| Box of every node, including each vector inside an icon | yes, exact |
| Fills, radii, opacity, strokes, effects, auto-layout | yes, exact |
| Text values | yes, in the plugin API's units (`PIXELS`, `PERCENT`, `AUTO`) |
| Variants (hover, pressed, with data, empty) | yes, as children of a component set |
| Pixels | only where the plugin attached a `png`: usually top-level frames and component sets, usually at 1x |
| Icons as SVG | yes, under `icons` |
| Prototype transitions | only if `reactions` were exported and are non-empty |

A node without its own `png` is cropped out of the nearest ancestor that has one. The extractor works
out the image's origin and scale by matching the PNG's size against the ancestor's bounding box, then
its render bounds (shadows make the PNG larger than the box). A 1x reference cannot show sub-pixel
placement; the geometry check covers that with exact numbers.

## Finding the node

- From a Figma link: the `node-id=1234-5678` query parameter is node `1234:5678`.
- Without a link: `--node "name:Property 1=Default"` takes the first node with that exact layer name;
  confirm it is the one you meant from the printed root size.
- Instance children have compound ids such as `I12:345;6:789`; pass them as printed.
- For a component with states, list the variants of its component set and pick the one whose data
  matches the page (empty vs populated, liked vs not). Extract one tree per state you will check.

```bash
node <skill-dir>/scripts/extract.mjs --from figma-export --input <export-dir> --node 1234:5678 \
  --out design/<feature>.tree.json --image-out <evidence-dir>/<feature>.ref.png
```

## Caveats

- **It is a snapshot.** `meta.exportedAt` says when. If the designer changed the file afterwards, the
  export does not know; ask for a re-export when the page and the export disagree in a way that looks
  intentional.
- **Exports can contradict themselves.** Two frames of one screen can carry different data. Measure
  against each, and report the contradiction instead of tuning CSS toward one of them.
- **Broken component sets** still name their variant in `mainComponent.name`.
- **View-only files hide plugin actions.** The owner has to duplicate the file to their drafts before a
  plugin can export it.
