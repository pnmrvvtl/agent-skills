# Frontend probes — browser runtime

## Before the first probe: inventory the actors

Open the interaction and name everything the eye can follow inside the window. For a header
search that expands, that is: the magnifier icon, the logo, each right-side icon, the header
band itself, the backdrop, the input, the results overlay — plus the URL and `document.title`.

Each of those gets its own series. The bug you did not think about lives on the actor you did
not sample: a logo that blinks out for 300 ms, an icon that reappears only after the animation,
a band that lets the backdrop show through.

Cheap way to build the list without guessing — diff the DOM around the interaction:

```js
// before the trigger
const before = new Map(
  [...document.querySelectorAll('header *, [class*="overlay"], [class*="backdrop"]')]
    .map((el) => [el, el.getBoundingClientRect()]),
);
```

then, per frame, record for every element in that map: `rect.left/top`, computed `opacity`,
`visibility`, and whether it is still connected. Anything that goes to `opacity: 0`, detaches,
or teleports is an actor with its own claim.

## Parity porting: diff against the reference

For "make B behave like A", run the *same probe file* against both apps and compare series, not
adjectives:

1. point the probe at A (the reference), record `{actor → [values per frame]}`, save the JSON;
2. run the identical probe against B;
3. assert per actor: same set of visible actors, travel of the same sign and comparable
   magnitude, same number of frames with a gap (normally zero), same final URL shape.

Report both tables. "Matches the reference on 6 of 6 actors" is a claim; "looks the same" is not.

## Signal per bug class

| Claim is about | Sample this | Every |
|---|---|---|
| Active/selected state during a transition | `element.className`, `aria-*`, `data-state` | animation frame |
| Scroll-linked behaviour (sticky, reveal, nav sync) | `window.scrollY` + the signal together | animation frame |
| Animation / transition | `getBoundingClientRect()`, `getComputedStyle(el).opacity/transform` | animation frame |
| Layout, gap, alignment | rects of both elements, then compute the delta | after settle + on resize |
| Async UI (loading, optimistic update, retry) | rendered text/role/state + network timing | frame or mutation |
| Focus / keyboard | `document.activeElement` | after each key |
| Re-render cost | React devtools hook commit counts | during interaction |

Class names are hashed by CSS modules — match with `[class*="isActive"]` or a regex on
`className`, never the raw source name.

## Follow a moving element by identity, never by position

Position-nearest matching breaks the moment the element moves further between frames than the
gap to a static twin — and shared-element transitions always leave static twins around.

```js
const tracks = new Map(); // Element -> number[]
const sample = () => {
  for (const el of root.querySelectorAll('svg')) {
    const track = tracks.get(el) ?? [];
    track.push(Math.round(el.getBoundingClientRect().left));
    tracks.set(el, track);
  }
};
// afterwards: the actor is the track with the largest span, and it must be gradual
const spans = [...tracks.values()].map((t) => Math.max(...t) - Math.min(...t));
```

Assert three things on the winning track, not one: total travel, ≥5 distinct intermediate
positions (a jump has two), and monotonic direction.

## Shared-element transitions render clones, not your element

Libraries in this family (view-transitions, react-smooth-flow, framer shared layout) hide the
real node and animate a **clone in an overlay root** (`example-overlay-root`, `::view-transition`,
a portal div). Query the real element and you will record a value frozen at the start or the
end, and conclude "no animation" or "no movement" while the screen is animating correctly.

Find the overlay first: dump `document.body.children` and `document.getAnimations().length`
right after the trigger. If animations are running but your element is static, you are sampling
the wrong node.

**Single instance matters.** These libraries keep the transition registry in module state. A
component library that bundles its own copy (linked workspace package, `external` not set in
its build) gives you two registries: the app's `startTransition` never sees the library's
`Binder`, so paired morphs silently degrade to appear/disappear. Check the built artifact for
an inlined copy before blaming the CSS.

## "Visible" is not "painted"

`opacity > 0` on the real node says nothing when a clone covers it, or when the node is hidden
and the clone carries the pixels. For "the header stays visible", sample what is actually drawn
at fixed points instead:

```js
const colourAt = (x, y) => {
  let el = document.elementFromPoint(x, y);
  while (el) {
    const bg = getComputedStyle(el).backgroundColor;
    if (bg && bg !== 'rgba(0, 0, 0, 0)') return bg;
    el = el.parentElement;
  }
  return 'none';
};
```

Pick points **outside** the element that is expanding (a search bar over the header hides the
band under it), and assert the colour is the expected one in every frame. A dark backdrop
colour showing up where a white band belongs is the machine-readable form of "it blinks".

## When the DOM says fine and the user says it blinks, screenshot the frames

Every DOM-derived signal — `opacity`, `visibility`, hit-testing, "a clone is present at that
point" — can report a healthy element that the compositor never draws where you think. If the
user reports blinking and your DOM probe is green, the DOM probe is wrong. Go to pixels:

```js
// baseline before the trigger, then a screenshot per tick during it
const png = await page.screenshot({ clip: headerBox, animations: 'allow' });
// per actor region: share of pixels darker than the background
const { data, info } = await sharp(png).extract(regionRelativeToClip).raw()
  .toBuffer({ resolveWithObject: true });
```

Ink ratio (`ink / baselineInk`) per actor per frame is the honest signal: `1.00` means the
actor is drawn as usual, `0.00` means it is gone, `>1` means something dark (a backdrop) covers
it. A `1,1,0.9,0.7,0,0,0,1,1` series is exactly what the eye calls a blink.

Costs a decode dependency (`sharp`, `pngjs`) and ~40 ms per frame — still cheap next to a
wrong "verified".

## Visual parity gate — mandatory for UI ports

"Make B look like A" is not verified by behaviour probes. Before reporting a port done, render
both apps on the **same query/fixture** and produce two artifacts:

1. **A pixel diff of the region that must match.** Screenshot both, crop the common area (below
   the header, inside the panel — whatever is in scope), and count differing pixels:

```js
const region = { left: 0, top: 90, width: 1280, height: 630 };
const [a, b] = await Promise.all([
  sharp('reference.png').extract(region).raw().toBuffer({ resolveWithObject: true }),
  sharp('port.png').extract(region).raw().toBuffer({ resolveWithObject: true }),
]);
// count pixels whose summed channel delta exceeds ~45; report the percentage
```

Under ~0.5 % is parity; anything above that is a list of unfixed differences, not noise.

2. **A computed-style table for the elements that carry the design.** Read them from both apps
   in the same pass and put them side by side in the report:

| Check | Read | Catches |
|---|---|---|
| Title / body text | `color`, `fontSize`, `fontWeight`, `fontFamily` | inherited link colour, missing font, wrong token |
| Icons | `svg` box `width x height`, computed `color`, `fill` attr | a look-alike icon from the wrong folder, an invisible one |
| Images | `img.naturalWidth`, `complete`, resolved `src` | broken CDN/bucket host — the only way to see a 404 image |
| Text with separators | `textContent` of the row | mojibake from a bad copy (`â€¢` instead of `•`) |
| Element boxes | `getBoundingClientRect().left/width` of sidebar, cards, input | CSS variables the host app defines differently |

Both artifacts belong in the report. Without them "same as A" is an opinion.

## Animation libraries need their stylesheet imported

Shared-element libraries ship CSS that takes their overlay/snapshot elements out of flow
(`example-overlay-root { position: absolute }`, view-transition pseudo-elements, portals). Forget
the import and the custom elements are unstyled inline boxes appended at the end of `<body>`:
snapshots stack **in normal flow**, the real element stays hidden for the whole transition, and
the band it lived in goes blank for a few frames. Everything still "runs" — animations play,
clones exist, the DOM looks right.

When porting a component between apps, diff the CSS entry points too, not just the component
tree: a missing `import 'lib/style.css'` reproduces as "the animation is subtly broken".

## The rAF sampler

The workhorse. Install it **before** the interaction, stop it when the page settles.

```js
await page.evaluate(() => {
  window.__samples = [];
  window.__done = false;
  const started = performance.now();
  let lastY = window.scrollY;
  let moved = false;
  let still = 0;

  const tick = () => {
    const y = Math.round(window.scrollY);
    window.__samples.push({ t: Math.round(performance.now() - started), y, signal: read() });

    if (Math.abs(y - lastY) > 1) { moved = true; still = 0; } else { still += 1; }
    lastY = y;

    if ((moved && still > 25) || performance.now() - started > 8000) { window.__done = true; return; }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});
```

Then assert over the in-flight slice, not the last sample:

```js
const inFlight = samples.filter((s) => s.y > 0 && s.y < finalY - 5);
const bad = inFlight.filter((s) => !expected(s.signal));
expect(bad.length).toBeLessThanOrEqual(2); // slack for the commit right after the trigger
```

Always `console.log` the first few bad samples. That log is what tells you, in Phase 6,
whether the instrument or the app is broken.

## Tool artifacts that will waste your time

- **`locator.click()` scrolls first.** Playwright's actionability check can scroll the page
  before clicking, which pollutes samples and can end the recording before the real click.
  Take `boundingBox()` and use `page.mouse.click(x, y)`, after asserting the box is inside the
  viewport.
- **Recorder stops too early.** A settle detector that only needs "moved once, then still"
  will trigger on the tool's own scroll. Require the movement you actually care about, or arm
  the detector only after the trigger.
- **The element is below the fold.** A mouse click at `y > viewport.height` lands nowhere and
  the page never moves. Park the page at a known scroll position first, then bring the element
  into view horizontally with `scrollIntoView({ block: 'nearest', inline: 'center' })`.
- **Headless disables or speeds up animations** in some setups. Confirm the animation actually
  runs by checking the trace has intermediate positions, not a jump.
- **Lazy-mounted sections** may not exist when the probe starts. Assert the anchor/target
  exists before clicking.

## Environment

- Start the dev server if it is not up; reuse it if it is. Warm the page (hydration) before
  sampling — a `networkidle` wait plus a short settle.
- Real data matters: pick fixtures/slugs that actually have the sections/records involved, and
  put them in the report.
- Dev builds are slower than production, which makes them the *harsher* case for timing claims.
  Say which one you used.
- Accept cookie/consent banners up front (cookie injection) so they cannot intercept clicks.
- Mobile/touch is a different runtime: a separate device project, not an assumption. If you did
  not run it, list it under "not covered".
