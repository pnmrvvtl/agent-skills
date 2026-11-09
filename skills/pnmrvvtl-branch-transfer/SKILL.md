---
name: pnmrvvtl-branch-transfer
description: Transfer a feature/fix between the long-lived `main` and `production` lines of a git repository, in either direction — PROD → MAIN (`*-PROD` branch onto a fresh `*-MAIN` branch) or MAIN → PROD (merged main work onto a fresh `*-PROD` branch). Use when the user asks to move, port, transfer, backport, forward-port or cherry-pick changes between prod and main, with branch names like `TASK-123-PROD` / `TASK-123-MAIN`, or asks for "the opposite transfer".
---

# Prod ↔ Main Transfer

Move the intended feature/fix between the two long-lived lines of the repository without
dragging unrelated history across. The two lines have diverged: every feature is committed
twice, once on each side, and the two sides are usually at different points of the same
refactors. Treat the source as a description of *behaviour to reproduce*, not as a patch to
replay.

## Direction

Establish the direction before anything else.

| Direction | Source | Target base | Target branch | Commit prefix |
|---|---|---|---|---|
| PROD → MAIN | `*-PROD` branch (or named commits) | `main` | `<FEATURE>-MAIN` | `<FEATURE>-MAIN:` |
| MAIN → PROD | merged commits on `main` (or a `*-MAIN` branch) | `production` | `<FEATURE>-PROD` | `<FEATURE>-PROD:` |

- Derive the target branch by swapping the final suffix, unless the user names one. A user
  supplied name always wins (`TASK-789-PROD`), even when it does not match the source name.
- If the repository's long-lived branches are not called `main` / `production`, inspect
  `git branch -a` and use the local equivalents. Never guess.
- If the direction is not stated and not derivable from the branch names, ask. "The opposite
  transfer" means MAIN → PROD when the skill's previous run was PROD → MAIN.

## Workflow

### 1. Check the worktree

- `git branch --show-current`, `git status --short`.
- Never trust a branch name from a stale session snapshot — read it from git.
- If the worktree is dirty, find out whether the changes are the user's. Do not discard them.

### 2. Update both lines

- `git fetch --all`.
- Switch to the **target base** (`main` or `production`) and `git pull` — a branch cut from a
  stale base produces a transfer that conflicts on the way back.
- Confirm the source ref is current too (`git log --oneline <source>` against `origin/<source>`).

### 3. Install dependencies on the target base

- `npm i` (or the repo's package manager).
- The two lines frequently sit on different dependency sets and even different build tools.
  Type-checking against the *other* line's `node_modules` produces a screen of fake errors.
- Inspect `git status --short` afterwards. If a lockfile appears that the target branch does
  not track, it is install noise — delete it, do not commit it.

### 4. Create the target branch

- `git switch -c <target-branch>` from the updated base.
- If the branch already exists, stop and inspect it before recreating or reusing it.

### 5. Identify the intended changes

- `git log --oneline <target-base>..<source>` — never `git diff` the whole branch.
- Read commit messages and `git show --stat <commit>` to pick the relevant commits.
- If several unrelated commits are present and the subset is ambiguous, ask.

### 6. Survey the gap before transferring

This is the step that decides everything after it. The target line is not the source line minus
one feature — it is a different point in the repository's history.

For each area the change touches, check what actually exists on the target:

- `git ls-tree -r --name-only <target-base> -- <path>` for every directory the source commits
  touch, and for every module they import. A missing directory means the feature's **base
  stack** was never transferred (an editor component, a shared input primitive, an api module).
- `git diff --stat <target-base> <source> -- <paths>` to size the port.
- Compare the surrounding conventions: route shapes, step/tab numbering, build tooling,
  available npm scripts, whether hooks exist at all.

Report the gap to the user in concrete terms before doing large work: what is missing, how many
files the honest port is, and which decisions it forces. Then proceed — do not stall on a
question you can answer with a stated assumption.

### 7. Transfer

Pick the lightest mechanism that actually applies:

- **Cherry-pick** (`git cherry-pick <commit>`) when the target already has the base stack and the
  touched files are close relatives. Preferred: it keeps authorship and message.
- **File-level port** when the base stack is missing or the files have diverged past useful
  conflict resolution:
  - `git checkout <source> -- <paths>` for files that are **new** on the target — including the
    dependencies they import that the target lacks.
  - Hand-port the hunks into files that already exist on the target, taking only the hunks that
    belong to this feature. A diff between the two lines is full of unrelated refactors
    (renames, type migrations, tooling changes) — those are somebody else's transfer.

Rules that hold in both directions:

- Do not restore files the target deleted on purpose unless the user asks.
- Do not import the source line's unrelated refactors as a side effect.
- Map, do not copy, the things that are structurally different on the target: route shapes,
  step numbers, tab indexes, feature-flag names. When numbering differs, prefer the number the
  *other* line already uses so the two converge on the next transfer, and say so.
- Preserve the target line's current APIs and structure. Keep the requested behaviour.

### 8. Resolve conflicts

- Remove every conflict marker; adapt the behaviour to the target's current code.
- `git add` resolved files, `git cherry-pick --continue`.

### 9. Validate with the target's own tooling

- Run what the target branch actually has. Do not assume a script exists on both lines —
  `npm run type-check` can be present on one and missing on the other.
- With no script, fall back to the toolchain directly (`npx tsc -p tsconfig.json --noEmit`).
- The target line may be red before you touch it. Establish the baseline, then **filter the
  output to the files you added or edited**. "No errors in ported files, N pre-existing errors
  elsewhere" is the honest report; "151 errors" is not.
- Report hook results if hooks run. Do not invent extra build/test runs the risk does not justify.

### 10. Commit message

- Prefix with the target branch's ticket and line: `<FEATURE>-MAIN:` or `<FEATURE>-PROD:`.
- Cherry-picked commits arrive with the source line's prefix — rewrite it before finishing, or
  amend right after.
- Never leave a `*-PROD:` prefix on a `*-MAIN` branch, or the reverse.

### 11. Final check

- `git status --short`, `git log -1 --oneline`.
- Report: direction, target branch, base commit, commit hash/message (or that nothing was
  committed), changed files, what validation ran and its result, worktree state, and every
  mapping decision taken in step 7.

## User Phrases

Treat these as requests to use this skill:

- `use pnmrvvtl-branch-transfer for TASK-123-PROD`
- `transfer TASK-123-PROD to main`
- `do a prod-to-main transfer for TASK-123-PROD`
- `перенеси TASK-123-PROD в main`
- `transfer TASK-456 from main to production`
- `make the opposite transfer, main to prod, branch TASK-789-PROD`
- `перенеси зміни з main на production`

## Safety Rules

- Never use `git reset --hard` or destructive checkout to clean user changes.
- Never transfer the full branch diff when it contains unrelated history.
- Never commit lockfile churn from `npm i` unless the user asked or the transfer requires it.
- Never leave the source line's commit prefix on the target branch.
- Do not push, and do not commit, unless the user explicitly asks. When the user says "no
  commits", leave the port staged/unstaged in the worktree and say exactly what is uncommitted.
