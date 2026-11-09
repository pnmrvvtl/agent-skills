# Proof report — <what was verified>

## Claim

> <one falsifiable sentence — what must hold, and over what window>

Observable signal: <DOM class / rect / status+body / DB row / log line>

## Method

- Probe: <file that was run, deleted afterwards unless stated>
- Sampled: <every animation frame / every request> over <window>
- Assertion: <over all in-flight samples, with N frames of slack for …>
- Repetitions: <n>

## Actors

Everything the user can perceive in this window, and how each was sampled. An actor with no row
is an actor that was not verified — list it under "not covered" instead of leaving it out.

| Actor | Sampled value | With fix | Without fix | Reference (parity claims) |
|---|---|---|---|---|
| <e.g. search icon> | <rect.left per frame> | <1104 → 267, 9 steps> | <static, travel 0> | <1100 → 270, 9 steps> |
| <e.g. logo> | <opacity + rect per frame> | <0 gaps / 41> | <14 gaps / 40> | <0 gaps / 39> |
| <e.g. header band> | <painted colour at x=40/1000/1240> | <0 non-white / 41> | <23 non-white / 40> | <0 non-white / 39> |
| <e.g. URL> | <location.href after settle> | | | |

## Result

| Case | With fix | Without fix |
|---|---|---|
| <case, e.g. doctor page, mid-list chip> | <0 bad / 37> | <30 bad / 37> |
| <case> | | |

Falsification: one row per mechanism, each breaking only that mechanism.

| Mechanism broken | How | Effect on which actor |
|---|---|---|
| <e.g. animation lib bundled twice> | <flip `external` in the lib build, rebuild> | <icon stops travelling> |
| <e.g. header transition binding removed> | <drop the tag from the Binder> | <band shows backdrop 23/40 frames> |

Falsification method: <worktree / flag / scoped stash / not performed — reason>

## Environment

- URL / entry point: <…>
- Build: <dev or production>
- Runtime: <browser + version + viewport, or node/python + service version>
- Data: <slugs, fixtures, seeded records>
- Commit: <sha>

## Findings

<Bugs the verification exposed, including ones in the fix itself. This is the payoff — state
them even when they cost another round of work.>

## Not covered

- <other browsers / engines>
- <mobile viewport, touch input>
- <production build>
- <concurrency, other data shapes, other locales>

## Leftovers

<Installed browsers/caches and where they live; background processes started and stopped;
files created and deleted.>
