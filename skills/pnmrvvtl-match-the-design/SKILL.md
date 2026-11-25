---
name: pnmrvvtl-match-the-design
description: Implement a supplied design exactly and prove the match with a mechanical gate, whatever form the design arrives in — a Figma link (REST API with a token), a Figma plugin export (JSON with node trees and embedded PNGs), a vector or raster PDF, or plain screenshots. Use when the user hands over a design and expects pixel-perfect results — sizes, padding, margins, corner radii, colours, opacity, text metrics, icons, and for web also hover/active/disabled states and transitions. Triggers on "pixel perfect", "PP", "точно як в дизайні", "match the design", "implement this Figma", "here is the design", or any request to build UI from a supplied visual. Normalizes the source into one node tree, maps every node that puts ink on the screen to a page element, and lets a script decide pass or fail on coverage, geometry, style and per-region pixels.
---

# Match The Design

Two ways "pixel perfect" fails, and both have happened:

1. **The implementer picks what to compare.** A 32px button box was measured and passed; the 20x22
   icon inside it was never on the list and shipped at 17.7x19.6. The list of things to compare must
   come from the design, not from whoever wrote the code.
2. **The verdict is prose.** "Matches the design" was written while a delta was outside budget. The
   verdict must be an exit code that a script produced.

So the method is the same for every source: **normalize the design into a node tree, map every node
that puts ink on the screen to an element, and let `scripts/verify.mjs` decide.** Only the first step
depends on how the design was delivered.

## Non-negotiables

- **No implementation code before the tree and the spec exist.**
- **Coverage is total.** Every required node in the tree (anything that paints: text, vectors, shapes,
  anything with a fill, stroke or effect) is mapped to an element or carries a written `n/a` reason.
  The gate fails on an unmapped node. Pure wrappers may be mapped but are not required.
- **Pixels are compared per region, never as one global percentage.** A wrong 20px icon is 0.14% of a
  modal and passes any global budget.
- **The report's verdict is the gate's exit code.** Never write "matches", "pixel perfect" or "done"
  while `verify.mjs` exits non-zero. Every `n/a`, `skip`, `expect` override and mask carries a reason,
  and the report prints all of them.
- **Never claim more fidelity than the source carries** (Phase 0), and never invent a value the source
  does not contain.
- **Never load a raw design dump or a large image into context.** Scripts read them; you read the
  scripts' output and the small comparison images.
- **The tree and the spec are committed** next to the feature as `design/<feature>.tree.json` and
  `design/<feature>.spec.json`. Reference PNGs, screenshots and diffs are evidence, kept outside the repo.

## Phase 0 — Identify the source, pick the adapter, state the ceiling

| Source | How to recognise it | Adapter | What it cannot give |
|---|---|---|---|
| Figma link, token valid | `figma.com/design/<key>/...?node-id=` and `FIGMA_TOKEN` answers 200 on `/v1/me` | `extract.mjs --from figma-api --key <key> --node <id>` ([figma.md](references/figma.md)) | nothing structural; prototype transitions only if built |
| Figma plugin export | JSON files whose `frames[]` hold Figma-shaped nodes (`absoluteBoundingBox`, `fills`, ...) and base64 `png` on some frames and component sets | `extract.mjs --from figma-export --input <dir> --node <id>` ([figma-export.md](references/figma-export.md)) | pixels only at the export scale, cropped from the nearest exported ancestor; transitions only if `reactions` were exported |
| Vector PDF | text is selectable, fonts are embedded | render the page to PNG at a known DPI, then `--from raster`; take exact numbers from the PDF's text and paths ([measuring-rasters.md](references/measuring-rasters.md)) | states, transitions |
| Raster PDF, screenshots | one image per page, no fonts | `extract.mjs --from raster --image <png> --scale <n>`, nodes added by measurement ([measuring-rasters.md](references/measuring-rasters.md)) | opacity, shadows, states, exact font values; coverage rests on the per-region pixels |

State the ceiling in one sentence before going on. A Figma link with no usable token, and nothing
else supplied: **stop and ask** for a token or a plugin export (setup in [figma.md](references/figma.md)).
Do not quietly degrade to screenshots of the frame.

## Phase 1 — Extract the tree

Run the adapter from the scripts folder of this skill. It writes:

- `design/<feature>.tree.json` — the root and every node under it: box relative to the root, fill,
  radii, opacity, strokes, effects, text metrics, visibility, and `required`
- the reference PNG of the root at a known scale (`--image-out`, outside the repo)

It prints the root, the node count and how many nodes are required. Read that summary, not the tree.
For a component with states, extract one tree per variant (hover, pressed, disabled, empty, with data).
Pick the variant that matches the data the page will show: a design count of 568 and a page with no
likes yet are different variants, not a delta.

## Phase 2 — Write the spec

`design/<feature>.spec.json` ([spec.schema.json](assets/spec.schema.json)) maps the tree onto the page:

```json
{
  "tree": "button.tree.json",
  "url": "http://localhost:3000/<page>",
  "viewport": { "width": 1440, "height": 900 },
  "rootSelector": "button[aria-label=\"Like\"]",
  "nodes": {
    "<rect-node-id>": ":scope",
    "<icon-node-id>": "svg path",
    "<count-node-id>": {
      "selector": "[class*=count]",
      "skip": { "geometry": "the count is live data, its width follows the digits" },
      "expect": { "fontWeight": { "v": 350, "reason": "the design weight mapped onto the project's font-weight token" } }
    },
    "<decoration-node-id>": { "na": "hidden behind the sticky header in this layout" }
  },
  "states": { "hover": { "tree": "button.hover.tree.json", "before": [{ "hover": "button[aria-label=\"Like\"]" }], "nodes": {} } }
}
```

Selectors resolve inside the root (`:scope` is the root itself; `document:<css>` reaches outside it, for
portals). Map an icon to its `path` or shape element, not to the `svg` box: the vector node's box is the
ink. The spec also holds the tolerance budget, the font decision and the gaps (Phases 3-4).

## Phase 3 — Resolve what cannot be matched, explicitly

**Font.** If the design's family or weight cannot ship as drawn (a custom face, a calibrated weight
scale), record the shipped value as an `expect` override with its reason, per text role. Text regions
are masked from the pixel stage by default because rasterisers differ; text is held by its metrics
(size, line height, letter spacing, weight, box) instead. Prefer the project's tokens over a measured
number: the override names the token.

**Properties the source cannot express.** List them in `gaps`, each with its fallback and why. They
go into the report verbatim.

## Phase 4 — Tolerance budget

Defaults, set in the spec's `tolerance` and tightened on request:

| Key | Default | Meaning |
|---|---|---|
| `px` | 0.5 | position and size of a mapped node, radii |
| `textPx` | 1 | text boxes (rasteriser and font metrics) |
| `colour` | 2 | per channel, 0-255 |
| `opacity` | 0.01 | |
| `cell` | 16 | pixel region size, CSS px |
| `cellMax` | 0.1 | share of differing pixels a region may have |
| `pixel` | 48 | per-channel difference that makes a pixel differ |

Anything outside budget is a failure, not "close enough". Never raise a budget to get a pass; record a
named `expect`, `skip` or mask with its measured number and cause instead.

## Phase 5 — Implement from the tree

Read values from the tree, not off the picture. Where the project has design tokens, map tree values
onto them; a raw literal that duplicates an existing token is a defect even when it renders right.

## Phase 6 — Prove the match

Run the gate from the project root, so Playwright resolves from the project:

```bash
node <skill-dir>/scripts/verify.mjs --spec design/<feature>.spec.json --out <evidence-dir>/<feature>
node <skill-dir>/scripts/verify.mjs --spec design/<feature>.spec.json --state hover --out <evidence-dir>/<feature>-hover
```

It checks, in order: **coverage**, **geometry** (each mapped node's box relative to the root),
**style** (fill, radius, opacity, font size, weight, line height, letter spacing) and **pixels** (the
root against the reference, aligned within one CSS pixel, compared per region with text masked). It
writes `report.md`, `results.json`, `compare.png` (design | page | differences), and exits 1 on any
failure. Effects, strokes and non-solid fills are listed as `MANUAL` rows: compare them by hand
([web-parity.md](references/web-parity.md)) and say you did.

Iterate until it exits 0, then:

- run every state and every breakpoint the spec names — a design matched in one state is matched in one
  state
- run it once against a deliberately broken page (shrink one icon with a `before` style step) and see it
  fail, so the pass means something
- for transitions and the states a static screenshot cannot hold, follow
  [web-parity.md](references/web-parity.md) under `pnmrvvtl-verify-for-real`

For a rendered document rather than a page (PDF, canvas, image), render at the reference scale and use
`--from raster` on the output for both sides of the comparison.

## Phase 7 — Report

Paste the gate's verdict line and its table (failures first). Then list, from the same report: every
`N/A`, `SKIP`, `expect` override and mask with its reason, every `MANUAL` row with what you compared by
hand, the Phase 0 ceiling and the `gaps`. Attach `compare.png` for each state. If the verdict is FAIL,
the item is not done; say so in the first line.

## Workspace hygiene

| Kind | Example | Fate |
|---|---|---|
| Deliverable | `design/<feature>.tree.json`, `design/<feature>.spec.json` | committed |
| Harness | ad-hoc probes you wrote | deleted before reporting |
| Evidence | reference PNGs, `compare.png`, `report.md` from the gate | kept **outside** the repo, cited by absolute path |

The bundled scripts stay in the skill; never copy them into the project. If the project's tooling
cannot reach an external path, put a probe in one dedicated directory (`.design-probe/`), do not
gitignore it, and delete it before reporting. Never `git clean`, never delete a file you did not create.

## When not to run this

If the design was handed over as loose reference ("in this style"), say so and build to the project's
design system instead. This skill is for when the delivered visual is the contract.
