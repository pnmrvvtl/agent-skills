---
name: pnmrvvtl-full-cycle
description: Run a complete delivery pipeline for a change with no supplied design — clarify before coding, ground the work in version-pinned facts, implement natively to the project, then prove it in the real runtime. Use when the user asks for the "full cycle", "the usual", "do it properly", "no shortcuts", or invokes this skill by name. Chains pnmrvvtl-inspect-before-implement, then pnmrvvtl-check-the-docs, then pnmrvvtl-cover-edge-cases, then pnmrvvtl-follow-project-style, then pnmrvvtl-verify-for-real, in that order. If a design (Figma link, PDF, screenshots) was supplied, use pnmrvvtl-full-cycle-from-design instead.
---

# Full Cycle

Five skills, one order, no skipping:

```
1. pnmrvvtl-inspect-before-implement   understand and clarify, write no code
2. pnmrvvtl-check-the-docs             pin the versions, replace memory with sourced facts
3. pnmrvvtl-cover-edge-cases           build the edge-case matrix, decide every row
4. pnmrvvtl-follow-project-style       implement the way this project already works
5. pnmrvvtl-verify-for-real            prove it in the real runtime, then falsify
```

Load each one and follow it in full when you reach its phase. This file only governs the
sequence and the gates between the phases; the substance lives in the skills themselves.

## Wrong skill check

If the user supplied a design — a Figma link, a design PDF, design screenshots — and expects the
result to match it, this is the wrong skill. Say so and use `pnmrvvtl-full-cycle-from-design`,
which inserts the design-spec extraction between clarification and implementation.

## Gate 1 — after inspect-before-implement

Do not start editing files on your own judgement of "clear enough".

- **Clear** → state the scope, then continue to phase 2.
- **Unclear or partially clear** → ask the questions and **stop**. Wait for the answer. A guess
  made here is a rewrite later.

Exception: the user said up front to proceed without asking. Then record the assumptions
explicitly and carry them into the final report.

## Gate 2 — after check-the-docs

This phase runs every time; its own Phase 0 decides how far it goes, not whether it runs. Its
cheapest legitimate outcome is one line — "skipped, the repo already does this at `path:line`" —
and that line still has to be produced.

Before implementation starts:

- the resolved version table exists, or every unresolved version is marked `unknown`
- no API is about to be written on unsourced memory alone
- anything the docs and the repo disagree about is **reported, not silently modernised**
- an unresolved question that gates a line of code is asked and **stopped on**, like Gate 1

An upgrade the docs suggest is not in scope unless the user asked for it. Flag it, keep going.

## Gate 3 — after cover-edge-cases

Before implementation starts:

- the edge-case matrix exists, with an expected behaviour and a source on every row
- every **owner** row is answered, or the user said to proceed and the default is recorded as an
  assumption — otherwise ask once and **stop**, like Gate 1

## Gate 4 — after follow-project-style

Before verification, the change must be complete, not a sketch. Every matrix row is handled. If
part of the scope turned out to be blocked, finish everything else and name what was left out and
why — do not quietly narrow the task and then verify the narrowed version.

## Gate 5 — verify-for-real is not optional

Its own Phase 0 decides *how much* verification is warranted, not *whether* to verify. If a
plain unit test genuinely covers the claim, that skill says so and you write the test — that is
still passing through the gate, not skipping it.

If the change touches timing, layout, animation, async state, an endpoint, a calculation or a
background job, mocks cannot see it. Build the probe.

Every edge-case matrix row has a proof, or is listed as not covered with the reason. For a UI change the report carries the
recorder's "clicked N of M" line under both profiles; without it the phase is not finished.

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

One report at the end, covering all five phases:

- what was clarified, and every assumption made
- what the docs check changed about the plan, or that it changed nothing
- the edge-case matrix, with each row's proof or "not covered"
- what was implemented, and which existing project primitives it reused
- what is proven, at what tolerance, and what is **not** covered
- the commit the last real-runtime proof ran on, and that nothing in production code changed after it
- anything intentionally left out, with the reason

Do not report the task complete while any phase's own completion criteria are unmet.
