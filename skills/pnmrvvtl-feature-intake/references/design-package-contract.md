# Design Package Contract

Preferred copied design package:

```text
docs/features/<feature-slug>/design/
  DESIGN_PROMPT.md
  DESIGN.html
  DESIGN.css
  DESIGN_INDEX.md
  screenshots/
  assets/
```

## Required Files

- `DESIGN_PROMPT.md`: exact prompt used to generate the design.
- `DESIGN.html`: static implementation-grade design with all screens in one page.
- `DESIGN.css`: tokens, layout, typography, states, responsive rules.
- `DESIGN_INDEX.md`: screen names, anchors/selectors, keywords, screenshot mapping.
- `screenshots/`: PNGs for mobile and desktop variants for each important screen.

## Validation

Before marking UI stories ready:

- Confirm every UI story has matching design screen(s).
- Confirm each screen has an anchor or stable selector in `DESIGN_INDEX.md`.
- Confirm mobile and desktop screenshots exist when responsive behavior matters.
- Confirm empty, loading, error, locked, offline, and permission states exist when referenced by acceptance criteria.
- Confirm design uses real text and concrete controls, not vague placeholders.

## Fallback

If only MHTML is available, require:

- `DESIGN.mhtml`
- `DESIGN_INDEX.md`
- screenshots for key states
- extraction instructions or exact keywords
