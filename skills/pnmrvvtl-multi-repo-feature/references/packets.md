# The packet, and the rules every implementer reads

The packet is the entire interface between orchestrator and implementer. The orchestrator writes it; an
agent executes it; the orchestrator reviews the diff and re-runs the gates. A packet that failed becomes a
**new** packet with the measured failures in it — never a re-send of the same text.

Keep packets short. The version that worked fits on one screen and opens with the **measured state**, not
a description of the feature.

## Packet template

```markdown
# Packet NN — <one line, imperative>

Read `prompts/_rules.md` first. Repo: `<main-repo-path>`.
Environment rules unchanged: `cd <repo-path> && <command>` with forward slashes, absolute
`<library-path>/...` for the library, temp files in `agent-scratch/` only, never open a PNG,
never run git commands, do not restart the dev server.

## Orchestrator's measured run
<!-- the CURRENT numbers, so the agent starts from reality, not a story -->
ts-check <errors> · lint <errors> · test:ci <exit> · visual <passed>/<skipped>/<failed> · e2e <passed>/<failed>
```
<state table: one line per spec/state, with its measured percentage>
```

## 1. <first task in priority order>
<why it matters, the exact symptom, the method to fix it>

## 2. <second task>
...

## Leave alone
<the things the agent must NOT touch, and why — other agents' files, a parked state, a blocked asset>

## Gates
```bash
cd <repo-path> && npm run ts-check
cd <repo-path> && npm run lint
cd <repo-path> && npm run test:ci
cd <repo-path> && npx playwright test <e2e dir> --timeout 180000 --output=test-results/<tag>
cd <repo-path> && npx playwright test -c playwright.visual.config.ts --timeout 180000 --workers=1 --output=test-results/<tag>
```
Budgets unchanged. No masks, no compensating offsets, no baseline edits, no hand-drawn SVGs, no bypassed hooks.

## Report
Per item: what changed, which gate proves it, and the measured numbers. Name anything blocked, with evidence.
```

For a **feature build** packet (rather than a fix), replace the numbered fixes with the shape that worked
best: **Objective · Files (NEW/CHANGE table) · Behaviour rules · Edge cases · Acceptance criteria ·
Non-goals.** Non-goals carry as much weight as goals: they are how parallel agents stay out of each
other's way.

## What makes a packet good

- **Opens with the measured state.** Every state carries its number. An agent given "the grid is wrong"
  wanders; an agent given "`<node-id>` at <measured-diff>%" starts.
- **One task list in priority order.** The first item is the one that unblocks the most ("fix the shared
  state; related views reuse the same component").
- **Names the design source per element.** "Compare the worst band's boxes to `figma/nodes/<file>.json`
  (extract with `node -e`, never read whole)." A value with no design source is a fudge.
- **Names the sibling to copy.** "New icons copy the sizing convention of their siblings (40×40 with a
  ~21px padded glyph); name the sibling explicitly" (L-011).
- **Includes the exact gate commands**, so the agent's own run matches the orchestrator's.
- **Ends with "report per item with the measured number."** Not "describe what you did" — a number, so a
  claim that drifts can be caught by comparing tables.
- **States the definition of done.** "Your unit is done only when its mechanical gates are green;
  otherwise report `implemented, NOT verified: <missing gate>`."
- **Names any file that must not change** when another agent is active, with the reason.

## `_rules.md` — the distillation

Every packet says "read `_rules.md` first". This is that file, stripped to what transferred:

```markdown
## Context you must read
AGENTS.md (repo contract), the repo's rule docs, DECISIONS.md. Decisions there are final; your
packet's Files and Non-goals define your scope.

## Hard rules
- Never run git commit/push/stash/reset/checkout/clean. Never --no-verify. Leave changes uncommitted.
- Do not touch files outside your packet scope; another agent may be working now. Ignore (and report)
  tsc/eslint errors in files you did not touch — do not fix them.
- TypeScript: no any, no `as unknown as`, no @ts-ignore/@ts-expect-error, no non-null !, no eslint-disable.
- Follow the project style; no new npm dependencies.
- Only the network is mocked. Everything else is production code (real stores, errors, loading states).
- Coverage: every new/changed source file needs >=90% statement coverage from tests next to it.
- Security: never render unsanitised HTML; no eval; no tokens or personal data in web storage.
- Large design JSON is never printed whole; extract fields with a small node script.

## Never read an image, measure it
Every step re-sends the whole conversation, so a PNG costs thousands of tokens once and then rides
along on every later step. Do not open a PNG with your read tool (crop, baseline, -actual, -diff).
Measure it with a few lines of `sharp`: differing ratio, worst rows and cells, ink extents, box
coordinates. Keep probe output to a few lines. If something needs an eye rather than a number, write
the question into a short note and stop.

## Where temporary files go
Every throwaway goes into `agent-scratch/` inside the repository. Never write outside the repo (the
CLI's directory permission check will refuse it and the run ends). `scratchpad/` is the orchestrator's
and is never written to or cleared. Anything worth keeping goes into the committed knowledge base.

## Checks to run before you finish
1. npx tsc --noEmit -p .            (report out-of-scope errors, do not fix)
2. npx eslint --max-warnings 0 <your changed files>
3. npx vitest run <your test files> --coverage.enabled=false
4. node <api-spec check>, only if you added mock routes

## Report (last message, <=40 lines)
- files created/changed, one line each with a short purpose
- checks run and their results
- anything undone, any assumption, anything surprising

## Definition of done
Done only when the mechanical gates are green (unit tests, e2e, and for anything visual the pixel
comparison plus geometry). Otherwise report "implemented, NOT verified: <missing gate>". Never
redraw or approximate a design asset, and never pick one by name — take the export verbatim, mapped
by geometry.

## Inspect before you implement
Search the inventory / the repos first; reuse or extract before building. Present the decision as a
table: needed -> existing candidate (path) -> reuse/extract/new + why. A duplicate fails the reuse gate.
```

## Changing a rule

`_rules.md` is shared by every packet, so a change there applies everywhere. When a new gate or a new
forbidden pattern appears, add it to `_rules.md` and say what changed and why — do not leave it only in
one packet's body. A rule that lives in one packet is rediscovered the hard way in the next one.
