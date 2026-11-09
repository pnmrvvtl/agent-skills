# {{FEATURE}} — knowledge base

Feature: {{FEATURE}}. Repos: `{{MAIN_REPO}}` (main), `{{LIBRARY}}` (shared library), `{{HOST}}` (host app).
Branch in all repos: `{{BRANCH}}`. Commit locally once per phase, after the gates are green. **Never push.
Never bypass hooks.**

## Resume protocol (fresh session / after compaction)

1. Read `PROGRESS.md` (one screen). It has the current phase and the job log.
2. Read the current `phases/NN-*.md`, then work on its first unchecked item.
3. Read `DECISIONS.md` before any choice that looks open. It is probably already decided.
4. Look in `KNOWLEDGE.md` when something behaves oddly. The trap may already be recorded.

## Files

| File | Purpose |
|---|---|
| PLAN.md | full plan + definition of done |
| PROGRESS.md | current state + append-only job log (STARTED/DONE/FAILED per agent job) |
| DECISIONS.md | locked decisions (D-NN) and assumptions |
| KNOWLEDGE.md | project facts and traps (K-NNN, dated) |
| LESSONS.md | process lessons -> raw material for a future skill (L-NNN, dated) |
| GATES.md | every gate: command, threshold, baseline, A/B proof |
| API-SPEC.md | backend contract for every mocked endpoint (`### METHOD /path`; gate-checked) |
| phases/NN-*.md | checklist + acceptance criteria per phase, ends with CHECKPOINT |
| prompts/ | exact packets sent to implementers; `_rules.md` is shared by all |
| baselines/ | measured numbers (coverage, duplication, dependency ids) |
| BLOCKED-*.md | what is blocked on whom, with the measured cost |

## Rules

- Write a job to the PROGRESS.md job log before it starts and again when it ends.
- Record every discovery, failure, workaround or limitation right away: project facts -> `KNOWLEDGE.md`,
  process lessons -> `LESSONS.md`.
- The orchestrator writes documents, gate scripts, design extracts and packets. Feature code comes from
  delegated implementers. **The orchestrator never writes feature code.**
- Gates: `<single entry command>`. It runs all repos and prints one table, non-zero on any red.
- Re-run every gate yourself. An agent's report is an input, not a verdict.

## Agent command lines

Fill these in for the environment, one line per implementer:
- `<implementer A>`: `<exact command line>`
- `<implementer B>`: `<exact command line>`
- `<optional local implementer>`: `<exact command line and measured runtime limits>`.

Wrap every run in the `pnmrvvtl-no-freeze` watchdog with a hard and an idle timeout.
