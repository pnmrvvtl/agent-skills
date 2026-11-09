# The knowledge base, and the mock-adapter pattern

Two things make a multi-repo feature survivable: a committed directory a fresh session can resume from,
and a way to build the whole UI before the backend exists. Both are contracts, not notes.

## Layout

```
<feature-dir>/
  README.md          resume protocol, roles, agent command lines, rules. The front door.
  PROGRESS.md        ONE screen: current phase, phase table, in-flight job log. Always current.
  DECISIONS.md       locked decisions D-NN with date; assumptions below, may be overridden.
  KNOWLEDGE.md       project facts and traps (K-NNN, dated, append-only).
  LESSONS.md         process lessons (L-NNN, dated, append-only) -> raw material for a future skill.
  GATES.md           every gate: command, threshold, baseline value, A/B proof status.
  API-SPEC.md        backend contract for every mocked endpoint. Gate-checked.
  PLAN.md            the full plan + definition of done.
  phases/NN-*.md     checklist + acceptance criteria per phase, ending with CHECKPOINT: gates green.
  prompts/           the exact packets sent (reproducible, reviewable); `_rules.md` is shared.
  baselines/*.json   measured numbers (coverage, duplication, dependency ids). Prose summarises; JSON is the record.
  BLOCKED-*.md       what is blocked on whom, with the measured cost of staying blocked.
  REPORT-P*.md       end-of-phase narrative: blockers, solutions, state.
```

## Resume protocol

A fresh session (or one after compaction) reads **exactly this** and nothing else:

1. `PROGRESS.md` — one screen: the current phase, the phase table, and the job log.
2. the current `phases/NN-*.md` — work on its first unchecked item.
3. `DECISIONS.md` before any choice that looks open; it is probably already decided.
4. `KNOWLEDGE.md` when something behaves oddly; the trap may already be recorded.

Everything else is loaded on demand. This is why `PROGRESS.md` must stay short: detail belongs in the
phase file, never in the one file everyone reads.

## Rules that keep it honest

- **The job log is written before a job starts and after it ends**, one line each:
  `time · agent · packet · STARTED/DONE/FAILED · note`. `FAILED` always carries the reason (quota, timeout,
  bad report).
- **Every discovery, failure or workaround is recorded the moment it happens**, before continuing — the
  fact to `KNOWLEDGE.md`, the process lesson to `LESSONS.md`. Writing it later from memory loses it.
- **Numbers live in `baselines/*.json`.** Prose summarises; JSON is the record every later phase is judged
  against.
- **Corrections are written down, not edited away.** If an earlier measurement was wrong, say it was wrong
  and what the real number is; silently fixing a number destroys the reader's ability to trust the rest.
- **Blockers get their own file** (`BLOCKED-<area>.md`) naming each missing thing, where it is used, and
  the measured cost of it staying missing. A blocker is a first-class deliverable, not a silenced skip.
- **The prompt directory is the audit trail.** The packets that failed and the ones that replaced them are
  kept, so the next run can learn from them.

## The mock-adapter pattern

When the UI must be built before the backend exists, mock **only the network** and keep everything else
production. Keep routing, stores, optimistic updates, error recovery and navigation real so the UI
can be verified before the production backend is available.

Shape it as one transport:

- `transport.ts` exports `get`/`post`/`put`/`patch`/`del`/`postFormData` with **identical signatures** to
  the real client. Each call reads `NEXT_PUBLIC_<FEATURE>_API_MOCK` **inside the function** (not at module
  load, so tests can toggle it): off → delegate to the real client, on → the mock. Swapping to the real
  backend is one env var.
- `mock/router.ts`: `route('GET', '/resources/:id', handler)` with `:param` segments. The gate greps
  this exact shape.
- `mock/db.ts`: in-memory, lazily seeded from fixtures, persisted for the tab session, with a `resetMockDb()`
  for tests. It must only run in the browser and must throw cleanly if called during SSR.
- `mock/delay.ts`: realistic random latency, 0 under vitest and with an explicit `..._DELAY=0` flag, so
  e2e and visual runs are deterministic.
- `mock/fixtures/`: realistic names and fixed ISO dates, copied from the design so a visual diff is
  meaningful and repeatable. Enough items to need several pages.
- Errors return the real status codes (400/404/409/413/422) in the real client's body shape, so the UI's
  error and validation states are exercised for real, not hand-simulated.
- Named **scenarios** (a cookie list of overlays) let a test or a visual spec load the exact design state
  (empty, partial, filled) without special-casing the fixtures.

Only mock the scope agreed with the humans. A feature-specific mock must not replace unrelated
calls to a shared API elsewhere in the application.

### The API-SPEC gate

`API-SPEC.md` is the backend contract and the reason the mock is not a dead end. One `### METHOD /path`
section per mocked route, each with purpose, request params/query/body types, response type and a small
JSON example, status codes, validation, side effects and the frontend callers.

The gate is mechanical: parse the mock route table and assert every route has a matching heading. A route
without a spec fails the build, so the contract cannot drift from the mock. At the end, the route count in
the spec equals the mock table count — that equality is the proof the backend team has the whole surface.
