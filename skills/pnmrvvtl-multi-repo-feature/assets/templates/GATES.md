# GATES

Entry point: `<single command>` -> `<script>`. Flags: `--repos=`, `--only=`, `--skip=`. Writes
`baselines/last-gates.json` (gitignored).

| Gate | Repos | Command | Threshold (set at the measured value) | A/B proof |
|---|---|---|---|---|
| ts-check | all | `npm run ts-check` | 0 errors | pre-existing / todo |
| lint | all | `npm run lint` | 0 errors, 0 warnings | todo |
| test:ci + coverage | all | `npm run test:ci` | L__. · S__. · F__. · B__. | todo |
| file-coverage | all | `check-new-file-coverage.mjs <repo> <base>` | >=90% statements per new/changed file | todo |
| duplication | all | `npm run duplication` | measured % per repo | todo |
| security | all | `check-security.mjs <repo> <base>` | 0 secrets (incl. untracked) · 0 SAST on changed · no new dep ids | todo |
| api-spec | main | `check-api-spec.mjs` | mock routes == `### METHOD /path` headings | todo |
| e2e | main | `playwright test <e2e dir>` | all pass | |
| visual | main | `playwright test -c playwright.visual.config.ts --update-snapshots=none` | global + per-32px-cell budget | |
| build | all | `npm run build` | succeeds (run last) | |

## Baselines (<date>, clean trees)

- Coverage (L/S/F/B): main __ / lib __ / host __
- duplication %: main __ / lib __ / host __
- tests: main __ / lib __ / host __

## A/B proof log

(mutation -> expected red output -> revert -> green; tree clean afterwards)
- <date> · `<ab-proofs script>` -> all PROVEN, tree unchanged. Record: `baselines/ab-proofs.json`.

## Named per-baseline exceptions

| Baseline | Global ex. | Cell ex. | Cause |
|---|---|---|---|

## Parked specs

| Spec | Park | Reason (measured number + cause) | Re-enable condition |
|---|---|---|---|
