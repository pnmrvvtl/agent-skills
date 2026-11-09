---
name: pnmrvvtl-cover-edge-cases
description: Make a feature survive the inputs and states nobody wrote into the prompt — missing, empty, invalid, too long, wrong format, wrong locale, zero items, overflow, items revealed later, failed requests, double submits, another user's data. Maps the change into dimensions, crosses them, checks universal invariants in every reachable state with a sweep in the real runtime, and decides, handles and proves every row of an edge-case matrix. Works for frontend (forms, lists, sliders, any component) and backend (endpoints, jobs, calculations). Use when implementing or reviewing a feature, when the user says "edge cases", "corner cases", "unhappy path", "what if the user enters…", "make it robust", "bulletproof", "validate everything", or as the edge-case phase of pnmrvvtl-full-cycle and pnmrvvtl-full-cycle-from-design.
---

# Cover Edge Cases

The prompt describes the happy path. Real users and real clients send everything else. A feature
is not done when it works with the example data; it is done when every state it can reach holds
the invariants and every input it can receive has a decided, implemented and proven behaviour.

Most escaped bugs are not a missing case. They sit on the **intersection** of two cases that were
each checked alone: hover works, the overflow popover works, hover inside the popover does not.
A list of cases cannot enumerate every intersection. Crossing dimensions and checking invariants
in every state can.

## Scope rule

An edge case is an input or state that **can reach this code** in production. It is not a new
feature. Do not add a field, a setting or a flow the task did not ask for.

Frontend and backend each own their side. Client validation is UX; server validation is the
authority. Never treat one as a substitute for the other.

## Phase 0 — Depth

- one-line fix, pure function → Steps 1–4 and unit tests; no sweep
- component, page, form, endpoint, job → everything, including the sweep in Step 6

Say which, in one line.

## Step 1 — Map the surface

From the code and the task, not from memory:

- **Inputs** — form fields, props, URL/query params, request body, headers, files, env, stored data read back
- **Items** — every repeated or decorated element, and every **behaviour** it has: hover, focus,
  active, underline, tooltip, truncation, click target, animation
- **Actors** — anonymous, expired session, owner, another user, lower role
- **Dependencies** — API, database, queue, third-party service, clock, storage

## Step 2 — Dimensions

Turn the surface into dimensions, each with its values. Take values from the lenses.

| Lens | Values |
|---|---|
| Presence | absent, `null`, `""`, whitespace only, absent vs explicit `null` |
| Type and format | wrong type (`"12"` vs `12`, array vs object), malformed email/URL/date, phone in another country's format, unknown extra fields |
| Size and range | 0, 1, exactly what fits, fits + 1, min−1, min, max, max+1, negative, decimals, 10k-char text, huge number, 1000+ items, large file |
| Content | Unicode, emoji, RTL, leading/trailing spaces, newlines, HTML/`<script>`, quotes and SQL-like characters, duplicates, case variants |
| Render path | initial render, revealed later (hover, click, "show more", overflow popover, tab, accordion), inside a portal or tooltip, mounted while hidden (`display:none`, zero size), after resize, after refetch, after reorder / insert / remove (element identity, list `key`) |
| UI state | loading, error, slow response, partial data, stale data, offline, missing image, images and fonts still loading during the action |
| Interaction | hover, focus by keyboard, active, disabled, touch, double click, click on the already active item (deselect), rapid clicks during a transition |
| Viewport | narrowest supported, widest, zoom 200%, font not loaded yet |
| Time | time zone, DST change, month end, leap day, past vs future, expired |
| Order and concurrency | double submit, two tabs, refresh or back mid-flow, retry, out-of-order responses, the same action repeated (a bug that happens "not always" needs many runs) |
| URL and history | every action that can change the URL: hash, query, redirect; the final URL opened fresh, reloaded and reached by Back; a link to something not rendered yet |
| Identity | not logged in, session expired mid-action, other user's id in the URL or body, insufficient role |
| Dependencies | network down, timeout, 4xx, 5xx, unexpected response shape, DB constraint violation |
| Locale | decimal comma, currency, postal and phone formats, long translations |

Skip a lens that cannot apply, in one word ("n/a: no dates").

## Step 3 — Cross

- **Every item behaviour × every render path, fully.** An item that can reach the screen two ways
  has two rows per behaviour.
- Every extreme value of every dimension alone.
- Remaining dimensions pairwise: every pair of values appears in at least one state.

The result is the list of **states** the sweep must reach.

## Step 4 — Decide the expected behaviour

Every specific row gets an expected behaviour and a source, in this order of authority:

1. **spec** — the task, the ticket, the design, the API contract
2. **project** — how the same case is handled elsewhere in this repo (cite `path:line`)
3. **platform** — framework, HTML, HTTP or library default (e.g. `422` with field errors)
4. **owner** — no source decides it and the choice is visible to users

Ask only the **owner** rows, all in one message, each with a proposed default. If the user said
to proceed without asking, take the defaults and list them as assumptions.

## Step 5 — Invariants

Invariants hold in **every** state, whatever the spec says. They catch the bugs nobody wrote a
row for. Read the list for the side you touch — `references/frontend.md` or
`references/backend.md` — and add any invariant specific to this feature ("the total equals the
sum of the rows", "the selected tab is always visible").

## Step 6 — Matrix, implementation, sweep

**Matrix.** Keep it in the working notes or the PR description, not a new repo file unless asked.

```
| # | State / case | Expected | Source | Proof |
|---|--------------|----------|--------|-------|
| 1 | location in overflow popover × hover | underline under its text, same as inline | invariant F1, F2 | sweep: rect check + screenshot |
| 2 | PATCH /users/:id with another user's id | 403, no write | project src/api/orders.ts:41 | sweep: request + row hash |
| 3 | 0 locations | block hidden, no stray separator | owner (default: hide) | sweep: screenshot |
```

**Implementation.** Use the project's primitives: validators, schema library, error and
empty-state components. A hand-written regex next to an existing schema is a defect.

**Enumerate, do not pick.** Repeated things (menu items, links, cards, tabs) come from the page, all of them, not two
examples. The report states "clicked N of M" with the reason for each one skipped. Where the walk is too long, walk the
changed component in full and sample the rest, and say so.

**Both conditions.** Run the sweep fast (warm, overlay scrollbars) and bad (cold, slow images and network, slow CPU,
classic scrollbars, several runs). Each hides bugs the other shows. `pnmrvvtl-verify-for-real/assets/observe.mjs` does
both and is the starting point for a UI change.

**Sweep.** One script, in the real runtime, that drives the code through every state from Step 3
and checks every invariant in each state — by measurement (rects, computed values, statuses,
row hashes), not by presence. For UI also save a screenshot per state and **look at all of them**;
a screenshot catches what no assertion was written for. Recipes in the references.

Then falsify, as in `pnmrvvtl-verify-for-real`: break the mechanism and confirm the sweep goes red.
A sweep that passes both ways is blind.

## Examples

**Location list with overflow.** Dimensions: count (0, 1, exactly fits, fits + 1, 20), name
length (short, 60 chars), render path (inline, overflow popover), interaction (none, hover, focus),
viewport (320, 1440). Crossing gives "hover × popover", and invariant F1 (decoration attached to
its owner) fails when the underline sits above the item.

**Tags slider that moves the picked tag first.** Dimensions: tag position (first, middle, last,
off-screen), interaction (pick, pick the active one to deselect, pick during the move), render
path (after reorder). Crossing gives "pick a middle tag → list reorders", and invariant F11 fails
when the button left at the old position keeps or fades out the active highlight under another
tag's name — the sign of a list keyed by index. The sweep samples every frame of the move.

**Edit-profile form.** Every field empty and whitespace only; email with trailing space; name of
1 and 10 000 chars; phone in a foreign format; submit twice; `422` maps to the right fields; `500`
keeps the typed values; session expired on submit.

**Endpoint.** Missing body, invalid JSON, wrong types, unknown fields, out of range, oversized
payload, someone else's id, no token, expired token, same request twice, unique-constraint
conflict. Every failure returns the project's error shape and writes nothing.

## Review mode

When asked to review existing code: run Steps 1–5 and the sweep against it, and report only the
violations with location, state, trigger and consequence. Do not fix unless asked.

## Report

- dimensions, and the number of states the sweep reached
- the matrix, each row with its proof or "not covered: <reason>"
- invariant violations found and fixed, with the state that showed them
- falsification result
- every **owner** decision and every default taken
- lenses skipped and why
