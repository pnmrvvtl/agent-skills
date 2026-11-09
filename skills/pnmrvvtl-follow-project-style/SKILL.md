---
name: pnmrvvtl-follow-project-style
description: Use when implementing, modifying, or extending an existing software project. Before coding, inspect the current codebase and follow its established architecture, design system, component patterns, styling conventions, state management, API access patterns, helpers, utilities, naming, file organization, and testing approach. Trigger this skill whenever a task requires changes inside an existing app or repository and the implementation should feel native to that project.
---

# Follow Project Style

Before implementing changes in an existing project, analyze the codebase and make the solution match the project's established style and architecture.

## Workflow

1. Inspect the relevant project structure before coding.
2. Identify existing patterns for the area being changed.
3. Reuse existing project primitives instead of introducing new ones.
4. Implement the task in the same style as the surrounding application.
5. Validate that the result fits the existing architecture, UI, and conventions.

## Analyze First

Check the project for existing conventions in:

- UI components and shared component folders such as `components`, `shared`, `ui`, `common`, or similar.
- Styling systems such as theme files, design tokens, CSS variables, Tailwind config, styled components, CSS modules, SCSS variables, or existing class patterns.
- Color, spacing, typography, radius, shadows, layout, breakpoints, and interaction states.
- State management patterns such as Redux, Zustand, MobX, React Query, Context, stores, composables, services, or framework-native state.
- API request layers such as clients, services, hooks, repositories, generated SDKs, fetch wrappers, interceptors, or query and mutation helpers.
- Utility and helper folders such as `utils`, `helpers`, `lib`, `shared/lib`, or similar.
- Form handling, validation, error handling, loading states, empty states, and notifications.
- Routing, page layout, permissions, feature flags, localization, analytics, and configuration patterns.
- Type definitions, schemas, DTOs, model naming, and validation libraries.
- Test structure, test utilities, mocks, factories, and existing coverage style.

## Implementation Rules

Prefer existing project patterns over new abstractions.

Reuse existing components, helpers, hooks, services, constants, types, and style tokens whenever they fit the task.

Do not introduce a new UI library, styling approach, state manager, API client, validation library, or architectural pattern unless the task explicitly requires it or the existing project has no suitable pattern.

Use existing theme values, CSS variables, design tokens, or configured utility classes for colors and visual styling. Avoid hardcoded colors, spacing, shadows, and typography when the project already provides tokens or variables.

Place new files near similar existing files and follow the same naming, export, and folder conventions.

Match the local TypeScript, JavaScript, framework, and testing style used in nearby code.

If multiple patterns exist, prefer the one used closest to the code being changed.

If no clear pattern exists, choose the smallest implementation that fits the current architecture and avoid broad refactors.

## Porting a component to another app or a shared library

Moving a component out of the app it grew up in is not a copy — the app it leaves behind is
full of things the component silently leans on. Treat the source app as the source of truth and
port the environment with the code.

**Inventory the implicit dependencies first.** Read the component and its stylesheet and list
what comes from outside it:

- global CSS that reaches it: link colours (`a { color: … }`), heading rules, resets,
  `body`-scoped overrides;
- CSS custom properties it reads (`--padding`, `--header-height`, palette tokens) and what they
  are set to in the source app;
- stylesheets shipped by third-party packages the component uses — an animation or overlay
  library whose CSS is imported once in the source app's entry point;
- fonts, icon sets, portal roots (`#modalRoot`, `#notificationRoot`), z-index ladders;
- env vars, API base paths, CDN/bucket hosts, image-URL helpers.

Each one gets a decision: pull it into the component, or expose it as a prop / CSS variable with
the source app's value as default. A component that renders correctly only inside its original
globals is not ported yet.

**Diff every import against the source of truth.** When the target already contains an older
copy, fixing the file you are editing is not enough — the stale copy's imports stay behind and
point at look-alike modules (`icons/context-a/ExampleIcon` vs `icons/context-b/ExampleIcon`,
a 16px close icon vs the 12px one). Walk the import list of the source component and confirm,
file by file, that the target resolves to byte-identical modules; copy the missing ones under
paths that mirror the source.

**Copy files byte-for-byte.** Use `cp`, `git show`, or an editor write — never a shell text
pipeline (`Get-Content | Set-Content`, `type`, `>`), which quietly mangles UTF-8: bullets,
dashes and non-Latin comments come out as mojibake that no type-checker will catch. After
copying, diff against the source; only path rewrites should show up.

**A re-implemented helper is unfinished until its output matches.** If the source helper cannot
move as-is (framework-specific imports, server-only APIs), rebuild it, then feed both versions
the same real inputs and compare the produced strings — URLs, class names, formatted numbers.
"Looks like the same logic" is how a search result ends up pointing at the wrong bucket.

**Keep the two copies convergent.** When you must change the shared component, apply the same
edit to the source app's copy in the same commit, so the next diff between them stays empty and
the source of truth keeps its name.

## Before Editing

After planning but before making code changes:

1. Read the files most relevant to the requested change.
2. Search for similar existing features or implementations.
3. Identify reusable components, helpers, API methods, types, and style tokens.
4. Decide where the change belongs based on existing project organization.

## Final Check

Before finishing:

- Confirm the implementation reuses existing project primitives where appropriate.
- Confirm styling uses the existing theme or style system.
- Confirm API and state logic follows the existing project approach.
- Confirm new code is placed and named consistently with nearby files.
- Run relevant checks or tests when available.
- For a port: render both apps on the same data and compare — the appearance is part of the
  deliverable, and it is the part unit tests never see. `pnmrvvtl-verify-for-real` describes the
  visual parity gate.
