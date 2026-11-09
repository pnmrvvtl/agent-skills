# Falsification — running the probe without the fix

The probe must fail without the fix. This step converts "the tests are green" into evidence.

Ranked by safety. Take the highest one that fits.

## Pick what to break before picking how

A falsification is only evidence if the broken build still *has* the feature. Turn off the
trigger — delete the `onClick`, unmount the component, drop the route — and everything fails,
including a probe that measures nothing. You get a red run and zero information.

Break the smallest mechanism the claim depends on:

| Claim | Break this | Not this |
|---|---|---|
| Element morphs from A to B | the shared-element registry (bundle the animation lib twice, drop the transition tag) | the button that starts it |
| Band stays painted during a transition | the binding that snapshots that band | the whole header |
| Results come from endpoint X | point the client at the old endpoint | the search input |
| Debounced to 300 ms | set the constant to 0 | the handler |

When several mechanisms fix several actors — one binding for the icon, another for the logo —
falsify each separately and report a row per mechanism. A single combined revert cannot tell
you which actor each fix was responsible for.

## 1. Temporary git worktree (preferred)

The user's working tree is never touched, so a failure mid-way cannot lose work.

```bash
git worktree add ../verify-baseline <base-ref>   # e.g. origin/main, or HEAD~1
# install deps / build there if the project needs it, run the probe against that copy
git worktree remove ../verify-baseline
```

Cost: a second install/build for compiled or dependency-heavy projects. Worth it whenever the
change is already committed.

## 2. Feature flag / env var

If the fix sits behind a flag or config value, flip it, re-run, flip back. Cheapest and
completely reversible. Prefer this on servers.

## 3. Scoped stash (uncommitted work only)

Acceptable when the change is not committed yet and the tree is otherwise healthy.

```bash
git status --short                       # know exactly what is dirty first
git stash push -- <only the fix files>   # never a bare `git stash`
# run the probe — it must fail
git stash pop
git status --short                       # confirm the tree came back
```

Rules: never with a rebase/merge/cherry-pick in progress; never stash unrelated files; always
verify the pop restored what you expect; if the pop conflicts, stop and tell the user rather
than improvising.

## 4. Revert a single file from a ref

```bash
git show <ref>:<path> > <path>   # run probe, then restore
git checkout -- <path>
```

Fine for a one-file change; verify the restore.

## Reading the result

| Outcome | Meaning |
|---|---|
| Fails without fix, passes with fix, large gap | Real evidence. Report both numbers. |
| Passes both ways | The probe is blind. Fix the probe — do not claim success. |
| Fails both ways | Either the fix is incomplete or the probe is wrong. Triage before touching code. |
| Flaky either way | Not a proof. Increase repetitions or sharpen the signal. |

Quote the delta in the report as counts, not adjectives: "0 bad frames of 37 vs 32 of 37".

## When falsification is impossible

Some setups genuinely block it: unreproducible external state, a fix that cannot be isolated,
a build too expensive to duplicate. Then say exactly that in the report:

> Falsification not performed (reason). The green run shows the behaviour is correct now; it
> does not prove the probe would catch a regression.

Never let a one-sided green run be presented as proof.
