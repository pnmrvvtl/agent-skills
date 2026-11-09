# Phase catalogue

The default ordering, what each phase does, what it installs, what it tightens, and what actually
goes wrong in it. Adjust once phase 0's measurements are in — but say what you are changing and why
before acting on it.

**Every phase, without exception, ends with:** a green tree, an updated `PROGRESS.md`, a report in
its phase file, and the A/B proof for whatever gate it wired. Do not start a phase before the
previous report is approved.

## Hooks accumulate — do not build them up front

**Create the pre-commit hook in the first phase that produces a fast gate to put in it**, not in
phase 1. An empty hook, or one written against gates that do not exist yet, teaches everyone to
ignore hooks — and it is the single easiest way to end a programme with hooks nobody trusts.

From that phase onward, **every phase that implements a fast gate adds it to the hook in the same
phase**, once the gate is A/B proven. The hook grows with the programme. Slow gates — tests,
coverage, build, screenshots — stay on pre-push or in CI.

This has a second-order effect worth planning for: **removing a gate can strip a phase of its
reason to exist.** If a decision deletes the only gate a phase was going to wire, re-check what that
phase is still for before running it, and move its remaining work rather than running an empty phase.

---

## Phase 0 — Plan and unblock

**Installs:** nothing. **Tightens:** G20 (commit hygiene).

Make the tests pass, work out how the build gets verified, capture every baseline, write the
documents, design the visual harness on paper.

**Deliverable: the failing-test fix, and documentation. Nothing else changes.**

Watch for:

- **Fix the tests from an existing source if one exists.** A recent PR or branch often already
  contains it. Port only the hunks that fix the failures — not the feature they are embedded in —
  and record which commit you took them from.
- **A half-landed change is a common cause of a failing test**: a caller passing an argument the
  callee never declared, a renamed class that only some call sites learned about. Read the failure,
  do not just make it green.
- **A global find-and-replace elsewhere in the repo's history** may have rewritten strings it should
  not have — third-party CSS class names inside test selectors are the classic. Two failures with the
  same shape usually share one cause.
- **Verify every fact you were told.** Framework major, file counts, story count versus story *file*
  count, installed versions versus declared ranges. Corrections here save whole phases later.

## Phase 1 — Minimum tooling, wide settings, everything green

**Installs:** the screenshot tool. **Tightens:** G1, G2, G3, and builds the G4 harness.

Install *only* what the next phases need now. Every gate introduced must pass on the untouched
codebase, first try, without a code change. If one does not, the setting is wrong — widen it and
record the real number.

**Deliverable: gates exist, all green, all A/B proven, zero product code changed.**

Watch for:

- **Do not create the pre-commit hook here.** Create it in the first phase that produces a fast gate
  to put in it — see "Hooks accumulate" below. An empty hook teaches everyone to ignore hooks.
- **Check whether a pre-commit hook already runs.** A config block naming a pre-commit task can be
  entirely inert if the hook manager was later replaced. Anyone reading the config will assume commits
  are checked when they are not. Verify by making the check fail.
- The exit criterion is literally `git diff --stat` showing **no file under the source directory**.
  If product code changed, the phase was scoped wrong.
- Capture the visual baseline **three times** and record what is not stable. That set determines the
  starting tolerance, and each unstable item gets a *named* mask — never a global loosening.

## Phase 2 — Duplication

**Installs:** a copy-paste detector, **and the pre-commit hook** — this is usually the first phase
with a fast gate to fill it. Clear out any inert legacy hook config at the same time.
**Tightens:** G5, G6.

Measure at several thresholds, rank clusters by payoff — lines removed against call sites touched.
A cluster removing 200 lines across 3 files beats one removing 300 across 40.

Group every finding:

- **(a)** identical code that lifts into a shared helper with no behaviour change — proceed;
- **(b)** similar-but-not-identical, where extraction means *choosing an abstraction* — **bring these
  to the user before extracting any of them.** A wrong abstraction is worse than the duplication it
  replaces, and it is much harder to undo;
- **(c)** not worth touching — list with reasons.

One cluster per commit, into the place the project already keeps shared code. Find that convention;
do not invent a new one.

Watch for:

- **Near-parallel module families are group (b), not (a).** Two screens that look 90% identical often
  differ in exactly the way that matters, and phase 0 may already have found a bug caused by someone
  assuming otherwise.
- Files with near-identical *names* in different directories are the first thing to check — and check
  whether they are actually identical before assuming.

## Phase 3 — Lint strictness

**Installs:** the linter's own major upgrade, if one is needed. **Tightens:** G7, G8, G9, G10.

Migrate the config, split the checking script from the fixing script, clear the auto-fixable bulk in
one reviewable commit, then fix the judgement cases by hand.

**Deliverable: zero errors, zero warnings, behaviour unchanged, every suppression enumerated.**

Watch for:

- **Prove the rule set is unchanged across a config migration** by diffing the resolved config for a
  sample of files. A silent rule-set change invalidates every number in the programme.
- The auto-fix commit touches hundreds of files. It must land **before** any hand fixes and be its
  own commit, or review is impossible.
- If a formatter is also configured, check the "disable conflicting rules" integration still disables
  what it should after the migration. A quoting fight between two tools loops forever.
- **Coordinate with open branches.** This phase conflicts with everything.

## Phase 4 — Size and complexity

**Installs:** nothing. **Tightens:** G11–G14.

Wire the staged-file ratchet with its committed baseline map, then split the worst offenders **by
responsibility, not by line count**.

**Deliverable: the distribution moved, the ratchet wired, no component's public interface changed
without agreement.**

Watch for:

- **Do not change a module's public interface** without asking. Splitting internals is in scope;
  changing what callers pass is not.
- Some of the worst files are often the least verifiable — behind a permission-gated route, or
  otherwise not covered by the visual gate. Consider deferring them, and lean on unit tests if you do
  touch them.
- Splitting changes per-file coverage denominators. Watch G2 even though the total should not move.

## Phase 4a — Console cleanliness

**Installs:** nothing. **Tightens:** the two console gates (tests, and the running app).

Silence the browser console and the test output, then gate both. Every warning is the framework, the
component library or the mock layer reporting a real defect: a violated prop contract, a component
updating after unmount, a request nobody stubbed, invalid DOM nesting the browser silently repairs.

Place it **after the lint phase** — the lint rule for prop types and the runtime prop-type warnings
are the same family, so doing lint first avoids fixing them twice. Place it **after the visual
harness exists** — invalid-nesting fixes move rendered DOM.

**Deliverable: console noise measurably down on both surfaces, both gates wired at the achieved
level, every remaining warning enumerated with a reason.**

Watch for:

- **Test-console and app-console are different surfaces.** A DOM-less test environment never reports
  layout warnings, and the running app exercises paths no test covers. Measure both.
- **Suppressing is not fixing.** Mocking the console makes the gate green and the bug permanent.
  Where a test genuinely expects a warning, assert on it — an expected warning is an assertion.
- **Ratchet to the count reached, never to zero on day one.** A gate demanding zero on a codebase
  with hundreds gets disabled within a week.
- Library deprecation warnings in product code are an API migration. Behaviour-adjacent — get
  agreement before starting, and lean on the visual gate.
- Fix by category, one commit each, and re-measure after every category: a shared component can clear
  a dozen at once or introduce one somewhere unrelated.

## Phase 5 — Types

**Installs:** nothing new if the checker is already present. **Tightens:** G15, G16.

**Skip this phase entirely if the project has no type system and a type migration is out of scope.**
Mark the gates "not applicable" in `GATES.md` and retire the numbers rather than renumbering.

Wire the type check as its own gate — separate from the build, because most bundlers strip types
without checking them. Then enable **one strict flag per phase-sized chunk**, fix what it surfaces,
and pin it.

**Deliverable: type check gated, one strictness level gained, suppression count ratcheted down.**

Watch for:

- **Prove the checker actually runs** by planting a type error. A green build proves nothing.
- Track *escapes* (`any` and friends), not only errors — otherwise the error count reaches zero while
  the escape count quietly climbs.
- Prefer the suppression form that fails when it becomes unnecessary; it self-cleans.
- Decide the include/exclude scope once and write it down. Generated and vendored files will
  otherwise dominate the numbers.

## Phase 6 — Test coverage

**Installs:** nothing. **Tightens:** G2 (raised), G17.

Raise the floors toward the agreed target **by testing the paths that carry the most risk** — the
money maths, the merge and aggregation logic, the code phase 0's bug was found in — not by chasing
percentages through trivial files.

**Deliverable: floors raised, console gate wired, every new test asserting behaviour not
implementation.**

Watch for:

- A test that asserts implementation detail — a spy was called, an internal shape — is worse than no
  test. It makes phases 4 and 8 harder. Assert what the user sees.
- **Check what testing-library versions the project actually resolves before writing a single test.**
  Older majors have materially different APIs, and writing the modern form into an old version is the
  most common failure here. Ground this with `pnmrvvtl-check-the-docs`.
- Resolve any pre-existing skipped test: either write down why it is skipped, or remove the skip.

## Phase 7 — Visual and component hardening

**Installs:** nothing new. **Tightens:** G4, G18, G19.

Promote the phase 1 harness into a real gate. Measure its runtime **before** deciding it belongs on
pre-push. Add catalogue entries for the components the refactor touched most.

**Deliverable: a visual regression gate a stranger can run and trust.**

Watch for:

- **Where does the baseline live?** If it contains secrets or customer data it cannot be committed,
  and then the gate does not survive a fresh clone. Decide this here, explicitly, before CI depends
  on it. Options: an artifact store, a sanitised committed copy, or splitting the gate so CI runs only
  the parts needing no secrets.
- Write the re-baseline procedure down, including who may do it and what must be recorded.

## Phase 8 — CSS and styling consolidation

**Installs:** nothing. **Tightens:** G6.

Deduplicate stylesheets, reconcile the competing styling systems, pull repeated values into whatever
token mechanism the project already has.

**Deliverable: CSS duplication down, visual parity proven pixel-for-pixel.**

Watch for:

- **This is the phase where the visual gate earns everything it cost.** Prove it still bites before
  starting — change one padding value and confirm it goes red.
- Where a component library injects its own runtime styles, apparently-dead CSS may be winning a
  specificity fight. Screenshot before and after every single change.
- Diffs here look plausible and are not. Explain every one.

## Phase 9 — Make it stick

**Installs:** CI. **Tightens:** nothing new.

CI running the same scripts as the hooks. An `AGENTS.md` at the repo root with the commands, the
gates, where code belongs, and the traps that actually bit. A short gate-escape policy: how a gate may
legitimately be relaxed, by whom, and what must be written down when it is.

**Deliverable: the gates survive the programme ending.**

Watch for:

- **CI must invoke the same scripts as the hooks**, not copies. Two definitions will drift.
- **A/B the pipeline itself**: open a throwaway PR that violates one gate, confirm CI blocks it, fix
  it, confirm it passes. A pipeline nobody has seen fail is not a pipeline.
- A gate with no documented escape hatch gets bypassed instead of relaxed. Write the hatch down —
  including the one rule that has none: a visual tolerance is only ever lowered.
- The final report puts every phase 0 baseline against its current value, in one table, plus the A/B
  status of every live gate.
