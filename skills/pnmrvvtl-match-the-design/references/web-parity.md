# Proving parity on the web

The rule: **assert computed values, not only pixels.** A screenshot diff tells you *that*
something is off. `getComputedStyle` tells you *what*, and a failing test that names
`border-radius: 6px vs 8px` is worth ten red pixel maps.

`scripts/verify.mjs` already does the geometry, the solid fills, radii, opacity, the text metrics and
the per-region pixels for every mapped node. This file covers what it lists as `MANUAL` (effects,
strokes, gradients), the states and transitions, and how to read its failures.

Use the project's existing harness — Playwright, Cypress, vitest browser mode. Do not install a
framework to run a probe.

## Geometry

`getBoundingClientRect()` for position and size. Compare against the spec's box.

Watch for the classic sources of a systematic 1px delta:

- `box-sizing` — a spec width from Figma is the rendered box; `content-box` plus padding is not
- `strokeAlign` in the design: `INSIDE` keeps the box, `OUTSIDE` grows it by the stroke weight
- device pixel ratio when comparing screenshots rather than values
- sub-pixel layout — compare with the tolerance, do not round first

## Computed styles

Read them in the page and compare in the test:

```js
const style = await el.evaluate((node) => {
  const s = getComputedStyle(node);
  return {
    color: s.color,
    backgroundColor: s.backgroundColor,
    borderRadius: s.borderRadius,
    boxShadow: s.boxShadow,
    opacity: s.opacity,
    fontFamily: s.fontFamily,
    fontSize: s.fontSize,
    fontWeight: s.fontWeight,
    lineHeight: s.lineHeight,
    letterSpacing: s.letterSpacing,
    padding: s.padding,
    gap: s.gap,
    transitionProperty: s.transitionProperty,
    transitionDuration: s.transitionDuration,
    transitionTimingFunction: s.transitionTimingFunction
  };
});
```

Normalise before comparing. Browsers return `rgb(26, 40, 87)` regardless of how the colour was
authored, and `boxShadow` comes back in a canonical order that differs from CSS input order.
Convert both sides to the same representation rather than string-matching what you wrote.

## States

Drive each one for real, and assert the whole property set per state — not just the one property
you expected to change.

| State | How |
|---|---|
| hover | `locator.hover()` |
| focus / focus-visible | `locator.focus()`, or `keyboard.press('Tab')` for focus-visible |
| active | `mouse.down()` over the element, assert, then `mouse.up()` |
| disabled | render with the disabled prop, assert it is also non-interactive |
| selected / checked | drive the real interaction, not a class you set by hand |

Never assert a state by adding the class yourself. That proves the stylesheet, not the
component.

## Transitions

Two levels, and the first is not enough on its own:

1. **Declared** — `transitionProperty`, `transitionDuration`, `transitionTimingFunction` match
   the spec. Cheap, catches a wrong easing or a missing property.
2. **Observed** — the property genuinely animates rather than snapping. Sample it across frames
   from the trigger until it settles, then assert the series is monotonic and has more than two
   distinct values.

```js
const series = await el.evaluate((node) => new Promise((resolve) => {
  const values = [];
  const start = performance.now();
  const tick = () => {
    values.push([performance.now() - start, getComputedStyle(node).opacity]);
    if (performance.now() - start < 600) requestAnimationFrame(tick);
    else resolve(values);
  };
  requestAnimationFrame(tick);
}));
```

A two-value series means it jumped. That is the bug this catches, and a duration assertion alone
would have passed.

Disable animations globally *only* for screenshot diffs, never for the transition assertions —
otherwise the test proves the animation is off.

## The pixel stage

`verify.mjs` compares the root's screenshot with the reference at the reference's scale:

- it first aligns the two within one CSS pixel, so the regions report wrong shapes and missing ink;
  placement is the geometry check's job and runs with exact numbers
- it splits the root into 16px regions and fails any region with more than 10% differing pixels, so
  a wrong icon cannot hide inside a large, mostly correct component
- text boxes are masked by default, because the design tool and the browser rasterise text
  differently; text is held by its metrics instead
- `compare.png` shows design | page | differences side by side, failing regions outlined

Mask genuinely dynamic regions (timestamps, avatars, photos seeded from real data) with a `masks`
entry and its reason. Never mask to make a real difference go away, and never raise `cellMax` to pass;
a residual that is real and understood gets a named override with its measured number.

## Responsive

If the spec has more than one breakpoint, every phase above runs per breakpoint. A component
matched at one width is matched at one width.
