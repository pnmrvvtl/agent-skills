# KNOWLEDGE — project facts & traps (append-only, dated)

Format: `## K-NNN · date · category` -> the fact or trap, why it happens, and what to do. Write it the
moment you hit it. A trap recorded here costs the next session nothing; a trap kept in a context window
costs it an hour.

## K-001 · {{DATE}} · <category>

- What / why / what to do.

## Example traps worth recording early

- **Server-rendered identity.** If the root layout fetches the user server-side, a fake token yields 401
  and the page renders logged out. `page.route` cannot intercept server-side fetches; use the framework's
  test mode or a real fixture.
- **A production build tears down a dev server on the same port.** Browser runs then fail with
  connection-refused across every route, which reads like a mass regression and is not one.
- **Installing packages removes linked-repo junctions.** Run the repo's `postinstall`/repair step after any
  install and confirm the library path resolves.
- **Two copies of a stateful package across linked repos.** Run the package-dedupe guard after dependency
  changes.
- **A stale dev server looks exactly like a visual regression.** Before believing a browser failure,
  confirm the server answers and its chunks load without 404/504.
- **Stale optimised images are keyed by URL.** Overwriting a crop's bytes without changing its URL leaves
  the old bitmap on screen; rename the asset or the measurement is against a stale image.
