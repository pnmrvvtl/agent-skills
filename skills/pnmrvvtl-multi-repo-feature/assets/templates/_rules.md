# Rules for every implementation agent (read this before your packet)

You are implementing one unit of {{FEATURE}}. The orchestrator reviews your diff and runs the full gates
afterwards. Your job is to finish the unit cleanly and prove it with the checks below.

## Context you must read

`AGENTS.md` (repo contract), the repo's rule docs, `DECISIONS.md`. Decisions there are final. Your packet's
"Files" and "Non-goals" define your scope.

## Hard rules

- Never run `git commit`, `git push`, `git stash`, `git reset`, `git checkout -- <file>` or `git clean`.
  Never use `--no-verify`. Leave all changes uncommitted.
- Do not touch files outside your packet scope; another agent may be working now. If `tsc`/`eslint` report
  errors in files you did not touch, ignore them and mention them in your report. Do not fix them.
- TypeScript: no `any`, no `as unknown as`, no `@ts-ignore`/`@ts-expect-error`, no non-null `!`, no
  `eslint-disable`. Functions stay under the repo's function-length rule.
- Follow the project style and folder conventions. No new npm dependencies.
- Only the network is mocked. Everything else is production code: real stores, real error handling, real
  loading states.
- Coverage: every new or changed source file needs >=90% statement coverage from unit tests next to it.
- Security: never render unsanitised HTML; no `eval`; no tokens or personal data in web storage.
- Large design JSON is never printed whole. Extract fields with a small node script.

## Never read an image, measure it

Every step re-sends the whole conversation, so a PNG costs thousands of tokens once and then rides along on
every later step. Do **not** open a PNG with your read tool — not a design crop, not a baseline, not
`-actual.png`, not `-diff.png`. Measure it with a few lines of `sharp`: differing ratio, worst rows and
cells, ink extents, box coordinates. Keep probe output to a few lines. The orchestrator is the one who
looks at pictures; if something needs an eye rather than a number, write the question into a short note and
stop.

## Where temporary files go

Every throwaway — probe output, lint dumps, measurement JSON — goes into `agent-scratch/` inside the
repository. **Never write outside the repository** (the CLI's directory permission check will refuse to read
it back and the run ends there). `scratchpad/` at the repo root is the orchestrator's gate scripts: do not
write to it and never clear it. Anything worth keeping is not temporary: it goes into the knowledge base.

## Checks to run before you finish (all must pass for the files you touched)

1. `npx tsc --noEmit -p .` (report out-of-scope errors, do not fix them)
2. `npx eslint --max-warnings 0 <your changed files>`
3. `npx vitest run <your test files> --coverage.enabled=false`
4. `node <api-spec check>`, only if you added mock routes

## Report (last message, <=40 lines)

- Files created or changed (one line each, with a short purpose)
- Checks run and their results
- Anything left undone, any assumption, anything surprising

## Definition of done

Your unit is done only when its mechanical gates are green: unit tests, e2e and, for anything visual, the
pixel comparison plus geometry assertions. Otherwise report `implemented, NOT verified: <missing gate>`.
Never redraw or approximate a design asset, and never pick one by its name. Take the exported SVG/PNG
verbatim, mapped by geometry.

## Inspect before you implement

Before writing any component, control or style: search the inventory and the repos for what you need, and
grep for a working precedent of the behaviour, not just the name. Put the decision in your report as a
table — needed -> existing candidate (path) -> reuse / extract / new + why. A duplicate fails the reuse gate.
