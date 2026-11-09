---
name: pnmrvvtl-verify-for-real
description: Prove a change actually works in the real runtime instead of only in mocks. Use when the user asks "are you sure", "prove it", "100%", "verify for real", "check it in a real browser", or after fixing anything about timing, animation, scrolling, transitions, async state, layout, an HTTP endpoint, a calculation, or a background job — where unit tests in jsdom/mocks cannot observe the behaviour. Builds a probe that records the real signal over time, falsifies it by re-running with the fix reverted, and reports what is proven and what is not.
---

# Verify For Real

Unit tests prove logic. They do not prove behaviour. A jsdom test has no smooth scroll, no
layout, no real clock, no network, no database. When the claim is about *what happens while
something runs*, the only evidence that counts comes from the real runtime.

A verification run that passes is worth nothing until you have seen it fail without the fix.

## Defaults

Unless the user says otherwise:

- **Bring the runtime up yourself.** Start the dev server, install the browser, seed nothing
  that already exists. Announce anything slow or large before running it. Stop only what you
  started; never touch a server that was already running.
- **Delete the probe when done.** It is scaffolding, not a deliverable. Report the numbers,
  remove the file, leave the tree clean. Keep it only if the user asks.
- **Never, without asking:** reset or migrate a database, kill processes you did not start,
  change ports or config files, commit, push, or force-push.

## Phase 0 — Is this warranted

This is expensive. Run it when at least one holds:

- the claim is about *time*: animation, transition, scroll, debounce, retry, race
- the claim is about *layout*: position, gap, overflow, sticky, responsive behaviour
- the bug was "state X disappears/flickers **during** Y"
- the fix already failed once, or the user doubts it
- the change crosses layers (store → component, handler → DB) where mocks hide the seam
- the user explicitly asks for proof

If a plain unit test genuinely covers the claim, say so and write that instead. Do not
perform verification theatre.

## Phase 1 — State a falsifiable claim

Write one sentence that a machine can refute. Not "the nav works". Instead:

> "After clicking a chip, that chip carries `isActive` in **every frame** from the click
> until the page stops scrolling."

Then name the **observable signal**: a DOM class, a computed style, an element rect, an HTTP
status/body, a DB row, a log line, a queue message. If you cannot name the signal, you cannot
verify — go back and sharpen the claim.

### Presence is not behaviour

"The panel appears", "the request fires", "the row exists" are existence claims. They pass on a
broken build that still renders the thing. If the user's words describe *how* it happens —
moves, slides, stays, never blinks, same as before — the signal must be the **trajectory of a
value**, not the existence of an element: a series of positions, opacities, colours, statuses.
Existence assertions belong in a unit test, not here.

### One claim per actor

List every actor the user can perceive inside the window: each element that moves, appears,
disappears, changes colour, plus every side effect (URL, title, request, stored state). Write
the list down *before* probing, and give each actor its own series and its own assertion.

A probe that tracks the one actor you were thinking about will happily pass while the three
next to it blink, jump or vanish. That is the most likely way this skill fails: not a wrong
answer, a narrow question. Enumerate first.

### Parity claims need a reference trace

When the requirement is "same as <other project / previous version / this other page>", absolute
thresholds you invent are worthless. Capture the **same series from the reference**, then assert
the port against those numbers: same actor set, same travel distance sign and magnitude, same
count of visible gaps (usually zero), same URL shape.

If the reference cannot be run, say so in the report and downgrade the claim to the properties
you could pin down independently. Never silently replace "same as X" with "looks fine".

## Phase 2 — Find the project's harness, do not invent one

Search before adding anything: `playwright.config.*`, `cypress.config.*`, `e2e/`, `tests/`,
vitest browser mode, `package.json` scripts, CI workflows, existing request/integration test
helpers, seed scripts, fixtures. Match their layout, naming and config. A probe that ignores
project conventions cannot be kept, and often cannot even run (Playwright only collects specs
inside its `testDir`).

If the repo has no harness at all, use the smallest thing that observes the real runtime
(a script driving the running app) rather than installing a new framework.

### Start from the recorder

For a UI change, run `assets/observe.mjs` before writing a probe:

```bash
node <skill>/assets/observe.mjs --base http://localhost:3000 --path /page --scope "#menu a" --open ".menuButton"
```

From the project root, so Playwright resolves. It takes the elements from the page rather than from you, clicks each under
a fast and a bad profile, records URL, position, rebuilt nodes, layout shift, errors per frame, and opens each resulting URL
fresh. Its output is the "clicked N of M" line the report needs. It is a floor and knows nothing about your task: write a
probe for whatever the claim adds, and treat a red line like any other (Phase 6: instrument or product?).

## Phase 3 — Bring up the real runtime

Check what is already running before starting anything. Record the preconditions you relied
on — base URL, build mode, fixture/slug/account used, browser and viewport. They belong in
the report; a proof without its environment is not a proof.

## Phase 4 — Build a probe that records a trace

The single most common failure is asserting only the **end state**. A bug that lives *during*
a transition is invisible that way.

- Sample the signal repeatedly over the whole window: every animation frame in a browser,
  every request/step on a server.
- Sample **every actor from Phase 1 in the same pass**, keyed by identity, not by position or
  index — one series per actor, all from one run so they share a clock.
- Store the samples (`{t, position, signal}`), then assert over **all** of them.
- Log the offending samples on failure. You will need them in Phase 6.
- Allow a tiny slack for the first commit/tick after the trigger, and say how much.
- Before trusting a green run, sanity-check the instrument: the trace must contain intermediate
  values (a jump means you sampled the wrong node), and each actor's series must actually vary
  when you expect it to.

Domain recipes: read `references/frontend.md` for browser work, `references/backend.md` for
servers, endpoints, calculations and jobs. Read only the one you need.

## Phase 5 — Falsify (mandatory)

Re-run the probe with the fix removed. It **must** fail, and the gap must be large and
explainable ("0 bad frames vs 32 of 37").

**Break the mechanism, not the feature.** Deleting the wiring — the `onClick`, the route, the
whole component — removes the trivial signal too, so a blind probe fails for the wrong reason
and you learn nothing. Falsify the smallest thing the claim actually depends on: the shared
animation registry, the transition binding, the debounce constant, the index, the cache header.
One falsification per mechanism, and per actor when actors are fixed by different mechanisms.

If it passes both ways, the probe is blind — fix the probe, not the code. If falsification is
impossible in this setup, say so explicitly in the report and do not present the green run as
proof.

Methods, ranked by safety, in `references/falsification.md`. Prefer a temporary git worktree
so the user's working tree is never touched.

## Phase 6 — Triage failures: probe or product?

When the probe goes red, the first question is always *"is this my instrument or the app?"*

Dump the raw trace before changing any product code. Tool artifacts are common and convincing:
auto-scrolling before a click, recorder stopping early, clicks landing outside the viewport,
hashed class names, animations disabled in headless mode. Confirm the failure is real by
reading the trajectory, then fix.

A real finding here is the point of the whole exercise — this phase is where verification
earns its cost.

## Phase 7 — Report honestly

Use `assets/proof-report.md`. It must contain:

- the claim, verbatim
- the method and what was sampled
- **one row per actor** from Phase 1, with its numbers — and, for parity work, the reference
  column beside them; an actor with no row goes under "not covered"
- **A/B numbers**: with fix vs without fix, one falsification row per mechanism
- the environment: URL, build mode, browser/runtime, viewport, data used
- **What is NOT covered** — other browsers, devices, touch input, production build,
  concurrency, other data shapes
- **Coverage**: elements clicked of elements found, under which profiles, how many runs

The "not covered" section is not optional. Without it "100%" is marketing.

Record the commit or stash hash the proof ran on. Any production edit after it makes the
proof stale; re-run before committing.

## Phase 8 — Clean up

Delete the probe (default), leave the working tree exactly as you found it, and confirm no
stash, worktree, or background process was left behind. Mention the leftovers you could not
remove (installed browsers, caches) and where they live.

## Anti-patterns

| Anti-pattern | Why it fails |
|---|---|
| Asserting only the final state | Blind to "state disappears during X" bugs |
| Sampling existence over time instead of the value | "It is on screen in every frame" passes while it teleports, blinks or renders in the wrong place |
| Probing one actor when the interaction moves five | The other four keep their bugs; the report still says "verified" |
| "Same as project X" checked against invented thresholds | Parity is a diff; without the reference trace there is nothing to diff against |
| Falsifying by deleting the feature | Removes the signal too, so a blind probe still fails — no evidence about the mechanism |
| Matching a moving element by nearest position | Latches onto a static twin the moment the real one moves faster than the gap |
| Trusting computed styles over pixels after the user reports a visual bug | `opacity: 1` on a node the compositor draws somewhere else, or not at all, still reads as healthy — screenshot the frames instead |
| Verifying a UI port with behaviour probes only | Links, clicks and requests can all be correct while the colours, icons, images and spacing are not — run the visual parity gate |
| Trusting jsdom for timing or layout | No real clock, no scroll, no layout engine |
| Screenshot diffs for timing bugs | One frame, arbitrarily chosen |
| A probe that passes without the fix | Proves nothing; it is a decoration |
| `sleep` instead of sampling | Averages away the exact frames that carry the bug |
| Changing product code the moment the probe goes red | Half the time it is the probe |
| "Tests are green, so it works" | No environment, no exclusions, no falsification |
| Proof taken before the last production edit | It proves a version that no longer exists; re-run the probe after every production change, including ones made to satisfy a lint, coverage or mutation gate |
