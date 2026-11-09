---
name: pnmrvvtl-gated-refactor
description: Run a large, multi-week refactor as a sequence of independently shippable phases, each ending with a working application and a new quality gate that is ratcheted to the level actually reached. Use when the user asks for a "big refactor", "refactoring programme", to "clean up the codebase", to "add quality gates", "raise coverage", "reduce duplication", "make lint strict", or when a refactor is too large to land in one pass. Measures everything before changing anything, keeps state in a committed REFACTOR/ directory so a fresh session can resume from one file, and proves every gate red-then-green before believing it.
---

# Gated Refactor

A large refactor fails in one of three ways: it is abandoned half-done, it silently changes
behaviour, or it ends with gates that were never really enforcing anything. This skill exists to
make all three hard.

The method, in one paragraph: **measure everything first, then move in phases; each phase ends with a
working application, a new gate set at the level actually reached, and a written report; no gate is
believed until it has been watched to fail.**

## When to use this

Use it when the work is too big for one pass — a codebase-wide cleanup, a tooling overhaul, a
duplication or complexity campaign, a push to raise coverage or make lint strict.

**Do not use it** for a single bug fix, one feature, or a refactor confined to one module. The
overhead of `REFACTOR/`, baselines and phase reports is only earned when the work spans weeks and
sessions. For those, `pnmrvvtl-follow-project-style` and `pnmrvvtl-verify-for-real` are enough.

## The four rules

Everything else in this skill follows from these.

### 1. Measure before you touch anything

Phase 0 changes no code except the minimum needed to make the test suite pass. Every number a later
phase will claim to improve is captured first, as JSON, committed. Without a baseline, "duplication
is down" is an opinion.

### 2. Every phase ends shippable

The user must be able to stop after any phase and ship, or walk away for a month, and find nothing
half-done. Phase boundaries are commit boundaries. If a phase cannot end green, it was scoped wrong —
split it.

### 3. Gates are ratchets, never aspirations

A gate is set at **the level actually reached** and fails on regression from there. Never at a round
number someone liked. A gate that cannot pass on the tree it is introduced to has the wrong setting,
not the wrong codebase — widen it and record the real number.

An aspirational gate gets bypassed within a week, and then nothing is enforced at all.

### 4. No gate is trusted until it has been seen to fail — the A/B rule

**This is the most load-bearing habit in the method.** For every gate wired or tightened:

1. **Red run.** Put the codebase in the state the gate exists to catch — revert the fix, plant a
   violation, reintroduce the pattern. Run the gate. **Record that it fails, with its real output.**
2. **Green run.** Restore. Run again. **Record that it passes, with its real output.**

Both halves go in the phase report. From the green side alone, a misconfigured gate, a typo'd glob, a
script that exits 0 on error, and a genuinely clean codebase are indistinguishable.

The same applies to any claim that a change had an effect, including bug fixes and "this is inert"
claims: show the failure first, then the fix. Where a red run is genuinely impossible, write
"could not be A/B proven" and why. Silently skipping it is not an option.

### Make the A/B mechanical, not a memory

A human running the two halves once and remembering the result is not a proof — it decays the moment
anyone edits the gate. **Write the A/B as a script**, one entry per gate:

```
for each proof:
  1. apply a known mutation to the working tree
  2. run the gate command -> assert NON-ZERO exit AND output matches expectFailure
  3. revert the mutation
  4. run the gate command -> assert ZERO exit
then: assert the working tree is clean
```

Four things make this trustworthy rather than theatre:

- **`expectFailure` is a regex on the output, not just the exit code.** A gate that fails because of
  a typo in its own command, a missing file, or a crashed script also exits non-zero. The regex is
  what proves it failed *for its own reason*. This is the single most important line in each proof.
- **`expectNotInFailure` where a gate has stages.** For a two-stage visual gate, the pixel proof must
  assert the output does **not** mention a size change — otherwise the mutation moved the layout and
  the proof is silently exercising stage 1 while claiming to prove stage 2.
- **The mutation is a real edit with an exact undo**, applied to the working tree and reverted in a
  `finally`. The run ends by asserting the tree is clean; a proof that leaves a mutation behind is
  worse than no proof.
- **Mutations are chosen to isolate one behaviour.** For the visual gate: one that changes page
  height (proves the dimension stage) and one that changes only colour (proves the pixel stage, since
  dimensions are untouched). A single "break something" mutation proves neither.

Prefer mutations that are instant. Where a gate reads a report file, feed it a synthetic report
instead of re-running the whole suite — a test-count gate can be proven in milliseconds with a
hand-written JUnit file carrying two failures and three skips.

Commit the script and its results. `ab-proofs.json` next to the baselines, regenerated whenever a
gate changes, is what turns "we proved it once" into something a stranger can re-run.


## Constraints to agree with the user before starting

Ask about each of these in phase 0. They are the ones that, left unstated, cause the most damage:

- **Is dead-code removal in scope?** Often it must not be: if modules that belong to the system are
  absent from the checkout, code that looks unreferenced is imported elsewhere and deleting it breaks
  the product silently. Never let a tool like `knip` be the source of truth for deletion.
- **Is a type migration in scope?** Adding TypeScript, or a JSDoc typing campaign, is its own
  programme. Do not let it ride along.
- **Are behaviour changes allowed?** Default: no. Anything that alters what the app does is a
  separate decision needing explicit agreement.
- **May dependencies be upgraded?** Default: only inside a phase that names the upgrade. A tool's own
  major upgrade belongs to the phase that configures it; nothing else rides along.
- **Are hook bypasses ever acceptable?** Default: never. No `--no-verify`, no `HUSKY=0`, no
  `core.hooksPath=/dev/null`. If a hook fails, fix the cause; if the failure is genuinely unrelated,
  stop and escalate rather than deciding alone that the gate does not apply.

Write the agreed answers into `PLAN.md` as numbered constraints, and refer to them by number in
later phases.

## The artifacts

All planning, state and evidence live in a committed `REFACTOR/` directory. The point is that a
fresh session reads **one file** and knows where things stand.

```
REFACTOR/
  PROGRESS.md              one screen: phase, status, what is next, blockers. Always current.
  PLAN.md                  the phases, their goals, the agreed constraints
  GATES.md                 every gate: what it measures, current setting, where wired, A/B status
  BUILD-VERIFICATION.md    only if the build is broken — the procedure, see references/
  VISUAL-HARNESS.md        only if there is a UI — capture/compare design, see references/
  baselines/               measured numbers as JSON, one file per tool per capture
  phases/phase-N-<name>.md that phase's plan, findings, decisions, evidence, final report
  screenshots/             visual baselines and diffs — gitignored, they are too large and often
                           contain secrets and customer data
```

Rules that keep this from rotting:

- **`PROGRESS.md` is short and always current.** Update it at the end of every work session, not
  only at the end of a phase. Detail goes in the phase file, never here.
- **When working inside a phase, read that phase's file and `GATES.md`.** Do not load the others.
- **Numbers live in `baselines/*.json`, not in prose.** Prose summarises; JSON is the record.
- **Corrections are written down, not edited away.** If a phase 0 measurement turns out to be wrong,
  state that it was wrong and what the real number is. Silently fixing a number destroys the reader's
  ability to trust the rest.

Templates for all four markdown files: `assets/`.

## Phase 0 — the only phase with a fixed shape

Everything after phase 0 is shaped by what phase 0 finds. Phase 0 itself is always the same:

1. **Get the test suite green.** If tests fail, fix them — and look for an existing fix first
   (a recent PR, a branch, a colleague's commit) rather than reinventing one. Port only the hunks
   that fix the failures; leave the rest of that change alone. Say which commit you took it from.
2. **Establish how the build is verified.** If the build is broken, document the exact procedure to
   verify it anyway, and never commit the workaround state. See `references/build-verification.md`.
3. **Capture every baseline that costs nothing now.** See `references/baselines.md` for the list and
   the commands.
4. **Write `PLAN.md`, `GATES.md`, `PROGRESS.md`, and a file per planned phase**, including which
   tool each phase installs and which gate each phase tightens.
5. **Design the visual harness on paper.** Install nothing yet. See `references/visual-harness.md`.
6. **Verify the stated facts about the repo.** The brief you were given will contain errors. Check
   the framework major, the real file counts, the installed versions against the declared ranges, the
   story count versus the story *file* count. Report every correction plainly — later phases depend
   on these numbers.

**Deliverable: the failing-test fix, and documentation. Nothing else changes.**

Do not begin a phase before the previous phase's report is approved.

## Setup — after phase 0 measures, before phase 1 builds

Phase 0 ends with numbers. **Do not start phase 1 until the user has chosen what the programme
actually is.** Ask three things, as multi-select where the options are not exclusive, using the
measured numbers as the evidence for each choice — never a generic menu.

### 1. Which gates? (multi-select)

Present the catalogue from `gates.md` with **this repo's measured baseline next to each one**, and a
recommendation. A gate the user did not choose is retired by number, not renumbered.

```
Which gates should this programme enforce?
[x] G1  tests pass, skip ceiling          measured: <passed> pass / <skipped> skip
[x] G2  coverage floors                   measured: lines <percent> / branches <percent>
[x] G3  build succeeds                    <current result and required procedure>
[x] G4  visual parity (screenshots)       <catalogue count> entries + <route count> routes
[ ] G5  duplication - code                measured: <percent> @ <token threshold>
...
[ ] G15 type check                        N/A - no type system in this project
```

Mark the ones that do not apply (type gates in an untyped codebase) as **N/A** rather than offering
them. Say plainly which you recommend and why, in one line each.

**Formatting is the one to actively argue against** unless the measurement supports it — see
`gates.md` § Formatting. Do not put it on the list as a neutral option.

### 2. Which phases? (multi-select)

Same shape. Each phase maps to gates, so a gate chosen in (1) with its phase deselected in (2) is a
contradiction — surface it rather than silently resolving it.

Offer the console-cleanliness phase explicitly; it is easy to forget and it is usually one of the
highest-value phases, because the warnings are defects the codebase is already reporting for free.

### 3. Recommended order, or custom? (single choice)

Offer the recommended order with its one-line rationale, and a custom order. If custom, **validate
it against the dependencies** and say what breaks:

| Rule | Why |
|---|---|
| Phase 0 is always first | nothing can be measured after it has been changed |
| The visual harness precedes any phase that moves code | it is the safety net for duplication, size and CSS work |
| Lint precedes console cleanliness | the prop-type rule and the runtime prop-type warnings are one family |
| Console cleanliness precedes coverage | writing tests against a console full of warnings hides the new ones |
| CSS consolidation is late | it depends on the visual gate being trusted |
| "Make it stick" is always last | it mirrors whatever gates ended up existing |

A custom order that breaks one of these is allowed — say what it costs, get confirmation, and record
the decision in `PLAN.md`.

### Record the answers

Write the selections into `PLAN.md` before any tooling is installed: the chosen gates, the chosen
phases, the order, and the rationale for anything that departs from the recommendation. `GATES.md`
gets the unchosen gates listed as **retired** or **N/A** with the reason, so a later reader does not
re-propose them.

## Shaping the phases

The phase catalogue — what each phase does, what it installs, what it tightens, and what usually goes
wrong in it — is in `references/phases.md`. The default ordering:

| Phase | Name | Introduces |
|---|---|---|
| 0 | Plan and unblock | measurement; commit hygiene |
| 1 | Minimum tooling, wide settings | test, coverage floors, build, visual baseline |
| 2 | Duplication | duplication gates |
| 3 | Lint strictness | zero errors, zero warnings, unused-disable detection |
| 4 | Size and complexity | file/function length, complexity, depth ratchets |
| 5 | Types | type-check gate, strictness ratchet — **skip if the project has no types** |
| 6 | Test coverage | raised floors, console-error gate |
| 7 | Visual and component hardening | screenshot gate, component-catalogue build, bundle budget |
| 8 | CSS and styling consolidation | CSS duplication |
| 9 | Make it stick | CI mirroring the hooks, `AGENTS.md`, gate-escape policy |

Three ordering principles, which matter more than the exact list:

- **Cheap and broad before deep and narrow.** Formatting-adjacent and mechanical gates first; they
  make later diffs readable.
- **Each tool arrives with the phase that uses it.** Do not install phase 5's tooling in phase 1.
  Unused tooling rots and confuses.
- **The visual gate must exist before the phases that move code.** It is the safety net for the
  duplication, size and CSS phases. Build the harness early even though it only becomes a gate later.
- **Console cleanliness sits after lint and before coverage.** After lint because the prop-type rule
  and the runtime prop-type warnings are one family; before coverage because writing new tests
  against a console full of existing warnings hides the ones the new tests cause.

Adjust the list once phase 0's measurements are in — but tell the user what you are changing and why
**before** acting on it.

## The gates

Full catalogue, with what each measures, the command, how to set it, how to ratchet it, and its
specific A/B proof: **`references/gates.md`**. Summary:

| | Gate | Typical phase |
|---|---|---|
| G1 | Test suite passes; skips do not increase | 1 |
| G2 | Coverage floors (line/statement/branch/function) | 1, raised in 6 |
| G3 | Build succeeds | 1 |
| G4 | Visual parity — screenshots of components and routes | 1 harness, 7 gate |
| G5 | Code duplication — code | 2 |
| G6 | Code duplication — stylesheets | 2, tightened in 8 |
| G7 | Lint errors = 0 | 3 |
| G8 | Lint warnings = 0 (`--max-warnings 0`) | 3 |
| G9 | Unused lint-disable directives | 3 |
| G10 | Import order | 3 |
| G11 | File length (`max-lines`) | 4 |
| G12 | Function length (`max-lines-per-function`) | 4 |
| G13 | Cyclomatic complexity | 4 |
| G14 | Nesting depth (`max-depth`) | 4 |
| G15 | **Type check passes; no new suppressions** | 5 |
| G16 | **Type strictness ratchet** (`strict` flags, `any` count) | 5 |
| G17 | No console errors or unhandled rejections in tests | 4a |
| G17b | No console errors in the **running app** | 4a |
| G18 | Component catalogue builds (Storybook or equivalent) | 7 |
| G19 | Bundle size budget | 7 |
| G20 | Commit hygiene — reviewed diff, no drive-by reformatting | 0 |

**G15 and G16 apply only if the project has types.** If it is plain JavaScript and a type migration
is out of scope, mark them "not applicable — no type system in this project" in `GATES.md` and
retire the numbers rather than renumbering everything else. Keep numbers stable across the whole
programme so old notes keep meaning what they said. The same applies to any gate the user removes
mid-programme: retire it, record why, never reuse the number.

### The visual gate, in three sentences

Because it is the gate people get wrong, and the one that protects every phase that moves code:

- **Capture runs against the live backend and records the API responses** into a HAR alongside the
  screenshots; **Compare replays that recording**, so the gate needs no credentials, no network and
  no backend, and yesterday's data is still yesterday's data. Replay never happens during capture.
- **Screenshots are full-page**, and comparison is **two-stage: dimensions first, pixels only if the
  dimensions match.** A pixel diff between differently-sized images reports near-total difference and
  tells you nothing; "this page got 240px taller" is a finding someone can act on.
- **An unrecorded request is a harness failure, not a visual one** — reported separately, never
  quietly served from the live network.
- **A recorded entry with no body is not a response.** A browser cache hit is logged as a `200` with
  `content.size === -1`; replaying it serves zero bytes, and nothing in the stack calls that an
  error — tables render empty and web fonts silently fall back. Disable the HTTP cache while
  capturing, and drop bodyless entries before replaying. Missing bodies can look like unrelated
  data-loading, font or rendering failures.

**Three surfaces, not one:** routes, the component catalogue, and **modals**. Modals are gated the
same way — declare their triggers from the app's own registry rather than discovering them by
clicking, screenshot the dialog element rather than the page, and capture both views where a
summary/detailed toggle exists. See `references/visual-harness.md` § The modal surface.

Everything else — freezing, masking, discovering routes, dev vs prod, and the traps that cost real
sessions — is in `references/visual-harness.md`.

**An install is a code change.** A phase that adds one tool rewrites the lockfile, and that diff can
silently remove a package the application needs. For example, a hoisted transitive dependency may
disappear and break a consumer that relied on it implicitly. Static gates may miss that failure;
run the application to check it. Review the
lockfile diff as *removals* and *additions*, not as line count, and re-run the visual gate after any
dependency change.

**Formatting gates deserve a specific warning.** A repo-wide formatter check often fails on nearly
every file, and the causes are usually style disagreements rather than defects. Measure *why* before
proposing it, and expect the honest answer to sometimes be "this should not be a gate at all". See
`references/gates.md` § Formatting.

## Reporting

At the end of every phase, in the phase file and in a message to the user:

- **The numbers, before against after**, for every metric the phase touched.
- **What changed, and what was deliberately left alone with the reason.** The second half is the one
  people skip and the one that builds trust.
- **The gate wired or tightened, its exact setting, and its A/B proof** — both runs, with output.
- **Build verification result, visual parity result, full test result.**
- **Anything you could not verify, stated plainly as unverified.** Not omitted, not softened.

Do not report a phase complete while any gate is red or any claim is unmeasured.

## Maintaining this skill

This skill is meant to be edited while it is being used. When a programme running under it hits a
weak spot — a gate that could not be A/B proven the way described, a phase ordering that did not
work, a trap that cost hours — **fix this skill in the same session**, and say what changed. A
methodology skill that is not updated from real runs decays into folklore.
