# Baselines — what to measure in phase 0

Every number a later phase claims to improve is captured here first, as JSON, committed under
`REFACTOR/baselines/`. One file per tool per capture, named `<tool>-<date>.json`.

**A metric with no baseline cannot be improved, only asserted.**

## Rules

- **JSON, not prose.** Prose summarises in the phase report; JSON is the record.
- **Record the command and the scope with every number.** A number nobody can reproduce is a rumour.
- **Record before *and* after for anything phase 0 itself changes**, such as a failing-test fix.
- **Distinguish production code from tests and fixtures** in every count. Mixing them makes the
  numbers unusable for gate-setting.
- **Only record numbers from runs that completed.** A failed build prints progress counts right
  before it aborts; those are not results.
- **Note explicitly when a number was measured under a workaround** — a build with imports commented
  out, a partially-excluded scope. It will move when the workaround goes, and that is a re-baseline,
  not a regression.

## The list

### Tests
Pass/fail/skip counts, file count, wall time. If tests were failing, record the before state, each
failure with its cause, and the after state.

### Coverage
Line, statement, branch, function — as **both** percentage and covered/total, since the ratio is what
survives a change of scope. Record the exclude list verbatim; it is part of the measurement.

### Lint
Errors and warnings **with no `--quiet` and no `--fix`**, broken down per rule, plus the count that
are auto-fixable, plus unused suppression directives, plus the total number of suppression comments
in the source. Capture every error with its file and line — 10 to 20 errors is a small list and
having it saves a whole re-run later.

### Types (if the project has a type system)
Error count from the checker in no-emit mode, per file where useful. Count suppression comments by
kind. Record which strict flags are currently enabled and which are not — that list is the phase 5
ratchet's roadmap.

### Duplication
Percentage and clone count at **several** minimum-token thresholds, and separately for code and for
stylesheets, and separately for production-only versus everything. Six to eight rows. The threshold
choice in phase 2 is an argument you want data for.

### Size and complexity
Full distribution, not just a maximum: p50, p75, p90, p95, p99 and max for file length, function
length, and complexity; plus bucket counts and the top 20 offenders per metric with file and line.
The percentiles are what set defensible targets; the top-20 lists are the phase 4 work queue.

Measure with the linter's own rules by setting the limit to 1 and reading the reported values out of
the messages — that guarantees the baseline and the future gate agree on definitions.

### Build
Whether it succeeds untouched. If not: the exact first error verbatim, the full list of causes found
by static analysis rather than by iterating builds, and which of them actually reach the build graph.
Record the module/asset count from the **successful** run.

### Bundle
Total bytes, file count, bytes by extension, and the largest 15 files. A single outsized chunk is
worth naming in the phase report.

### Component catalogue
Whether it builds, how long it takes, and the number of **entries**, not the number of entry *files*.
These differ by an order of magnitude and the difference determines the visual gate's whole cost.

### Console noise in tests
Count of stderr blocks and how many distinct test files produce them, plus a histogram of warning
kinds. Also record whether unhandled rejections already fail the run — verify by planting one rather
than assuming.

### Formatting
Only if a formatter gate is being considered. Measure **why** it fails, not just how much: format
each file in-process, diff, and classify the changed lines by cause. See `gates.md` § Formatting.

## Useful measurement techniques

**Static analysis beats iterating a failing build.** A build stops at the first error, so finding all
of them by re-running is O(n) builds. Walk the source tree, resolve every import against the
filesystem, and get the whole list in one pass. Remember to skip specifiers inside comments — a naive
scanner reports them and sends you chasing a non-existent problem.

**Use the linter as a measurement instrument.** Setting `max-lines-per-function: 1` and reading the
reported actual values out of the messages gives an exact distribution, using the same definitions
the eventual gate will use.

**Ground version-specific facts before writing anything that depends on them.** Resolve versions from
the lockfile, not the declared ranges, and check the installed package on disk before trusting
memory. `pnmrvvtl-check-the-docs` does this properly.

**Prove behavioural claims with a probe, not an assumption.** Whether a runner fails on console
output, whether a library throws on a missing config value, whether a fix is inert — each is a
five-minute throwaway experiment and a permanent fact. Delete the probe afterwards and verify the
tree is clean.
