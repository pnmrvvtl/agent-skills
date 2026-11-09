# Packet NN — <one line, imperative>

Read `prompts/_rules.md` first. Repo: `{{MAIN_REPO}}`.
Environment rules unchanged: `cd {{MAIN_REPO}} && <command>` with forward slashes, absolute
`{{LIBRARY}}/...` for the library, temp files in `agent-scratch/` only, never open a PNG, never run git
commands, do not restart the dev server.

## Orchestrator's measured run

```
ts-check 0 · lint 0 · test:ci 0 · visual <p>/<s>/<f> · e2e <p>/<f>
```

```
<state table: one line per spec/state, with its measured percentage>
```

## Objective

<one paragraph: what this unit delivers and why>

## Files

| Path | Status |
|---|---|
| `<path>` | NEW |
| `<path>` | CHANGE |

## Behaviour rules

1. <exact, testable rules>

## Edge cases

- <edge case>

## 1. <first task, in priority order>

<the symptom, the method, the design source to compare against>

## 2. <second task>

## Non-goals / leave alone

- <file or area another agent owns, with the reason>
- <a parked state or blocked asset this packet must not touch>

## Acceptance criteria

- <measurable criterion>
- Checks 1-4 from `_rules.md` pass for your files.
- >=90% statements for every new or changed file.

## Gates

```bash
cd {{MAIN_REPO}} && npm run ts-check
cd {{MAIN_REPO}} && npm run lint
cd {{MAIN_REPO}} && npm run test:ci
cd {{MAIN_REPO}} && npx playwright test <e2e dir> --timeout 180000 --output=test-results/<tag>
cd {{MAIN_REPO}} && npx playwright test -c playwright.visual.config.ts --timeout 180000 --workers=1 --output=test-results/<tag>
```

Budgets unchanged. No masks, no compensating offsets, no baseline edits, no hand-drawn SVGs, no new
`test.fixme`, no bypassed hooks.

## Report

Per item: what changed, which gate proves it, and the measured numbers (global % and worst 32px cell % per
baseline). Name anything blocked, with evidence. Report `implemented, NOT verified: <gate>` where a gate is
still red.
