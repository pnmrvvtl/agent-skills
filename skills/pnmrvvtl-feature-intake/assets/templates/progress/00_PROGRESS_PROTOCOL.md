# Progress Protocol

## Rule

Every implementation run must create one new progress file before code edits:

`progress/YYYY-MM-DD_step-N_<slice>.md`

## Required Sections

- `Stories`: story IDs touched, status, points.
- `Pre-run Plan`: intended slice, likely files, verification targets, risk guardrails.
- `Live Checklist`: checkboxes updated during implementation.
- `Design Reference`: exact design anchors/screenshots used for UI.
- `Implemented`: behavior-level changes.
- `Verification`: commands and results.
- `Guardrails`: regressions, access, TypeScript/no-any, theme/design fit.
- `Known Gaps`: unfinished acceptance criteria and why.
- `Next`: next recommended stories.
- `Post-run Result`: final status.

## Verification Defaults

- `npm run verify:ts`
- `npm run verify:lint`
- `npm run verify:duplication`
- `npm run verify:file-lines`
- `npm run verify:tests`
- `npm run verify:functions` when backend/functions change
- Browser QA when UI changes
- Maestro/emulator QA when app flow changes

## Status

- `Backlog`: not started.
- `In progress`: code changed but not fully verified.
- `Blocked`: cannot continue without missing external dependency or user decision.
- `Done`: implemented and strongest practical checks passed.
- `Verified on device`: emulator/browser flow checked and recorded.
