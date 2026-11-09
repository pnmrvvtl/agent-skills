---
name: pnmrvvtl-feature-intake
description: Convert raw feature descriptions into strict per-feature implementation docs, design handoff prompts, story backlogs, and progress protocols. Use when the user wants a reusable process for planning new software features from plain text, asks to create feature intake docs, asks to validate a copied design package, or asks to prepare implementation-ready stories before coding.
---

# Feature Intake

## Workflow

1. Read repo rules first: `AGENTS.md`, package scripts, existing docs/progress patterns, and nearby architecture docs.
2. Ask blocker questions before writing docs. Use `references/question-bank.md`.
3. Write files only after the user explicitly asks to create/generate intake docs.
4. Create one isolated feature folder: `docs/features/<feature-slug>/`.
5. Copy templates from `assets/templates/`, then fill them with feature-specific content.
6. Treat UI stories as draft until the design package is copied and validated.
7. Validate copied design package with `references/design-package-contract.md`.
8. For later implementation, require a progress file before edits and update it during/after work.

## Output Structure

```text
docs/features/<feature-slug>/
  instructions/
  design/
  progress/
```

Use these template roots:

- `assets/templates/instructions/` for intake docs.
- `assets/templates/design/DESIGN_PROMPT.md` for the Claude design prompt.
- `assets/templates/progress/` for progress protocol and run notes.

## Rules

- Keep stories <= 5 points.
- Never block a story by an Epic/container.
- Use `blockedBy` only for concrete story-to-story execution dependencies.
- Keep independent stories unblocked.
- Include a `Design Reference` section in every UI story.
- Before design is present, mark UI stories `Draft - awaiting design package`.
- High-impact unknowns block docs. Low-risk defaults go in `Assumptions`.
- Do not start implementation from intake work.
- Do not overwrite global `docs/instructions`; use per-feature folders.

## Verification Defaults

Generated docs must include these checks where relevant:

- `npm run verify:ts`
- `npm run verify:lint`
- `npm run verify:duplication`
- `npm run verify:file-lines`
- `npm run verify:tests`
- `npm run verify:functions` when backend/functions change
- Browser QA when web UI changes
- Maestro/emulator QA when app flow changes
