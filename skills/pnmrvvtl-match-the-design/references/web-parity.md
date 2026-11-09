# Proving parity on the web

The rule: **assert computed values, not only pixels.** A screenshot diff tells you *that*
something is off. `getComputedStyle` tells you *what*, and a failing test that names
`border-radius: 6px vs 8px` is worth ten red pixel maps.

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

## Screenshot diff as a backstop

Run it after the value assertions, against the Figma-rendered PNG at the same scale. Mask
genuinely dynamic regions — timestamps, avatars, anything seeded from real data. A diff over an
unmasked clock fails forever and gets ignored, which is worse than no diff at all.

## Responsive

If the spec has more than one breakpoint, every phase above runs per breakpoint. A component
matched at one width is matched at one width.
