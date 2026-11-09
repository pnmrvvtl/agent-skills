---
name: pnmrvvtl-multi-repo-feature
description: Coordinate a large feature across repositories, phases or delegated implementers. Use when work must resume across sessions, a design is the implementation contract, or the UI is built against a mock API. The orchestrator owns packets, a committed knowledge base and independently verified gates; implementers write scoped code. Avoid this workflow for a small change in one repository.
---

# Multi-repo feature

A feature that spans several repositories, several phases and several delegated agents fails in one of
four ways: an agent reports green when it is not, the design and the product silently diverge, the cost
of delegation balloons, or the work cannot be resumed because the state lived only in a context window.
This skill makes all four hard.

The model in one paragraph: **one orchestrator owns the plan, the packets, the gates and the verdict and
never writes feature code; each unit is sent to an implementer as a written packet under a watchdog;
every claim the implementer makes is re-run by the orchestrator before it is believed; the design is the
source of truth; and all state lives in a committed knowledge base so a fresh session resumes from one
file.**

## When to use this

Use it when the work is too big for one agent and one session: a feature across a main app, a shared
library and a host app; a multi-phase build; a UI built against a mock API before the backend exists.

**Do not use it** for a one-repo, one-session change. `pnmrvvtl-follow-project-style` and
`pnmrvvtl-verify-for-real` are enough there; the packet and knowledge-base overhead is only earned when
work spans repos, sessions or agents.

## The six rules

Use these rules to keep delegation bounded and independently verifiable.

### 1. The orchestrator decides; the implementer writes

The orchestrator writes packets, gate scripts, the knowledge base and the design extracts; reviews diffs;
runs the gates; and rules on stop-loss. It **never writes feature code**. Why: an agent that both writes
and judges its own work reports green when it is not. When the only remaining option is the orchestrator
writing code, that is itself a signal to stop and report, not to proceed quietly.

### 2. Verify every claim — re-run the gates yourself

An agent may report green without running new specs, or skip failing visual states to make a
suite pass. An agent's report, however detailed, is an **input, not a verdict**. After every packet the
orchestrator re-runs ts-check, lint and the tests, and re-measures any visual number the packet claimed.
The status wording is `implemented, NOT verified: <missing gate>` until the gate is green — never "done".

### 3. Cost is context × steps

Every tool call re-sends the whole conversation, so a look at one PNG is paid for on every later step.
Large design images can inflate repeated context and increase cost. Therefore: **ban image reads in packets** (the orchestrator is the only one who looks at
pictures and translates what it sees into a written defect list); extract from large JSON with a script;
keep sessions short; and check the free route is really down before paying for another one.

### 4. Gates must be ungameable

A global pixel budget hides a wrong 20px icon (0.14% of a modal); an invalid CSS declaration silently
degrades; a `test.skip` makes a red suite green. So: per-region comparison as well as global; named
exceptions each carrying a measured number and a cause; thresholds ratcheted to the value actually
reached; and every gate proven red-then-green (the A/B rule) before it is trusted. The list of
gate-gaming patterns that were actually caught is in `references/gates.md`; `scripts/scan-gate-gaming.mjs`
scans a tree for the mechanical ones.

### 5. The design is the source of truth — and it can contradict itself

Assets come from the design export verbatim, mapped by geometry; never redrawn, approximated or picked by
name. But a design handoff is a **snapshot, not a specification**: several frames of one screen can carry
different data. When they disagree, measure every frame against the built page, prove the contradiction
from the node JSON, park the disagreeing states with their measured numbers and a re-enable condition, and
**report to the human** — never reshuffle product data to match a picture. See `references/design.md`.

### 6. Resume from files, never from memory

`README` → `PROGRESS` (one screen) → current `phases/NN-*.md` is the whole resume protocol. Every job is
written to the log before it starts and again when it ends. Every discovery, failure or workaround goes
into `KNOWLEDGE.md` (facts) or `LESSONS.md` (process) the moment it happens. Layout in
`references/knowledge-base.md`.

## The loop

```
phase 0: baselines + thresholds + knowledge base + A/B-proven gates
for each phase:
  1. orchestrator writes a packet (measured state, one task list, rules, gate commands, report format)
  2. dispatch one implementer through the watchdog (references/delegation.md)
  3. implementer returns code + evidence
  4. orchestrator re-runs every gate and re-measures every claim (rule 2)
  5. orchestrator accepts, corrects (a new packet with the measured failures), or parks with evidence
  6. update PROGRESS, DECISIONS, KNOWLEDGE/LESSONS; commit once all gates are green
```

One writer per repository at a time; parallel units only across disjoint file sets, and the disjointness
is named in both packets. An agent-agnostic packet means a reassignment costs nothing when a model hits a
quota.

## The packet

The packet is the whole interface between orchestrator and implementer, and keep it
short: **objective; a table of files with NEW/CHANGE; behaviour rules; edge cases; acceptance criteria;
non-goals; the exact gate commands; and "report per item with the measured number".** It opens with the
current measured state, not a description of the feature. Template and the distilled agent hard rules
(no git, stay in scope, no `any`, never read an image, scratch directory, report format) are in
`references/packets.md`.

## Delegation mechanics

Long or external commands never run bare. Wrap every agent CLI in the `pnmrvvtl-no-freeze` watchdog
(closed stdin, hard timeout, idle timeout, hung-after-done kill). The provider failure modes seen in
practice — a `Bad Request` that names only the model, `ProviderHeaderTimeoutError`, directory-permission
refusals, context overflow — and how to resume with `--continue` rather than restart are in
`references/delegation.md`.

## The mock-adapter pattern

When the UI must be built before the backend exists, mock **only the network** and keep everything else
production: real routing, stores, optimistic updates, error handling and loading states. One transport
whose identical signatures can either hit the real client or an in-browser mock (latency, validation,
tab-session persistence), swapped by a single env var. The mock's route table is the contract, and an
API-SPEC gate asserts every route has a written `### METHOD /path` section, so the backend team builds
against a checked spec. Detail in `references/knowledge-base.md`.

## Reporting

At the end of every packet and every phase, in the file and to the user: the **numbers before against
after** for every metric touched; what changed and **what was deliberately left alone, with the reason**;
the gate that proves it; and anything unverified, stated plainly. Do not report a phase complete while
any gate is red or any claim is unmeasured.

## Making it real

Ship the two scripts: `scripts/scaffold.mjs` creates the knowledge-base skeleton (idempotent), and
`scripts/scan-gate-gaming.mjs` scans a tree for the mechanical gate-gaming patterns. Templates for every
knowledge-base file are in `assets/templates/`.

## Maintaining this skill

Edit it from real runs. When a feature running under it hits a weak spot — a packet that had to be
re-sent, a gate that could not be A/B proven, a trap that cost hours — fix this skill in the same session
and say what changed. A methodology skill that is not updated from runs decays into folklore. The
generic failure-mode index is `references/lessons.md`.
