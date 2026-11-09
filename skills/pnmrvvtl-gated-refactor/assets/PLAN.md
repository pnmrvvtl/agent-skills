<!-- TEMPLATE. Written in phase 0. Changes only with the user's agreement. -->

# Refactor programme — plan

Branch: `<branch>`. All phases land here.

## What this programme is

<Structure and tooling, not behaviour. State it in two sentences.>

Every phase ends with a working application: it runs, the tests pass, and every gate that exists at
that point is green. It must be possible to stop after any phase and ship.

## Hard constraints

<Numbered, agreed with the user in phase 0, referred to by number later. Cover at minimum:
dead-code removal, type migration, behaviour changes, dependency upgrades, hook bypasses.>

1. **<Dead code and unused packages are / are not in scope.>** <why>
2. **<Type migration is / is not in scope.>**
3. **Every phase ends with a working application.**
4. **<Hook bypass policy.>**
5. **<Behaviour-change policy.>**
6. **<Dependency-upgrade policy.>**

## The repo, as measured on <date>

<Measured facts, not reported ones. Mark corrections to the original brief so they are impossible
to miss — later phases depend on them.>

Full numbers: `baselines/*.json`. Gate detail: `GATES.md`.

## Gate proof protocol — the A/B rule

**No gate is reported as working until it has been seen to fail.**

Every gate wired or tightened gets two runs, both recorded with real output in the phase file:

1. **Red run.** Put the codebase in the state the gate exists to catch. Run it. Record the failure.
2. **Green run.** Restore. Run it. Record the pass.

From the green side alone, a misconfigured gate, a typo'd glob, a script that exits 0 on error, and
a genuinely clean codebase are indistinguishable.

The same applies to bug fixes and to any claim that a change had an effect, including "this change
is inert" — show the failure first. Where a red run is genuinely impossible, write "could not be A/B
proven" and why.

## Phases

| Phase | Name | Installs | Tightens | File |
|---|---|---|---|---|
| 0 | Plan and unblock | nothing | G20 | `phases/phase-0-<name>.md` |

<One short paragraph per phase: goal, and the deliverable in bold.>

## Adjustments to the original phase list

<What changed after phase 0's measurements, and why. Empty is a valid answer.>

## Open decisions

<Numbered, each with what it blocks and a recommendation. Move to PROGRESS.md when settled.>
