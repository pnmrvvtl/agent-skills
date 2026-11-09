# Visual harness — capture and compare

For any refactor that touches UI, the screenshot gate is the safety net that makes phases about
moving code survivable. It is also the one most often built wrong.

The wrong version takes screenshots against a live backend. Run it twice a day apart and everything
differs — none of it a regression. Within a week the tolerance has been raised until the gate catches
nothing.

The right version has **two modes, kept strictly apart.**

| | **Capture** | **Compare** |
|---|---|---|
| Network | **live** — real backend, real auth | **replayed from the capture** |
| When | deliberately, by a human, before a phase | every gate run |
| Produces | baseline images + recording + session + manifest | new images + diff report |
| Needs credentials | yes | **no** |

**Replay happens only in Compare.** If Capture ever reads a recording, the baseline becomes a
recording of a recording and the gate is measuring nothing.

## What Capture records

One run produces a **capture bundle** — everything Compare needs, nothing it does not:

```
<baseline-root>/<phase>/<target>/          target = dev | prod
  manifest.json          route list + outcomes, viewport, capture instant, env fingerprint, vcs sha
  network.har            every request/response, all origins, bodies embedded
  storage-state.json     cookies + local storage at capture time (the session lives here)
  routes/<slug>.png
  components/<id>.png
```

Most browser automation tools record and replay HAR natively — prefer the built-in pair over a
hand-rolled interceptor.

Three parts do the work:

1. **The recording.** Record with bodies included and embedded, so the bundle is self-contained.
   Record **all origins**, not only the application's own API — see below.
2. **The session.** Capture whatever the auth library persists. Check *where* it persists first: if
   it uses local storage, standard storage-state capture works; if it uses session storage, most
   tools will not capture it and the design needs a different answer. **Verify this before
   committing to the design.**
3. **The manifest.** The capture instant as an epoch value, the discovered route list with outcomes,
   the viewport, the VCS sha, and an **environment fingerprint** — the sorted names of the build-time
   variables that were defined, plus a hash. **Names only, never values.** Compare refuses to run on a
   mismatch, because build-time environment variables are inlined into the artifact: a build made
   with a different environment is a different program and every diff would be spurious.

## Three decisions inside the replay that matter more than the mechanism

- **A recorded entry with no body is not a response.** Drop it before anything else - see trap 31.
  A missing body can look like an application or font failure.

- **Replay everything, including auth.** Not just the application API. This is what makes Compare
  runnable with no credentials and no network, which is in turn what lets CI run it later. Restricting
  replay to the API leaves the auth library talking to the real identity provider, and the gate still
  depends on a live session.
- **Unmatched requests must fail loudly, never fall through to the network.** A fallback quietly
  reintroduces exactly the non-determinism this design removes. Collect unmatched requests and report
  them as a **harness failure**, kept separate from pixel diffs — "the app asked for something new"
  and "the app looks different" are different findings, and conflating them wastes hours.
- **Freeze the clock to the capture instant.** Not only for visible timestamps. Auth libraries check
  token expiry arithmetically against the current time; with the clock frozen the recorded token is
  still valid, so the library never attempts a refresh the recording cannot serve. It also stabilises
  any request whose URL embeds "today" — and a URL that drifts is a URL the recording cannot match.

## Freezing the rest

Injected before any application code runs:

- current-time functions pinned to the capture instant;
- the random source replaced with a seeded generator, so generated ids are stable;
- animations and transitions disabled globally via injected CSS;
- chart and animation libraries' mount animations disabled **at the harness level**, never by editing
  product code.

## Screenshots are full-page, and comparison is two-stage

**Capture full-page screenshots, not viewport ones.** The viewport is an arbitrary window onto the
page. A refactor that breaks layout below the fold is exactly what this gate exists to catch, and a
viewport shot misses it. Record the full-page width and height into the manifest alongside each
image.

**Compare in two stages, cheapest discriminator first:**

| Stage | Compares | On failure |
|---|---|---|
| **1 — dimensions** | full-page width and height against the baseline | report the size delta and **stop for that page** |
| **2 — pixels** | per-pixel difference, only where dimensions match exactly | report the changed-pixel ratio and write a diff image |

Stage 1 is not an optimisation, it is what makes the output readable. **A pixel diff between images
of different sizes is worthless**: any comparator reports near-total difference the moment a page
grows by one row, which buries the real change under a wall of red and tells you nothing about where
or why. "This page got 240px taller" is a finding someone can act on; "97% of pixels differ" is not.

Only pages that survive stage 1 reach stage 2, where a difference is a real signal about real content
and can be held to a tight tolerance. The pixel tolerance therefore applies to **stage 2 only** —
dimensions are exact, because a page either has the same shape or it does not.

Report the two separately, and separately again from a **harness failure** (a request the recording
does not contain). "The app asked for something new", "the page changed shape" and "the page changed
colour" are three different findings.

## Waiting

Never a fixed sleep. Wait for network idle, then for fonts to be ready, then for the application's
own loading indicator to disappear, then one frame. A screenshot taken mid-render is a flaky test
that will be blamed on the tool.

## Masking

Only for what cannot be frozen, and **by name, per element**. Never loosen the global tolerance to
absorb one unstable element. Typical candidates: images from a signed-URL store, and whatever the
three-run stability check proves unstable.

## Discover routes, do not assume them

The reachable set depends on the signed-in account's permissions and role. Probe each candidate route
and record the outcome as `captured`, `redirected` (with destination), `not-permitted`, or `blank`
(never left the loading screen). Write **all four** outcomes into the manifest.

Compare then diffs the captured ones **and asserts the set itself has not changed**. A route that was
reachable before a refactor and is not after is exactly the breakage worth catching.

This also makes the harness degrade honestly: on a machine that cannot complete a login it records
every route as `blank` and says so, instead of silently producing a folder of spinner screenshots.

## The modal surface

Modals are a third surface, alongside routes and the component catalogue, and they are gated the
same way. Four rules carry all of it:

1. **Declare, do not discover.** Find where the app itself declares its modals - a registry, a card
   key, a route table - and transcribe it into `{route, id, trigger}` entries. The trigger is a CSS
   selector. A declared trigger that is missing at capture is a **reported failure**, so the map
   cannot rot into silently-missing coverage.
2. **Screenshot the dialog, not the page.** The route baseline already covers the page. Shooting the
   whole viewport makes every diff ambiguous between "the modal changed" and "the page behind it
   changed" - and picks up the host page's own noise.
3. **Both views, by reading the toggle.** Where a dialog exposes a summary/detailed control, capture
   both, and name each screenshot after the state actually read. Some dialogs open with summary
   already checked.
4. **Capture is slow, compare is fast.** Capture walks every declared target with a live network;
   compare re-opens the recorded triggers against the recording. Measure the cost in the current app.

Compare must re-open modals through the **same recorded trigger**, and must walk the views with the
**same code** capture used (traps 35-37).

## Development build and production build

Capture and compare **both**, and never diff one against the other. They are different programs —
different build mode, minification, framework development-only code paths. A development-versus-
production difference is reported as information, never as a failure.

If the production build needs a workaround to complete (see `build-verification.md`), the sequence is
fixed and the restore is the risk:

```
assert the tree is clean
try:
    apply the build workaround
    build
    serve the built output
    capture / compare
finally:
    restore
    assert the tree is clean
```

Use the same environment for the production capture and the production compare; the manifest
fingerprint is checked before the build starts.

## Tolerance

Start permissive for the very first capture, then **ratchet down** to whatever survives three
consecutive Compare runs against the same bundle. Record the number in `GATES.md`.

It is only ever lowered. Raising a tolerance to make a diff go away is the one move this gate cannot
survive.

## Secrets, and the limitation to state out loud

The bundle contains a live session and real production data. It must be gitignored and must never be
pushed.

**Consequence: the gate does not survive a fresh clone.** A new machine has no bundle and cannot make
one without credentials. That is fine while one machine both captures and compares. It is not fine
for CI, and pretending otherwise is exactly the kind of claim this method exists to prevent.

Decide before CI depends on it:

- store the bundle outside version control and fetch it in CI;
- sanitise the recording — strip auth headers, cookies and personal data — and commit a scrubbed
  copy, accepting that scrubbing can itself change what renders and must then be re-baselined;
- split the gate so CI runs only the parts needing no secrets, typically the component catalogue.


## Common capture and replay traps

1. **Animations inside `<object>`/`<iframe>` SVG ignore injected CSS.** Separate browsing context.
   Wait the element out, then mask it by name.
2. **Waiting for absence races with appearance.** `waitFor(() => !querySelector(spinner))` returns
   true *before* the spinner appears. Require the quiet condition to hold for a **continuous
   window** (~1.5s), and share that one implementation between capture and compare.
3. **Count only VISIBLE busy elements.** Apps leave zero-size spinner overlays in the DOM
   permanently; counting them means no page is ever quiet.
4. **Exclude the app's own origin from the recording.** A dev server's per-module requests dwarf the
   API. Keep the application assets served by the intended build.
5. **Freeze the clock or the recording stops matching.** Endpoints that embed today's date produce a
   different key tomorrow, and the request aborts.
6. **POSTs match by URL only.** A POST fired after capture moved on will abort on compare. That is
   the correct behaviour — a *harness* failure, not a pixel diff — but it means the recording needs
   refreshing whenever the app calls something new.
7. **The environment fingerprint must read the framework's own `.env` files**, not `process.env`.
   Build tools load them internally, so `process.env` is empty and the mismatch check never fires.
8. **A timing measurement is worthless if it watched the wrong element.** Re-run against the thing
   actually blocking before concluding anything about a cause.
9. **Heavy routes can starve each other in one session.** A page that settles in seconds alone may
   never settle after two other large-payload pages, and reloads may not clear it. Consider a fresh
   browser context per route, and record any route whose baseline is a loading state rather than
   quietly shipping it.

10. **A recorded POST can still fail to match.** HAR replay usually matches a POST on its body as
    well as its URL, so a body that varies run to run aborts even though the entry was recorded.
    Register a body-insensitive handler (method + URL) as a **fallback beneath** exact replay, and
    make sure "fallback" means that handler and never the live network.
11. **"Cancelled" is not "refused".** A request aborted by navigating away looks like a replay
    failure. Distinguish the error codes, or every navigation reports a phantom missing request.
12. **Replay is faster than the live network**, so the app gets further during compare and fires
    requests capture never saw. Dwell a few seconds **after** the screenshot so trailing traffic is
    recorded, leaving the screenshot moment unchanged.
13. **A page that never goes quiet can still be gated.** Determinism is the requirement; quiescence
    is only the usual route to it. Measure a busy/quiet timeline before concluding a page is
    ungateable, mask what moves, and record that the baseline is a loading state.
14. **Per-route browser contexts can cost more and fix nothing.** Measure before reaching for
    isolation.

19. **A component-catalogue gate can silently screenshot the wrong page for every entry.** Static
    servers commonly default to SPA rewriting (every path returns index.html) and to "clean URLs"
    (which strips the query string that selects the story). Either produces a full set of identical,
    plausible-looking screenshots that passes stability checks perfectly, because it is the same
    wrong page every time. Serve the bytes on disk with no rewriting, and assert you landed on the
    entry rather than the shell.
20. **Never let a visual gate compare against a prebuilt artefact.** Reusing an existing build meant
    no source change reached the catalogue and the gate returned "all identical" no matter what was
    edited — a gate that always passes. Rebuild every run.
21. **Guard against suspiciously uniform baselines.** If most entries share one or two image
    dimensions, the harness is almost certainly capturing the same page repeatedly. Fail on it.
22. **`waitForSelector` usually defaults to "visible", and an empty container is not visible.** Wait
    for it to be *attached*, then wait for it to have children.
23. **A mutation that does not take effect makes a proof ambiguous.** If a stylesheet mutation loses
    on specificity, the red run does not fire and the result reads as "gate broken" when the gate is
    fine. Mutate something that cannot lose, so a non-firing red run means exactly one thing.

24. **Replay state that advances across pages will drift.** If recorded responses are served from a
    queue, replay makes fewer revalidation round-trips than the live network did, so by the last page
    a shared endpoint is serving the wrong entry. The signature is distinctive: a single page
    replays perfectly while the full sequence differs, and the diff numbers are byte-identical on
    every rerun - constant drift, not jitter. Rewind per page, and align each page to its own slice
    of the recording.
25. **Worker requests do not appear in page-level request events.** An app fetching through a Web
    Worker will have that traffic in a context-level recording and absent from `page.on("request")`.
    Listen on the context.
26. **`addInitScript` does not reach Web Workers.** Freezing the page clock leaves the worker on real
    time. Test whether this affects the failing request before assigning it as the cause.
27. **Force deterministic text rasterisation.** Sub-pixel/LCD antialiasing positions glyphs on
    fractional boundaries and varies with the compositing path, producing whole-page differences on
    glyph edges while solid fills match exactly. Launch with LCD text and sub-pixel positioning
    disabled, a fixed colour profile, and GPU off.
28. **Bisect by removing the replay entirely.** Running the comparison against the live network is
    a way to separate a harness failure from a replay failure when live access is authorized.

29. **Do not skip a modal because its host page is ungated.** A modal is screenshotted as the dialog
    element, so whether the page behind it is gateable says nothing about whether the MODAL is. This
    can silently omit dialogs whose host routes were excluded. Gate the dialog region independently.
30. **Write down what you measured, not what you concluded.** A cause recorded as a finding is worse
    than an open question, because nobody re-tests it. A plausible explanation about a worker clock
    is still a hypothesis until a controlled comparison changes the result. If a cause has not been
    A/B tested, say "cause not identified" and list what IS known.

31. **A cache hit is recorded as a `200` with no body, and replaying it serves zero bytes.** Chromium
    answers a repeated request from its own HTTP cache; the recorder still logs an entry, with the
    right status and URL and `content.size === -1`. Serve that and the app gets an empty `200`, which
    nothing in the stack treats as an error: tables render empty, and a 0-byte font file is silently
    replaced by a system fallback. **Disable the HTTP cache while capturing** (CDP
    `Network.setCacheDisabled`) so the recording is complete and ordered, and **drop bodyless entries**
    before building any replay queue. A genuinely empty body records `size === 0` - keep those.
    It can produce unrelated-looking symptoms: empty data, missing fonts and text-only diffs.
32. **`document.fonts.status` says `loaded` while individual faces are in `error`.** The document-level
    status is not evidence that fonts loaded; it only means loading finished. Check **per-face**
    status, and compare live against replay. The visible signature of a failed face is text of the
    same content at a different WIDTH - a condensed family falling back to the system sans - which
    reads as a rendering problem and is actually a network one.
33. **Declare modal triggers; do not discover them.** Clicking candidate elements and watching for a
    dialog can be slow, incomplete and non-deterministic. Apps
    almost always declare their own modals somewhere (a registry, a route table, a card key). Read
    that, transcribe it into a map of `{route, id, trigger}`, and fail the gate when a declared
    trigger is missing, so a gap becomes a failure instead of silence.
34. **An app may render every modal wrapper at once and toggle them with a prop.** Then
    `document.querySelector(wrapper)` returns the first, permanently hidden one, and every check built
    on it reports the wrong thing. Query ALL matches and require a visible one with real height.
35. **Read UI state; never assume the default.** Some dialogs open with the "summary" toggle already
    checked, so "the view it opened in" is not always the default view. Name each screenshot after
    the state actually read, or two views end up compared against each other.
36. **Capture and compare must share the code that walks a surface.** The two had separate copies of
    the view-toggling logic can drift when capture reads the toggle state but compare assumes it.
    One generator used by both is the fix - the state check alone would have drifted again.
37. **Align replay per SCREENSHOT, not only per page.** Where a control refetches (a summary/detailed
    toggle), the page-level slice is too coarse and one view gets the other's data. Record, for each
    screenshot, the index into the per-URL recording it was taken against, and serve exactly that.
    Point the replay at the next view's responses **before** clicking the control that triggers them.

38. **The production gate needs its own proof.** Proving the dev server alone leaves "prod is gated"
    untested - a build can strip, inline or reorder the very CSS being compared. One stage-1 proof
    against a real build is enough; stage 2 shares its code path with the dev pixel proof.
39. **A guard that refuses to run on a dirty tree will refuse the A/B runner.** Dirtying a file is
    the runner's entire method, so the red run dies before reaching the gate and reports NOT PROVEN
    for a reason unrelated to the gate. Give those commands an explicit allow-dirty escape; the
    runner already reverts and verifies its own mutations.
40. **A single-proof run must MERGE into the proof record, not replace it.** Otherwise debugging one
    proof destroys the evidence for the others, and the record reads "1 proof" an hour after a full
    suite passed. Stamp each entry with its own time and commit.

41. **A proof that fails inside the suite and passes alone is a finding, not a retry.** Record which
    half failed and what the output did NOT say - "both halves exited non-zero and neither printed
    the threshold message" is evidence that the gate never ran, not that it failed. Long suites that
    build twice per proof are the usual suspects. Say "hypothesis" until it is tested.

42. **A green catalogue surface is not evidence the app runs.** A component catalogue builds its own
    bundle and can pass every entry while the application itself fails to start. When one visual
    surface passes and another dies with a connection error, believe the connection error.

## Proving the harness works

The harness is not trusted until it has been shown to fail on a change it should catch and pass on
one it should not:

| | Expected |
|---|---|
| Compare immediately after Capture, nothing changed | **green**, 0 diffs |
| Compare three times, nothing changed | **green** all three — this sets the tolerance |
| Change one padding value in a shared component | **red**, and only on the screens using it |
| Add a log line, rename a local variable | **green** — no false positive |
| Delete one entry from the recording | **red as a harness failure**, not a pixel diff |
| Run Compare with a different environment fingerprint | **refuses to run**, naming the mismatch |

All six results go in the phase report, with output.
