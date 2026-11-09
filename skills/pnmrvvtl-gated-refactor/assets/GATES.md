<!-- TEMPLATE. The one file, alongside the current phase file, that should be enough to work from.
     Every gate is a ratchet: set at the level actually reached, failing on regression from there. -->

# Gates

Every gate in this programme is a **ratchet**: set at the level actually reached, failing on
regression from there. No aspirational numbers. If a gate cannot pass on the tree it is introduced
to, the setting is wrong — widen it and record the real number here.

**Every gate must be A/B proven before it is reported as working** — shown to fail on the condition
it exists to catch, then to pass once that condition is removed, both outputs recorded in the phase
file. See `PLAN.md` § Gate proof protocol. The **A/B proven** column stays `no` until both halves
are on record.

Status values: `not wired` · `wired` · `tightened by phase N` · `retired`.

**Numbers are stable for the life of the programme.** A retired gate keeps its number so older notes
keep meaning what they said.

---

## Summary

| # | Gate | Introduced by | Hook | Status | A/B proven | Current setting |
|---|------|---------------|------|--------|-----------|-----------------|
| G1 | Test suite passes | | | not wired | no | — |
| G2 | Coverage floors | | | not wired | no | — |
| G3 | Build succeeds | | | not wired | no | — |
| G4 | Visual parity | | | not wired | no | — |
| G5 | Duplication — code | | | not wired | no | — |
| G6 | Duplication — stylesheets | | | not wired | no | — |
| G7 | Lint errors = 0 | | | not wired | no | — |
| G8 | Lint warnings = 0 | | | not wired | no | — |
| G9 | Unused lint-disable directives | | | not wired | no | — |
| G10 | Import order | | | not wired | no | — |
| G11 | `max-lines` | | | not wired | no | — |
| G12 | `max-lines-per-function` | | | not wired | no | — |
| G13 | Cyclomatic complexity | | | not wired | no | — |
| G14 | Nesting depth | | | not wired | no | — |
| G15 | Type check passes | | | not wired | no | — |
| G16 | Type strictness ratchet | | | not wired | no | — |
| G17 | No console errors / unhandled rejections in tests | | | not wired | no | — |
| G18 | Component catalogue builds | | | not wired | no | — |
| G19 | Bundle size budget | | | not wired | no | — |
| G20 | Commit hygiene | phase 0 | human | **active** | n/a | reviewed before every commit |

**Existing hooks as of <date>:** <what actually runs today — verify it runs, do not trust the
config. A config block naming a task can be entirely inert.>

---

<!-- One section per gate. Delete the ones that do not apply to this project, but retire the
     number rather than renumbering. Template for each: -->

## G<n> — <name>

- **Measures:** <the thing, precisely enough that two people would compute it the same way>
- **Command:** `<exact command, no --fix, no --write>`
- **Baseline (<date>):** <the measured number, and where the raw data lives>
- **Setting when wired:** <the exact configured value, at the level reached>
- **Wire:** <pre-commit / pre-push / CI, and why>
- **Ratchet:** <which direction it may move, and which phase is allowed to move it>
- **A/B proof:** red = <what to do to make it fail>; green = <what restores it>. Status: <not done /
  done in phase N, output in that phase file>
- **Traps:** <what will mislead the next person>

---

## Retired

| # | Gate | Retired by | Why |
|---|---|---|---|
| | | | |

<!-- Gates that do not apply to this project (e.g. type gates in an untyped codebase) go here too,
     marked "not applicable" rather than deleted. -->
