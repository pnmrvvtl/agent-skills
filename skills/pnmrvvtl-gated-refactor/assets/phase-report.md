<!-- TEMPLATE for REFACTOR/phases/phase-N-<name>.md.
     Written at the start of the programme as a plan; filled in as the phase runs; ends as the
     report. One file, not three. -->

# Phase <N> — <name>

**Status:** <not started / in progress / complete, awaiting approval>
**Branch:** `<branch>`
**Date:** <date>

**Deliverable:** <one sentence, in the imperative, that someone could check.>

---

## Installs

<Only what this phase uses. Nothing a later phase will introduce. State explicitly what is *not*
installed here and which phase owns it.>

## Baseline to beat

<The numbers this phase is judged against, copied from `baselines/`. If the phase changes no
metric, say so.>

## Work

<Numbered steps. Each step that touches a gate carries its A/B proof inline:>

1. **<step>**
   *A/B: red = <what makes it fail>; green = <what restores it>.*

## Watch out for

<Traps specific to this phase. Fill in from `references/phases.md`, then add what you actually
hit — that is how this file earns its keep for the next person.>

## Exit criteria

- **Every gate this phase wires or tightens is A/B proven** — red run and green run, both with
  recorded output, in the report below.
- <the phase's own measurable criteria>
- Visual parity: zero unexplained diffs.
- Build verified; tree clean.
- Full test suite green.

---

## Report

<!-- Filled in at the end. This is what gets read six months from now. -->

### Numbers, before against after

| Metric | Before | After |
|---|---|---|

### What changed

<Concrete. File counts, not adjectives.>

### What was deliberately left alone, and why

<The half people skip. It is the half that builds trust — and it is where the next person looks
first when they wonder why something is still ugly.>

### Gate wired or tightened

| Gate | Setting | Wired at | A/B proven |
|---|---|---|---|

**Red run output:**

```
<the actual failure>
```

**Green run output:**

```
<the actual pass>
```

### Build verification

<Result, procedure used, restore confirmed clean, with the evidence not just the claim.>

### Visual parity

<Diff count, and an explanation for every single diff. "Probably fine" is not an explanation.>

### Test result

<Full counts.>

### Unverified

<Anything claimed but not measured, stated plainly. Omitting this section is not an option — write
"nothing" if nothing.>
