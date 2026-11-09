---
name: pnmrvvtl-match-the-design
description: Implement a supplied design exactly and prove the match. Use when the user hands over a Figma link, a design PDF, or design screenshots and expects the result to match pixel for pixel — sizes, padding, margins, corner radii, colours, opacity, shadows, and for web also hover/active/disabled states and transition timing. Triggers on "pixel perfect", "точно як в дизайні", "match the design", "implement this Figma", "here is the design", or any request to build UI from a supplied visual. Extracts a machine-readable spec from the source before any code is written, then diffs the built result against that spec and reports every delta.
---

# Match The Design

Eyeballing a design is how "almost right" ships. The gap is never in the comparison at the
end — it is that nobody wrote down what the design actually *says* before coding started.

So this skill inverts the usual order: **extract a spec, then build against it, then diff.**
The spec is a file, not a memory. The same file feeds the implementation and the verification,
so the two cannot drift apart.

## Non-negotiables

- **No implementation code before the spec file exists.** Not "I'll measure as I go". The spec
  comes first, whole.
- **Never claim more fidelity than the source can carry.** A screenshot cannot tell you opacity,
  shadow parameters, hover states or easing curves. Say so out loud at Phase 0.
- **Never invent a value the source does not contain.** If the design shows a field the data or
  the source does not have, render the fallback and record it as a gap. Do not guess a number
  because it "looks about right".
- **Never load a raw Figma node dump into context.** Fetch to a file, filter with a script, read
  only the distilled spec. One frame can be megabytes of JSON.
- **A tolerance budget is mandatory.** Without declared limits "pixel perfect" cannot be
  falsified, and an unfalsifiable claim is not verification.
- **The spec is committed.** It is a fixture and a regression test, not scratch work.

## Phase 0 — Identify the source and state the ceiling

Classify what you were handed and say what it can and cannot give.

| Property | Figma API | Vector PDF | Raster PDF / screenshots |
|---|---|---|---|
| Position, size | exact | exact | measured, ±0.3px |
| Padding, gaps | exact (auto-layout) | inferred from positions | inferred from positions |
| Corner radius | exact (per corner) | from path control points | ±0.5px from corner profile |
| Colours | exact | exact | near-exact; JPEG noise at edges |
| **Opacity** | exact | exact | **impossible** — only the composite is visible |
| **Shadows** | exact | sometimes | **not recoverable** |
| Font family / size / weight / line-height | exact | exact | inferred by width matching only |
| **Hover / active / disabled** | yes, if built as variants | no | no |
| **Transitions: type, easing, duration** | yes, from prototype interactions | no | no |

To tell a vector PDF from a raster one: if every page is a single full-page image and the page
reports no embedded fonts, it is a raster mock — treat it as screenshots.

State the ceiling in one sentence before proceeding. If the request is "pixel perfect" and the
source is screenshots, name the properties that will be unverifiable and ask whether a Figma
link exists. Do not quietly do half the job.

## Phase 1 — Figma access gate

**Only when the source is a Figma link.** This is a hard stop, not a warning.

1. Check for the token yourself first — do not ask before checking. `FIGMA_TOKEN` in the
   environment, then `~/.claude/settings.json`, then the project `.env`.
2. If present, validate it with one cheap call:
   ```bash
   curl -s -o /dev/null -w '%{http_code}' \
     -H "X-Figma-Token: $FIGMA_TOKEN" https://api.figma.com/v1/me
   ```
   `200` = usable. `403` = expired, revoked, or wrong scope.
3. **Missing or invalid → stop and tell the user**, with the setup instructions in
   `references/figma.md`. Do not silently fall back to screenshots of the Figma frame, and do
   not proceed hoping it works.
4. If the user already said the token is in the environment, skip the instructions — still run
   the validation and report the result.

## Phase 2 — Extract the spec

Output is one file: `design/<feature>.spec.json` (see `assets/spec.schema.json`). It holds every
element the implementation must hit, keyed by a stable name, each value carrying a `source`
field recording where it came from: `figma`, `measured`, or `assumed`.

- **Figma** → `references/figma.md`. Fetch to disk, distil with a script, never read the raw
  dump. Pull geometry, radii, fills, strokes, effects, node and fill opacity, auto-layout
  padding and spacing, text style, prototype interactions, and the sibling variants of a
  component set for hover / pressed / disabled.
- **Vector PDF** → extract per-character positions, fonts and sizes; take rectangle geometry
  and corner curves from the paths. Read the page size from the page rect — never assume A4.
- **Raster PDF or screenshots** → `references/measuring-rasters.md`. Establish scale first;
  without a known reference dimension absolute sizes are unobtainable, so ask for one.

## Phase 3 — Resolve what cannot be matched, explicitly

Two decisions go into the spec before coding, not into the final report as a surprise:

**Font.** If the design's family cannot be shipped, pixel-exact is impossible by definition.
Either embed it — state the bundle cost — or match metrics: choose the size that makes rendered
label widths equal the design's, and record both the design value and the substitute.

**Properties the source cannot express.** List them, with the fallback chosen for each and why.
This list is reproduced verbatim in the final report; it is the honest boundary of the claim.

## Phase 4 — Tolerance budget

Write it into the spec. Defaults, tighten on request:

| Property | Tolerance |
|---|---|
| Position, size, padding, gap | ±0.5px |
| Corner radius | ±0.5px |
| Colour | exact after normalising to `rgb()` / `rgba()` |
| Opacity | ±0.01 |
| Shadow offset / blur / spread | ±0.5px, colour exact |
| Font size, weight, line-height | exact |
| Transition duration | ±10ms, easing function exact |

Anything outside budget is a failure, not "close enough".

## Phase 5 — Implement from the spec

Read values from the spec file. Do not retype numbers off the design image. Where the project
has design tokens or CSS variables, map spec values onto them and record the mapping — a raw hex
that duplicates an existing token is a defect even when it renders correctly.

## Phase 6 — Prove the match

Run this as a `pnmrvvtl-verify-for-real` probe: the spec supplies the falsifiable claims, that
skill supplies the protocol. Do not invent a second, parallel proof procedure.

- **Web / DOM** → `references/web-parity.md`. Assert computed values, not only pixels; drive
  every state listed in the spec for real; confirm transitions actually animate.
- **Rendered document (PDF, canvas, image)** → render at the reference DPI and compare measured
  geometry element by element with the Phase 2 techniques. Hover states and transitions do not
  exist in this medium — say so rather than marking them passed.

Always compare across more than the happy case: longest realistic content, empty values, every
state in the spec. A design matched only on the mock's sample data is matched by accident.

## Phase 7 — Report

A table, one row per element per property: expected, actual, delta, in budget or not. Then:

- what is proven, at what tolerance
- what could not be verified and why — the Phase 3 list
- every value whose `source` is `assumed`

Keep `design/<feature>.spec.json` in the repo.

## Workspace hygiene

Three kinds of files, three fates. Decide which one you are creating *before* you create it.

| Kind | Example | Fate |
|---|---|---|
| Deliverable | `design/<feature>.spec.json` | stays in the repo, committed |
| Harness | render and measure scripts, probes | deleted before reporting |
| Evidence | overlay diffs, rendered PNGs, raw API dumps | kept, but **outside** the repo |

**Default: create nothing inside the repository.** Harness scripts and artefacts go in the
session scratchpad. Evidence has to survive the report — the user must be able to open the
overlay after reading the delta table — so it lives outside the tree and the report cites
absolute paths to it.

**The only exception:** the project's tooling cannot resolve a file from outside the root.
Vite's dev-server fs allow-list, Playwright's `testDir`, Jest `roots`, `tsconfig` `include` will
refuse an external path. Only then put the script in the repo, and:

- one dedicated directory, clearly named for what it is (`.design-probe/`)
- do **not** add it to `.gitignore` — an ignored file is a file you can forget, and editing
  `.gitignore` is itself a repo change you would have to revert. Let it show in `git status`;
  visible is safer than hidden
- record every path you create as you go

**Before reporting the task complete:** delete every recorded path, run `git status --short`,
and confirm nothing remains except intended changes. If something unexpected is there, say so
rather than guessing whether it is yours.

Never `git clean`, never `rm -rf` a directory you did not create, never delete a file you did
not put there. If a file you create collides with an existing one, stop and ask. Clean up on
the failure path too — an abandoned run leaves the tree exactly as it found it.

## When not to run this

If the design was handed over as loose reference and the ask is for something "in this style",
this is overkill — say so and build to the project's existing design system instead. This skill
is for when the delivered visual is the contract.
