---
name: pnmrvvtl-full-cycle-from-design
description: Run a complete delivery pipeline for a change that comes with a design — clarify before coding, extract a spec from the supplied Figma link, PDF or screenshots, implement natively to the project, then prove both the behaviour and the pixel match. Use when the user asks for the "full cycle" and hands over a design, or says "do it properly, pixel perfect", or invokes this skill by name. Chains pnmrvvtl-inspect-before-implement, then pnmrvvtl-match-the-design, then pnmrvvtl-check-the-docs, then pnmrvvtl-cover-edge-cases, then pnmrvvtl-follow-project-style, then pnmrvvtl-verify-for-real, in that order. With no design supplied, use pnmrvvtl-full-cycle instead.
---

# Full Cycle From Design

Six skills, one order, no skipping:

```
1. pnmrvvtl-inspect-before-implement   understand and clarify, write no code
2. pnmrvvtl-match-the-design           extract the design into a committed spec file
3. pnmrvvtl-check-the-docs             pin the versions, replace memory with sourced facts
4. pnmrvvtl-cover-edge-cases           build the edge-case matrix, decide every row
5. pnmrvvtl-follow-project-style       implement from the spec, the way this project works
6. pnmrvvtl-verify-for-real            prove behaviour and pixel match, then falsify
```

Load each one and follow it in full when you reach its phase. This file governs the sequence and
the gates between phases; the substance lives in the skills themselves.

## Wrong skill check

No design supplied, or the visual was handed over as loose reference rather than a contract?
Use `pnmrvvtl-full-cycle` — the spec-extraction phase is expensive and pointless without a
design to extract from.

## Why the spec comes before the implementation

`pnmrvvtl-match-the-design` phases 0–4 run here: identify the source and its fidelity ceiling,
pass the Figma token gate, extract every value into `design/<feature>.spec.json`, resolve the
font decision, declare the tolerance budget.

That file is the input to phase 3, not its output. Implementing first and measuring afterwards
is how a wrong page size or a wrong grid survives until the end.

## Gate 1 — after inspect-before-implement

- **Clear** → continue.
- **Unclear or partially clear** → ask and **stop**.

Design-specific questions belong here too, before extraction: which frame is authoritative,
which states exist, what happens at other breakpoints, what the longest real content is.

## Gate 2 — after the spec exists

Before any implementation code:

- the spec file is written and the fidelity ceiling is stated
- the Figma token gate passed, or the user was told it is missing and chose to proceed anyway
- the font decision is recorded
- the tolerance budget is in the file

Missing any of these means phase 2 is not finished. Do not start coding.

## Gate 3 — after check-the-docs

Runs every time, just before implementation, because that is where its output is used.
Its own Phase 0 decides how far it goes; its cheapest legitimate outcome is one line.

Design work sharpens the questions rather than replacing them: the spec commits to a shadow, a
blur, a gradient, a container query, a text-wrap mode or a transition timing function, and
whether that primitive exists in the resolved versions of the UI library, the CSS toolchain and
the target runtime is a version question, not a taste question.

Before implementation starts:

- the resolved version table exists, or every unresolved version is marked `unknown`
- every spec value that needs a library or platform feature is confirmed available in the
  resolved version, or listed as a known gap with the fallback named
- anything the docs and the repo disagree about is reported, not silently modernised
- an unresolved question that gates a line of code is asked and **stopped on**, like Gate 1

## Gate 4 — after cover-edge-cases

A design shows the happy frame. The matrix covers what it does not draw: 0 items, overflowing
text, missing images, error and loading states the design omits, invalid input. Where the design
has a frame for a row, the frame is the **spec** source; where it has none, the row falls through
to project, platform, then owner.

Before implementation starts:

- the edge-case matrix exists, with an expected behaviour and a source on every row
- every **owner** row is answered, or the user said to proceed and the default is recorded as an
  assumption — otherwise ask once and **stop**, like Gate 1

## Gate 5 — implementation reads the spec

`pnmrvvtl-follow-project-style` governs *how* the code is written — existing components, tokens,
state and API patterns. The spec governs *what values* it hits. Both apply: a raw hex copied
from the spec that duplicates an existing project token is a defect even when it renders
correctly.

Every matrix row is handled before verification starts.

## Gate 6 — one proof, two kinds of claim

Verification runs once, under `pnmrvvtl-verify-for-real`. The spec supplies the visual claims;
the change itself supplies the behavioural ones. Do not run two parallel proof procedures.

- behaviour — timing, state, async, endpoints, calculations
- appearance — geometry, colour, radius, opacity, shadow against the tolerance budget
- states — hover, active, focus, disabled, driven for real, one assertion set each
- transitions — declared values *and* an observed series showing it actually animates
- edge cases — every matrix row has a proof, or is listed as not covered with the reason

Anything the source could not express (Phase 0 ceiling) is reported as unverified, never as
passed.

For a UI change the report carries the "clicked N of M" line of `pnmrvvtl-verify-for-real/assets/observe.mjs` under both
profiles; without it this gate is not passed.

## Final gate — the proof is current

A proof covers the code it ran against, not the code that ships. Before every commit, push or
"done":

- Diff the code you are about to commit against the code the last real-runtime proof ran on
  (record that commit or stash hash when the proof passes). Any production change since then —
  a refactor, a lint fix, a rename, a deleted line "nobody needs" — makes that proof stale.
- Stale proof → re-run the probe or sweep for every matrix row the diff can reach, then commit.
  "Tests pass" does not refresh it; jsdom cannot see what the probe saw.
- The user checked a version in the browser? That check is also a proof, and it goes stale the
  same way. Tell them what changed since they looked.

**Commit-time gates close with tests, not with production edits.** A mutation, coverage, lint or
complexity gate that blocks the commit is fixed by adding or tightening tests, or by a disable
comment with the reason when the mutant is truly equivalent. Never delete or rewrite production
code to make a gate pass. A surviving mutant on a React `key`, an effect dependency or a CSS
class is rarely equivalent: it means the unit tests cannot observe identity, timing or layout,
and the fix is a test that can. If a production change is unavoidable, it is a behaviour change:
ask the user first, then re-prove it as above.

A report that says "not checked in the browser after the last change" means the task is **not
done**. Do not commit it; say what is unproven and run the proof, or ask the user.

## Option — the breaker

Off by default, because it costs a full extra agent. On when the user says "з перевіряльником", "with the breaker", or passes
`--breaker`. When it is off and the change touches scroll, animation, the URL or several repositories, offer it in one line
in the report.

Once the final gate has passed and before the commit, start one fresh subagent. It gets only the user's words for the task
verbatim, the URL of the running app and any test data. It does not get your summary, your matrix or your explanation: those
would teach it where you already looked. It may read code and may not change anything.

Its brief: "Break this. Report only what you reproduced, each with the steps, what you expected and what happened. Confirming
that something works earns nothing."

Reproduce every report yourself. Fix it, or say why it is not a bug. Then run the final gate again, since a fix makes the proof
stale. The report lists what it found and what became of each.

## Report

One report covering all six phases:

- what was clarified, and every assumption made
- the fidelity ceiling of the source, and every value whose `source` is `assumed`
- what the docs check changed about the plan, and any spec value the resolved versions cannot
  express natively
- the edge-case matrix, with each row's proof or "not covered"
- what was implemented, and which project primitives it reused
- the delta table: expected, actual, delta, in budget or not
- what is proven, at what tolerance, and what is **not** covered
- the commit the last real-runtime proof ran on, and that nothing in production code changed after it
- anything intentionally left out, with the reason

Keep `design/<feature>.spec.json`. Delete the harness. Evidence stays outside the repo, cited by
absolute path.
