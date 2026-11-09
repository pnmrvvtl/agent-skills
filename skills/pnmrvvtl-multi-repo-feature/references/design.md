# The design is the source of truth — until it contradicts itself

Treating the design export as an oracle fixes the "agents invent artwork" problem and creates the
"the oracle is wrong" problem. This file covers both.

## Assets are verbatim

An asset is never redrawn, approximated, or picked by its name. The exported SVG/PNG is taken as-is,
mapped by **geometry** — the right asset at the right coordinates — not by a filename guess. A hand-drawn
path standing in for a missing icon fails the design-fidelity check. When the asset is genuinely missing
from the export, the state is **blocked**, not approximated: delete the approximation, record the node id
in a `BLOCKED-*.md`, and let the affected visual state stay red with its measured number until a re-export
arrives.

Two mechanical checks enforce this:

- **Design-fidelity:** every icon is a Figma export or cites `// figma:<nodeId>`; every font family maps to
  a real `@font-face`; a banned pattern (`font-family: X, inherit`) is absent.
- **Baseline integrity:** the committed design crops are checksum-locked, so an agent that edits a
  baseline to make a mask line up fails the gate.

## The invalid-CSS trap

`font-family: 'Example Font', inherit` is invalid CSS: the declaration is dropped, the family falls
back silently, and every modal title renders in the body font. Nothing in a size/spacing/colour assertion
notices. Assert the **resolved** family at runtime and statically ban the pattern. A silent degradation is
worse than a visible break.

## The no-image rule for delegates (D-25)

The orchestrator owns the eyes. Delegates own the numbers:

- The orchestrator looks at the mock-ups and turns what it sees into a **written defect list** in the
  packet ("row 2 card order is wrong; the blog title wraps instead of truncating; the grid sits 9px low").
- A delegate never opens a PNG. It measures with `sharp` and prints numbers.
- A delegate never reads a 1-1.7MB design node file whole. It extracts the fields it needs with a script.

Why: an image in a session is re-sent on every subsequent step (L-017). One look is paid for hundreds of
times.

## Invalid or self-contradictory exports

A design handoff is a **snapshot, not a specification**. It can be internally inconsistent and it can
encode rasteriser artefacts as if they were layout. For example, two frames may prescribe
different item orders, or narrow and wide states may use inconsistent fixtures.

### How to prove a contradiction

Measure the built page against **every** frame, not just the one you are fixing. When a state refuses to
close, extract the node JSON for that frame and compare content order and counts directly. A gate that
measures the product against each frame is what makes the contradiction visible; without it you conclude
the code is wrong and start tuning CSS to chase a diff that is really two different mockups.

Also check for a cache keyed by an unchanged URL/path: a stale optimised image makes a fixed grid measure
against the old bitmap. If a visual gap does not move after a real code fix, suspect that before the code.

### How to respond

1. **Stop.** A contradiction is a design problem, not an engineering one.
2. **Ask which state is authoritative.** Record the chosen fixture and geometry; the product must not
   reshuffle its data merely to fit inconsistent screenshots.
3. **Park the disagreeing states** with `test.fixme(true, '<reason>')` carrying their **measured number**,
   a **named cause**, and a **re-enable condition** ("when the conflicting frames use the
   agreed fixture and the baselines are re-exported").
4. **Record it as a numbered decision** and add the park rows to `GATES.md`.
5. **Report to the human** and get the decision confirmed. Never reshuffle product data to match a picture.

Parking is legitimate **only** with a measured number, a named cause and a re-enable condition. Parking
anything else is gaming the gate (see `gates.md`).

### Per-baseline exceptions

A residual that is real and understood but outside the code's control gets a named exception at the
measured value, never a raised global budget and never a mask. Rounded glyph advances — Figma rounding each
character's advance up so a row drifts a few pixels by the tenth item — are an **export artefact**, not a
layout value to copy into CSS. Exceptions are re-checked when the export changes.

## Getting Figma data at all

- **Check the plan tier on the first cheap call** (`/v1/me` is cheap; read the `x-figma-plan-tier` and
  `x-figma-rate-limit-type` response headers). On the low tier, do the entire export as **one**
  `/files/:key?ids=…` call at full depth plus **one** `/images` call, and save every response to disk.
  Exploratory calls exhaust the monthly quota in minutes and trigger a multi-day `429`.
- **Prefer the local plugin when the REST quota is gone.** Batch (about 15 frames), stream one file per
  batch to disk, reset state between batches, add a "start from batch" field to resume, wrap every getter
  in try/catch, and export each component set and icon once at a single scale. Assume the file contains
  broken component sets; the variant is still readable from `mainComponent.name`.
- **View-only files hide all plugin actions** (Ctrl+K finds nothing). The user must "Duplicate to your
  drafts" first.
