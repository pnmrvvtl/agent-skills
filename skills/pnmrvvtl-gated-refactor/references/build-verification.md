# Verifying a build that does not build

Some repositories cannot build from a clean checkout — modules that belong to the system are absent,
a generated file is missing, a private package is unavailable. The refactor still needs a build gate,
because "did this phase break the build" is a question that must have an answer.

The answer is a documented workaround applied **only inside a verification run**, never committed.

## Do not "fix" it

Do not delete the offending imports, stub the missing modules, or create empty placeholder files.
Those are the three tempting moves and all three are wrong: they hide a real integration problem and
they silently change what ships. The missing pieces are usually present in the real environment.

Establish first, by asking, whether an unresolvable import is:

- **genuinely absent from this checkout** — leave it exactly as it is; or
- **an unfinished rename**, where the target exists under another name or path — this *may* be
  fixable, but only after proving the fix changes nothing (see below).

## Finding the full list

A build stops at the first failure, so iterating builds finds one problem per run. Instead, walk the
source tree once and resolve every import against the filesystem: try the project's extensions and
index files, honour path aliases, skip bare package specifiers.

**Skip specifiers inside comments.** A naive scanner reports an already-commented-out import as a
problem and sends the next reader chasing something that is already inert. Note known false positives
in the document explicitly.

Cross-check the static list against the real build: some entries will not be reachable from the entry
graph at all, and it is worth knowing which.

## The document

Write `REFACTOR/BUILD-VERIFICATION.md` containing:

1. **The exact list** — file, line, specifier — and for each, whether it reaches the build.
2. **The verbatim first error**, so it is recognisable.
3. **Known false positives**, named, with why they are inert.
4. **The comment-out script**, reproduced in full.
5. **The restore script**, reproduced in full.
6. **The proof step**, and what a successful run looks like — including the expected module or asset
   count from a run that actually **finished**.
7. **A verification log** — one row per run, with date, phase, result, and whether the restore was
   clean. Corrections go in as new rows, not by editing old ones.

## The procedure

```
assert the tree is clean                 # refuse to start otherwise
try:
    comment out exactly the listed lines
    run the build
    record the result
finally:
    restore
    assert the tree is clean again
```

Five rules that make this safe:

1. **`finally`, not "at the end".** A crashed build, a failed diff, an interrupt — the restore must
   run anyway. A verification run that threw is the single most likely way a programme ends up with
   commented-out imports sitting in someone's working tree.
2. **Refuse to start on a dirty tree.** Otherwise the final cleanliness check cannot distinguish your
   work from the harness's leftovers.
3. **Comment by line number with an assertion; restore by marker.** Prefix each commented line with a
   unique marker such as `// BUILD-VERIFY-COMMENT `. Assert before commenting that the line really is
   the import you expect — if a refactor moved it, the script must fail loudly rather than comment
   out something unrelated. Restoring by marker rather than line number stays correct even if the
   comment step half-completed.
4. **Preserve line endings.** If the repo checks files out with different line endings than the tool
   writes, a text-mode read-and-write silently converts the whole file. The VCS may hash both forms
   to the same object, so `diff` shows nothing while `status` shows the file as modified — and the
   working tree really is changed. Read and write in a mode that preserves the bytes.
5. **Prove the restore, do not assume it.** The porcelain status output must be empty and the marker
   must appear nowhere in the source tree.

## Fixing an unfinished rename, safely

If an entry turns out to be a rename that was not carried through, and the target exists, it can be
repaired — but only with an A/B proof that it changes nothing:

- Show that **nothing imports the file** (check for both direct-file and directory/barrel imports).
- Build **with the fix applied** and **with it stashed**, under otherwise identical conditions, and
  show the outputs are identical — same module count, same result.
- Run the full test suite.
- Do **not** delete the file, even if it appears unused. The out-of-scope-deletion constraint still
  applies.

Record the before and after in the document and move the entry into a "resolved" section rather than
deleting it, so the history stays legible.

## Every phase report says

> Build verified by the procedure. Imports restored. Tree clean.

with the actual evidence — the successful build line and the empty status output — not the claim
alone.

## When the build starts working

Delete `BUILD-VERIFICATION.md`, replace the gate with the plain build command, and record the change
in `GATES.md`. Re-baseline the bundle numbers at the same time: they were measured under the
workaround and will move.
