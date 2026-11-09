---
name: pnmrvvtl-progress-pulse
description: Emit one-line progress pulses during long AI-agent work (multi-hour implementations, refactors, benchmark campaigns, batch jobs) so the user always knows the time, current step, sub-progress, overall percent, blockers and next step. Also appends each pulse to PROGRESS.log. Use when the user asks for progress reports, status updates, notifications, "keep me in touch", "where are we", "how many percent", or starts a large multi-step or long-running task.
---

# Progress pulse

One line per significant change. Numbers, not prose.

## Format

```
HH:MM === <doing now> === <sub-progress> === all <P>% === <blockers> === next: <step>
```

Examples:

```
12:08 === doing unit tests === covered 13/25 files === all 76% === no blockers === next: e2e auth flow
14:31 === integration checks === run 7/12 === all 58% === BLOCKER: test service unavailable === next: retry service
16:02 === done: api layer === 9/9 endpoints === all 90% === no blockers === next: final review
```

- `HH:MM`: local clock time, from `date +%H:%M`. Never relative ("5 min ago").
- `<doing now>`: 2-5 words. Prefix `done:` when the pulse closes a step.
- `<sub-progress>`: counted `n/N` of the current step's unit (files, tests, runs, endpoints).
- `all <P>%`: overall percent (see below). Add ` ETA HH:MM` only from a measured rate.
- `<blockers>`: `no blockers`, or `BLOCKER: <what> — <what's needed from the user>`.
- `next:`: the next concrete step.
- At most ~160 characters. No markdown, no emoji, no sentences around it.

## Percent must be counted, never guessed

At the start, write the plan as a numbered list of steps with rough weights (default equal),
and state the total once: `plan: 8 steps`. `all P%` = weight of finished steps plus the
current step's `n/N` share. When the plan changes, recount and say so inside the pulse:
`all 61% (plan 8->10 steps)`. The percent may go down; that is honest, not a failure.

## When to pulse

- a step starts or finishes
- a blocker appears or clears
- the plan changes (steps added, dropped, reordered)
- overall percent crosses a 10% boundary
- a long-running job (build, test suite, benchmark, background agent) starts or ends
- heartbeat: before any response if ~30 min passed since the last pulse on a long job
- whenever the user asks "where are we" / "progress" / "%"

Not for: every file edit, every tool call, trivial tasks under ~10 minutes.

## PROGRESS.log

Append every pulse, unchanged, to `PROGRESS.log` in the working root (or the campaign/run
directory for long jobs):

```bash
echo "$(date +%F) <pulse line>" >> PROGRESS.log
```

- Log lines carry the date; chat lines don't need it.
- Never rewrite old lines. The log is the history that survives context compaction:
  after a compaction or a new session, read its tail before the first pulse.
- In a git repo, keep it out of commits without touching `.gitignore`:
  `grep -qx PROGRESS.log .git/info/exclude || echo PROGRESS.log >> .git/info/exclude`.

## Final pulse

Last line of the work: `HH:MM === done: <task> === <final counts> === all 100% === <open issues or none> === next: <user decision or nothing>`.
Below 100% because of skipped or failed steps? Say which in `<blockers>`, never round up.
