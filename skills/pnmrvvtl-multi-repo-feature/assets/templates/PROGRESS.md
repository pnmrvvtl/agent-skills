# PROGRESS — {{FEATURE}} (one screen, always current)

Plan: `PLAN.md`. Resume: read `README.md` -> this file -> current `phases/NN-*.md`.

## Current

Phase <N> <STATE> (<date>): <the one or two sentences a stranger needs — what is green, what is red, what
is blocked and on whom>. Nothing committed yet / last commit `<sha>`.

## Phases

| # | Phase | State |
|---|---|---|
| 0 | Setup & baselines | todo |
| 1 | <name> | todo |
| ... | | |

## Job log (append: time · agent · packet · STARTED/DONE/FAILED · note)

<!-- Written BEFORE a job starts and AFTER it ends. FAILED always carries the reason (quota, timeout, bad report). -->
- <date> · <agent> · `<packet>` · STARTED · <out file>
- <date> · <agent> · `<packet>` · DONE · <what passed, re-verified by orchestrator>
- <date> · <agent> · `<packet>` · FAILED · <reason> -> reassigned to <agent>
