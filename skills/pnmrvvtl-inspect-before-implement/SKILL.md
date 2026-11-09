---
name: pnmrvvtl-inspect-before-implement
description: Use when the user asks to inspect a project before implementation, confirm whether the task is clear, identify ambiguity, or ask clarifying questions before making code changes. Triggers include requests like "inspect first", "no implementation yet", "tell me if everything is clear", "ask questions before coding", or similar pre-implementation review instructions.
---

# Inspect Before Implement

Before making code changes, inspect enough project context to understand the requested change.

## Workflow

1. Read the task and extract concrete acceptance criteria.
2. Inspect relevant files, routes, components, hooks, API layers, tests, and existing patterns.
3. Identify where the change likely belongs.
4. Determine whether implementation is clear.
5. If clear, report the intended implementation scope without editing files.
6. If unclear, ask concise clarifying questions before implementation.
7. Do not modify files, run formatters, or start implementation until the user explicitly confirms or asks to proceed.

## Inspection Rules

- Prefer direct evidence from the codebase over assumptions.
- Check nearby tests and existing conventions.
- If multiple interpretations are plausible, state the ambiguity.
- If backend/frontend responsibility is unclear, say what the frontend currently does and what appears to come from API data.
- Stop once enough evidence exists to answer whether the task is clear.

## Output

Keep response terse.

If clear:

`Clear. Scope: ... Files likely: ... Tests likely: ...`

If unclear:

`Unclear: ... Questions: ...`

If partially clear:

`Mostly clear. Known: ... Unclear: ... Questions: ...`
