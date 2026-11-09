# Frontend invariants and sweep

## Contents
- Invariants F1–F14
- Sweep recipe (Playwright)
- Measurement traps

## Invariants

Check every one in every state. Tolerance 1px unless the design budget says otherwise.

| # | Invariant | How to measure |
|---|-----------|----------------|
| F1 | A decoration is attached to its owner: underline, focus ring, badge, tooltip arrow, active indicator | decoration rect vs owner rect: underline `top >= text.bottom - 1` and within `[left, right]`; ring encloses owner; arrow points at owner centre |
| F2 | The same item looks and behaves the same on every render path | compare computed styles and decoration rects of the item inline vs in popover / after reveal / after resize |
| F3 | Nothing leaves its container unless it is meant to scroll | child rect inside parent rect; `scrollWidth <= clientWidth` on non-scrolling boxes; no page horizontal scroll |
| F4 | Truncated text has a way to see it in full | element with `text-overflow: ellipsis` and `scrollWidth > clientWidth` has `title`, tooltip or expand |
| F5 | Interactive elements do not overlap and are hittable | `document.elementFromPoint(centre)` returns the element or its child |
| F6 | Every interactive element is keyboard reachable and shows focus | Tab through; each gets focus and a visible change in outline/box-shadow/background |
| F7 | Hover, focus, active and disabled differ visibly where the design says so | computed styles per interaction state |
| F8 | No empty or broken artefacts: stray separators, empty bullets, arrows with nothing to scroll, broken image icons | screenshot review; `img.naturalWidth > 0` |
| F9 | Layout is stable after settle | rects equal across two frames after fonts and images load |
| F10 | No console errors or warnings, no failed requests the UI did not expect | collect `console` and `requestfailed` events per state |
| F11 | No transient wrong state: during and after a change, no element shows another item's state — a flash of the old highlight, a fading active background, a stale label, a one-frame jump | sample every animation frame from the trigger until settle; per item keyed by identity, assert its state and label match in **every** frame, not only the last |
| F12 | The URL is right in every frame after an action, and that URL opened fresh, reloaded or reached by Back shows the same thing | `location.href` per frame from the trigger; open the final URL in a new context and compare where its target is; press Back |
| F13 | A re-render updates the page, it does not rebuild it | keep references to nodes before the action, then `isConnected` on each; a key made anew per render shows here and nowhere else |
| F14 | When an action has finished, nothing moves by itself: one continuous motion, and the target then stands still | per frame position of the target from the trigger to settle: no stop and restart, no frame against the direction, no drift after landing. Run it on the bad profile, it hides on a fast one |

## Sweep recipe

Use the project's harness if it has one (`playwright.config.*`, Storybook, Cypress). Otherwise a
standalone Playwright script against the running dev server.

```ts
const states = buildStates(); // from Step 3: { data, viewport, path, interaction }
for (const s of states) {
  await page.setViewportSize(s.viewport);
  await loadWith(page, s.data);                 // fixture, route mock, or story args
  await page.evaluate(() => document.fonts.ready);
  await reach(page, s.path);                    // e.g. hover the "…" trigger, open popover
  await apply(page, s.interaction);             // hover / keyboard focus / mousedown on the item
  await settle(page);                           // two rAF, animations finished
  const violations = await page.evaluate(checkInvariants); // F1–F10, F13 by measurement
  // F11, F12, F14: for state changes, record every frame from the trigger to settle, then assert per frame
  await page.screenshot({ path: `${out}/${s.id}.png` });
  record(s, violations);
}
```

- Apply interactions to items **after** reaching their render path, inside that path.
- Key items by identity (`data-testid`, text), never by index.
- Write screenshots outside the repo; cite the absolute path in the report. Open and look at
  every screenshot, grouped by state, before reporting.

Before writing this by hand, run `pnmrvvtl-verify-for-real/assets/observe.mjs` on the changed area. It clicks every
element in a scope under a fast and a bad profile and checks F9, F10, F12, F13 and F14 itself. It knows nothing about the
task, so it is the floor: the states from Step 3 and the checks only this feature needs are still yours to add.

## Measurement traps

- A list keyed by index (`key={i}`) makes React reuse a DOM node for a different item after a
  reorder; with `transition: all` the old state fades out on the wrong item. Only F11 sampled per
  frame catches it; end-state assertions and jsdom tests pass.
- An element mounted while hidden (`display:none`, zero size, off-screen portal) measures 0 at
  mount. Code that positions a decoration from a mount-time measurement is wrong after reveal;
  the sweep catches it only if it measures **after** the reveal.
- Portals render outside the owner's DOM parent; compare rects in viewport coordinates.
- Measure after `document.fonts.ready` and image load; fallback-font metrics differ.
- Headless browsers may skip hover transitions; wait for `transitionend` or disable animation
  only for the measurement, never for the screenshot review.
