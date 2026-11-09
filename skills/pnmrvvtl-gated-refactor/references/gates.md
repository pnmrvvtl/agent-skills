# Gate catalogue

One entry per gate: what it measures, the command, how to set it, how to ratchet it, where to wire
it, and the specific A/B proof that makes it believable.

**Numbers are stable for the life of a programme.** A gate that is removed or does not apply is
*retired*, never renumbered and never reused, so older phase notes keep meaning what they said.

**Every gate is set at the level actually reached.** If it cannot pass on the tree it is introduced
to, the setting is wrong. Widen it, record the real number, move on.

## Where gates run

| Speed | Home | Examples |
|---|---|---|
| < 5s | pre-commit | lint, type check on changed files, size/complexity ratchets |
| seconds to a minute | pre-push | tests, coverage, duplication, build |
| minutes | CI only | full visual comparison, production build, bundle budget |

Three rules:

- **Build the hook when the first gate for it exists**, not up front. A hook created before there is
  anything to put in it is an empty hook, and an empty hook teaches everyone to ignore hooks. After
  that, each phase adds its own fast gate to the existing hook once that gate is A/B proven.
- **Hooks and CI must invoke the same scripts**, not re-implementations. A gate whose command exists
  in two places will diverge, and the divergence is discovered during an incident.
- **A checking command must never mutate the tree.** No `--fix`, no `--write`. Auto-fixing belongs in
  a separate, deliberately-run script. A gate that rewrites files while checking them cannot be
  trusted and cannot be A/B proven.

---

## Writing the proofs mechanically

Each gate below lists an A/B. Implement them as entries in one script rather than as prose someone
follows by hand — see `SKILL.md` § Make the A/B mechanical. Each entry needs:

| Field | Purpose |
|---|---|
| `mutate()` | applies the violation, returns an exact undo |
| `cmd` | the gate's own command, unchanged |
| `expectFailure` | regex the RED output must match — proves it failed for the gate's reason |
| `expectNotInFailure` | optional; for staged gates, proves the right stage fired |

Assert: red exits non-zero AND matches, green exits zero, tree clean afterwards.

## G1 — Test suite passes

- **Measures:** every test passes; the number of skipped tests does not increase.
- **Command:** the project's own runner, in run-once mode.
- **Setting:** exit 0 required. Pin the current skip count as a ceiling — this is the part people
  forget, and it is what stops a red test being quietly `.skip`ped instead of fixed.
- **Wire:** pre-push.
- **Ratchet:** the skip ceiling only ever goes down. Any new skip needs a written reason in the phase
  report.
- **A/B:** red = break one assertion, confirm the hook refuses the push and names the test.
  green = restore, confirm it passes.
- **Trap:** a runner that exits 0 when *no tests matched a filter*. Always assert the test count, not
  just the exit code.

## G2 — Coverage floors

- **Measures:** line, statement, branch and function coverage.
- **Command:** the runner's coverage mode, with a machine-readable summary reporter.
- **Setting:** the measured values, floored to one decimal. **Never a round number.** 49.2, not 50.
- **Wire:** pre-push, or CI if slow.
- **Ratchet:** raised only by a phase that names coverage as its goal.
- **A/B:** red = set one floor a point above the measured value, confirm the run fails **and names
  which metric**; green = restore the real floor, confirm it passes.
- **Traps:**
  - The **exclude list is part of the measurement.** Changing it changes the denominator and
    invalidates every comparison. Treat an exclude-list edit as a re-baseline and say so out loud.
  - Coverage that rose because a directory was excluded is not coverage rising.
  - Prefer per-directory or per-file thresholds where the runner supports them; a global number lets
    a well-tested area subsidise an untested one.

## G3 — Build succeeds

- **Measures:** the production build completes.
- **Setting:** exit 0. Record the expected module/asset count so a silently smaller build is visible.
- **Wire:** pre-push or CI.
- **A/B:** red = break an import, confirm the build fails; green = restore.
- **If the build does not currently succeed**, do not delete or stub the offending imports. Follow
  `build-verification.md` — document the exact workaround, apply it only inside a verification run,
  and restore before committing.
- **Trap:** a failed build often prints a progress count (`✓ 4844 modules transformed`) immediately
  before it aborts. That is **not** the successful-build number. Only record counts from a run that
  finished. This exact mistake has been made under this skill and shipped into documentation.

## G4 — Visual parity

- **Measures:** screenshots of every component-catalogue entry and every reachable route, diffed
  against a captured baseline.
- **Design:** `visual-harness.md` — capture against the live backend, compare against a replayed
  recording, never the other way round.
- **Setting:** a pixel-difference tolerance ratcheted **down** to whatever survives three consecutive
  runs against the same baseline.
- **Wire:** pre-push if fast enough; otherwise CI. Measure before deciding.
- **Ratchet:** tolerance only ever decreases. **Raising a tolerance to make a diff go away is the one
  move this gate cannot survive.**
- **A/B:** the six-case table in `visual-harness.md` § Proving the harness works. At minimum: a
  one-line padding change turns it red on exactly the affected screens, and a rename or added log
  keeps it green.
- **Trap:** a diff is never "probably fine". Explain it, then fix it or deliberately re-baseline with
  the reason recorded.

## G5 / G6 — Duplication, code and stylesheets

- **Measures:** percentage of duplicated lines, and the clone count. **Report code and stylesheets
  separately** — they have different economics and one will otherwise mask the other.
- **Command:** a copy-paste detector, run at several minimum-token thresholds.
- **Setting:** the achieved percentage at a chosen threshold. Say why that threshold.
- **Wire:** pre-push.
- **Scope decision, made once and written down:** whether tests count. Test boilerplate similarity is
  usually fine. Gate on production scope; report both numbers.
- **A/B:** red = paste a duplicate block large enough to cross the threshold, confirm failure and
  that it names both locations; green = remove it.
- **Trap:** the detector's "lines" is its own normalised count, not `wc -l`. Do not compare its
  totals against file-length numbers from another tool.

## G7 / G8 / G9 / G10 — Lint

- **Measures:** errors, warnings, unused suppression directives, import order.
- **Command:** the linter with **no `--quiet` and no `--fix`**.
- **Setting:** zero errors; `--max-warnings 0`; unused-disable reporting on.
- **Wire:** pre-commit.
- **Sequencing that makes this survivable:**
  1. Migrate config first if a major upgrade is involved, and **prove the rule set is unchanged**
     across the migration by diffing the resolved config for a sample of files. A silent rule-set
     change invalidates every number.
  2. Land the auto-fixable bulk as **its own commit**, so reviewers can skip it wholesale.
  3. Then fix the judgement cases by hand.
  4. Then delete unused directives and wire the gate.
- **Suppressions:** narrow — one rule, one line or block — each carrying a reason. Enumerate every
  one in the phase report. G9 is what stops them outliving their cause.
- **A/B:** red = plant one error, one warning, one unused directive and one mis-ordered import;
  confirm each is caught and named. green = remove them, confirm a clean exit 0.
- **The trap worth stating loudly:** a `lint` script defined as `linter --fix --quiet` reports **zero
  problems** on a codebase with hundreds, *and rewrites files while looking at them*. Check what the
  script actually is before believing any "lint is clean" claim.

## G11 / G12 / G13 / G14 — Size and complexity

- **Measures:** file length, function length, cyclomatic complexity, nesting depth.
- **Command:** the linter's own rules, with comments and blank lines skipped.
- **Setting — a staged-file ratchet, not a flat limit:** an existing oversized file may shrink but
  never grow; new code meets the target outright. This needs a committed per-file baseline map that
  the hook compares against. **That map is the ratchet's memory — commit it.**
- **Targets:** derive from the measured distribution, not from taste. The p90 is usually a defensible
  target for new code; the p99 tells you how bad the tail is.
- **Wire:** pre-commit, on staged files only.
- **A/B — four cases, because a ratchet has two directions:** red = a commit adding a line to an
  already-oversized file is rejected, and a commit adding a new over-target function is rejected;
  green = a commit that *shrinks* the oversized file passes, and one that leaves it alone passes.
- **Trap:** splitting by line count rather than responsibility produces three files that still know
  everything about each other. Split by what the code is *for*.

## G15 — Type check passes

**Only if the project has a type system.** If it does not, and a type migration is out of scope, mark
this "not applicable" in `GATES.md` and retire the number.

- **Measures:** the type checker reports no errors, and the number of suppression comments
  (`@ts-ignore`, `@ts-expect-error`, `# type: ignore`, `@SuppressWarnings`) does not increase.
- **Command:** the checker in no-emit mode over the whole project — **not** the bundler's transpile
  step. Most bundlers strip types without checking them, so a green build says nothing about types.
- **Setting:** zero errors, plus a pinned ceiling on suppression count.
- **Wire:** pre-commit on changed files if the checker supports incremental single-file checking;
  otherwise pre-push on the whole project.
- **Ratchet:** the suppression ceiling only ever goes down. Prefer `@ts-expect-error` over
  `@ts-ignore` — it fails when it becomes unnecessary, which makes it self-cleaning, exactly like G9
  does for lint.
- **A/B:** red = assign a string to a number-typed variable, confirm the gate fails and names the
  file and line; and separately add one suppression comment, confirm the ceiling check fails.
  green = remove both, confirm it passes.
- **Traps:**
  - **A build that succeeds is not a type check.** Verify the checker actually runs by planting an
    error and watching it fail — the red run is the only proof.
  - Generated files, vendored code and declaration files silently inflate error counts. Decide the
    include/exclude scope once, write it down, and treat changing it as a re-baseline.
  - If the project is mid-migration with mixed typed and untyped files, gate only the typed set and
    record which set that is.

## G16 — Type strictness ratchet

**Only if the project has a type system.**

- **Measures:** how strict the configuration is, and how much of the codebase escapes it. Two numbers
  worth tracking: the count of explicit `any`/`Object`/`dynamic` escapes, and the number of strict
  compiler flags not yet enabled.
- **Setting:** the flags currently on, plus the measured escape count as a ceiling.
- **Ratchet:** enable **one strict flag per phase**, fix what it surfaces, and pin it. Never turn on
  full strictness in one commit — the error count will be four figures and the change will be
  abandoned. A typical order, cheapest first: unused locals and parameters → no implicit `any` →
  strict null checks → strict function types.
- **Wire:** with G15.
- **A/B:** red = with the new flag enabled, confirm the checker fails on the code it was turned on to
  catch, *before* fixing it — capture that output, it is the evidence the flag does something;
  green = after fixing, confirm it passes with the flag on.
- **Trap:** widening a type to silence a strict flag is a regression wearing the costume of progress.
  Count escapes, not just errors, or the escape count quietly climbs while the error count reaches
  zero.

## G17 — No console errors or unhandled rejections in tests

- **Measures:** a test that logs an error, emits a framework warning, or leaves an unhandled rejection
  is a failing test.
- **These are two different problems** and it is worth checking which you already have:
  - **Unhandled rejections** are often *already fatal* in modern runners — verify by planting one
    rather than assuming. If they are, this half needs no work; just never enable the flag that
    disables it.
  - **Console output usually is not.** A console hook that "handles" the log typically only suppresses
    printing; it does not fail anything. This half needs an explicit spy that asserts in teardown.
- **Setting:** ratchet on the measured count. **Do not demand zero on day one** on a codebase with
  hundreds of warnings — it will be disabled within a week.
- **Wire:** pre-push, with the test run.
- **A/B:** red = plant a `console.error` in a throwaway test, confirm the run now fails; green =
  remove it, confirm green. Do the same for a rejection.
- **Trap:** framework deprecation warnings from a UI library are product-code changes, not test
  changes. Separate "our bug" from "our dependency's deprecation" in the report; the second needs
  agreement before fixing.

## G18 — Component catalogue builds

- **Measures:** the component catalogue (Storybook or equivalent) builds without error.
- **Setting:** exit 0.
- **Wire:** pre-push.
- **A/B:** red = break one entry's import, confirm the build fails; green = restore.
- **Note:** this can pass while the application build fails, if the broken modules are not reachable
  from any catalogue entry. That is useful — it gives a working visual surface even on a repo whose
  app build is broken.

## G19 — Bundle size budget

- **Measures:** total output bytes and per-chunk size.
- **Setting:** the measured values plus a stated tolerance. Both numbers: a total-only budget hides a
  chunk doubling while another shrinks.
- **Wire:** CI.
- **A/B:** red = import something large into an entry point, confirm the budget fails **and names the
  chunk**; green = revert.
- **Trap:** if the numbers came from a build with a workaround applied (see G3), say so — they will
  move when the workaround goes away, and that is a re-baseline, not a regression.

## G20 — Commit hygiene

- **Measures:** the diff is reviewed before every commit; no file is reformatted that the change did
  not otherwise touch.
- **Wire:** human. This one is a habit, not a script — which is why it is listed, so it is not
  forgotten.
- **Why it matters more than it sounds:** it is the reason `--fix` is banned from checking commands,
  and the reason a repo-wide reformat is almost never worth it. Every drive-by reformatted file is a
  file whose real change is now invisible to the next reviewer, and to `git blame` forever.

---

## Formatting — the gate that often should not exist

Before proposing a formatter check, **measure why it currently fails**, file by file. Format each
file in-process, diff it against itself, and classify the changed lines. The answer is frequently
that the codebase is already consistent about the things that matter — quote style, indentation —
and disagrees only about bracket placement, wrapping and trailing commas.

That is a config-versus-house-style argument, not a defect count. Settling it can mean rewriting tens
of thousands of lines, which:

- buries every subsequent diff in the refactor,
- destroys `git blame` across the codebase,
- conflicts with every open branch,
- and directly fights G20.

Also check for a **line-ending contradiction**: a formatter configured `endOfLine: "lf"` in a repo
where the VCS checks files out as CRLF will fail on every file forever, no matter how the code is
formatted. Find that before blaming the code.

The honest recommendation is often: **do not make formatting a gate.** Keep the scripts for manual
use, let files get formatted as they are naturally edited, and spend the gate budget on something
that catches defects. If the user wants it anyway, scope it to changed files only — never repo-wide —
and fix the line-ending contradiction first.
