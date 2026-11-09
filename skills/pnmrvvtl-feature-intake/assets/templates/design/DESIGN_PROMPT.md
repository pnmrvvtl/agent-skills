# Claude Design Prompt

Create an implementation-grade static design package for `<feature-name>`.

## Output Files

Return these files:

- `DESIGN.html`
- `DESIGN.css`
- `DESIGN_INDEX.md`
- `screenshots/<screen>-mobile.png`
- `screenshots/<screen>-desktop.png`
- `assets/` for any images/icons

## Design Requirements

- Build all screens and important states in one static HTML page.
- Use anchors/IDs for every screen and major state.
- Put reusable colors, spacing, typography, radius, shadows, and breakpoints in `DESIGN.css` tokens.
- Use real UI text, realistic data, and concrete controls.
- Include mobile and desktop responsive variants.
- Include loading, empty, error, offline, locked, disabled, and permission states when relevant.
- Avoid vague placeholders and decorative-only UI.
- Keep screenshots named exactly as listed in `DESIGN_INDEX.md`.

## Product Context

<Paste product brief, acceptance criteria, user flows, and component spec here.>

## Screens To Produce

- <Screen/state name>: <purpose and required elements.>

## DESIGN_INDEX.md Format

For each screen:

- Screen name
- HTML anchor/selector
- Keywords
- Mobile screenshot path
- Desktop screenshot path
- Related acceptance criteria
