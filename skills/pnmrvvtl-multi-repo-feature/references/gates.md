# Gates that cannot be gamed

A gate exists to be believed. This file has an illustrative multi-repository catalogue, common
gaming patterns, and the two mechanisms — ratchets and A/B proofs — that make a gate
worth more than the current green run.

The single most load-bearing habit: **a gate is not trusted until it has been watched to fail.** From the
green side alone, a misconfigured gate, a typo'd glob, a script that exits 0 on error, and a genuinely
clean codebase are indistinguishable.

## The catalogue

Run one entry point that fans out across the repos and prints a single table, non-zero on any red. Name
flags for `--repos=`, `--only=`, `--skip=`. Write the last run to a gitignored `baselines/last-gates.json`.

| Gate | Command | Setting | Notes |
|---|---|---|---|
| type check | `npm run ts-check` | 0 errors | cannot see missing `"use client"` — see below |
| lint | `npm run lint` | 0 errors **and** `--max-warnings 0` | ratchet the warning ceiling down, never up |
| stylelint | `npm run stylelint` | repo config | |
| tests + coverage | `npm run test:ci` | suite green; global floors at the **measured** values | pin the skip count as a ceiling too |
| per-file coverage | `check-new-file-coverage.mjs <repo> <base>` | ≥90% statements for every new/changed src file; an unmeasured changed file **fails** | exclude lists silently swallow files — assert the file is not excluded |
| duplication | `npm run duplication` (jscpd) | at the measured % | icons tokenise to nothing; plant logic files in the A/B |
| security | `check-security.mjs <repo> <base>` | secret scan 0 (including untracked), SAST 0 on changed files, no new dependency ids vs baseline | |
| API spec | `check-api-spec.mjs` | mock route table == `### METHOD /path` headings | see `knowledge-base.md` |
| e2e | `playwright test <e2e dir>` | all pass | use a distinct `--output` per run |
| visual | `playwright test -c playwright.visual.config.ts` | per-region, see below | `--update-snapshots=none` always |
| build | `npm run build` | succeeds | run **last**: it tears down a dev server on the same port |
| staged coverage (hook) | `check-staged-test-coverage.mjs` | constant synced to the lower of lines/statements | |

Two traps the catalogue encodes:

- **A runner that exits 0 when no tests matched a filter.** Assert the test count, not only the exit code.
- **A type checker cannot see everything.** Removing `"use client"` from a store left `tsc` at exit 0 while
  the framework failed at runtime; only eslint caught it. Type-check green is not "the app runs".

## Ratchets are set at the level reached

A gate is set at **the value the tree is actually at**, never a round number someone liked. An aspirational
gate is bypassed within a week and then nothing is enforced. Exact-value ratchets (coverage at
`87.62` statements, not `87`) have zero slack by design — which means **any** new untested line blocks the
commit. Warn every agent of that in its packet, and restore derived caches (coverage reports) after any
A/B run, because a leftover planted-coverage file will block the next commit (L-007).

Retire a gate that no longer applies by **number**, with the reason, and never renumber the others, so old
notes keep meaning what they said.

## The A/B proof, made mechanical

A human running two halves once is not a proof; it decays the moment someone edits the gate. Write one
script, one entry per gate:

```
for each proof:
  1. apply a real mutation to the working tree
  2. run the gate command -> assert NON-ZERO exit AND output matches expectFailure
  3. revert the mutation exactly
  4. run the gate command -> assert ZERO exit
then: assert the working tree is clean
```

Four things separate this from theatre:

- **`expectFailure` is a regex on the output, not just the exit code.** A gate that fails on a typo in its
  own command also exits non-zero; the regex proves it failed *for its own reason*. This is the most
  important line in each proof.
- **`expectNotInFailure` for staged gates.** A two-stage visual gate's pixel proof must assert the output
  does **not** mention a size change, or the mutation moved the layout and you proved stage 1 while
  claiming stage 2.
- **The mutation is a real edit with an exact undo**, reverted in a `finally`, and the run ends by
  asserting the tree is clean.
- **Mutations isolate one behaviour.** For a visual gate: one that changes page height (proves the
  dimension stage) and one that changes only colour (proves the pixel stage). "Break something" proves
  neither.

Prefer instant mutations: to prove a test-count gate, feed it a hand-written report file with two failures
and three skips rather than re-running the suite. Commit the script and its results.

## Per-region visual comparison

A global pixel budget hides local defects: a wrong 20px icon is ~400px in a 290k-px modal — 0.14%, under a
1% budget. That local defect can remain visible while the gate passes (L-015). Compare **both**:

- **Global:** the whole clip ratio against the design crop.
- **Per-region:** 32px cells, each with its own ceiling (20-25%). Name the worst cell and its coordinate in
  the failure output, so a number points at a place.
- **Dimensions before pixels.** Compare image size first; a pixel diff between differently sized images
  reports near-total difference and tells you nothing. "This page got 240px taller" is actionable.
- **Font resolution.** Assert at runtime that the family that renders is the intended one. A missing font
  falls back silently and no size/spacing/colour assertion notices.

Capture design baselines once, at a fixed viewport, clipped to the content area, mock delay zero. Compare
in two stages and never let a spec move product layout (`element.style…`, injected padding/margin/transform)
— `scan-gate-gaming.mjs` flags that.

**Three surfaces, not one:** routes, the component catalogue, and **modals**. Declare a modal's trigger
from the app's own registry rather than discovering it by clicking, screenshot the dialog element rather
than the page, and capture both views where a summary/detailed toggle exists.

## Named exceptions, not masks

When a residual diff is real and understood but outside the code's control, add an exception **per
baseline**, carrying a measured number and a named cause, and re-check it when the export changes:

```
<baseline-id>  global <budget> (measured <ratio>)  cell <budget> (measured <ratio> @ <coordinates>)
cause: <verified rendering limitation, with a re-check condition>.
```

A mask or a Figma-pixel overlay **hides** the region; it needs an allowlist entry with a reason and is
deleted once the app can render the thing. Never raise a global budget to cover a local defect, and never
edit a committed design crop.

## Gate-gaming patterns that were caught

Refuse all of these in the packet, and scan for the mechanical ones:

| Pattern | Why it is a failure |
|---|---|
| `test.skip` / `test.fixme` with no written, reviewed reason | parks a real failure |
| a `mask:` or Figma-pixel overlay outside the declared allowlist | hides the region being measured |
| raising `maxDiffPixelRatio` / `threshold` | moves the goalposts |
| editing the committed design baseline | destroys the reference |
| a compensating offset (`translateY`, negative letter-spacing, min-width = the Figma box) | tunes the product to the picture instead of fixing the cause; ask "which design node/property is this?" |
| a spec injecting padding/margin/transform | mutates the thing under test |
| a hand-drawn SVG standing in for a missing asset | violates "assets verbatim"; block and re-export |
| tuning product data to match a frame | product data is not a styling knob (see `design.md`) |
| `// @ts-ignore`, `as unknown as`, `any` to silence a type gate | suppression is not a fix |

## The anti-gaming scan

`scripts/scan-gate-gaming.mjs` walks a tree and reports the mechanical patterns (bare `toHaveScreenshot`,
`mask:` outside an allowlist, `maxDiffPixelRatio` above a ceiling, `test.skip/fixme` with no reason on the
line above, `@ts-ignore`/`@ts-expect-error`, `as unknown as`, inline `element.style` writes in specs). Run
it in the pre-push hook next to lint. It is a floor, not a substitute for reviewing the diff: the
non-mechanical games (a compensating offset that "looks like" a real value) need the orchestrator's eye.

```
node "<installed-skill-dir>/scripts/scan-gate-gaming.mjs" <repo-root> [--allowlist design-overlays.json]
# exit 1 with `path:line  pattern  detail` on any finding; exit 0 clean
```

Resolve `<installed-skill-dir>` to this skill's directory, or copy the helper into the consuming
project's tooling directory and use that reviewed copy in its hooks.
