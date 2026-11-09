# Design Request

## Objective

Create implementation-grade static design package for `<feature-name>`.

## Required Output

- `DESIGN.html`
- `DESIGN.css`
- `DESIGN_INDEX.md`
- `screenshots/<screen>-mobile.png`
- `screenshots/<screen>-desktop.png`
- `assets/` when images/icons are needed

## Requirements

- Use real UI text and real states.
- Include mobile and desktop responsive variants.
- Include empty, loading, error, offline, locked, and permission states when relevant.
- Add anchors/IDs for every screen and major state.
- Put all colors, spacing, typography, radius, and shadows in CSS tokens.
- Avoid vague placeholders.

## Screens

- <Screen/state list.>

## Claude Design Prompt

Copy `design/DESIGN_PROMPT.md` into Claude and place returned files in `design/`.
