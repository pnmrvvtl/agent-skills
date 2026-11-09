# Backend probes — server runtime

Same discipline as the browser: a real process, a recorded trace, assertions over the whole
sequence, then falsification. A 200 OK is an end state; most server bugs live in the sequence.

## Signal per bug class

| Claim is about | Sample this |
|---|---|
| Endpoint contract | status, headers, body shape, and the **side effect** (row written, event emitted) |
| Calculation / pricing / aggregation | inputs → output for boundary cases, plus the stored/serialized value |
| Idempotency, retries | repeat the same request; assert one effect, not one response |
| Race / concurrency | fire N requests in parallel; assert invariants (no double booking, one row) |
| Background job / queue | job accepted → worker log → terminal state → downstream effect |
| Migration / backfill | before-count, after-count, spot rows, and rerun-safety |
| Auth / permissions | the allowed case **and** the denied case; a probe that only tests success is blind |
| Caching / TTL | first hit, cached hit, post-invalidation hit, with timestamps |

Assert the side effect, not only the response. "Responded 200" and "actually persisted" are
different claims, and it is usually the second one that broke.

## Building the probe

- Drive the **running** service over its real transport (HTTP/gRPC/CLI), not by importing
  internal functions — that is a unit test wearing a costume.
- Record a trace: `{step, t, request, status, body-digest, db-state}`. Print it on failure.
- Use the project's existing integration harness (supertest, pytest fixtures, testcontainers,
  k6, a seed script). Match its setup/teardown conventions.
- Seed deterministically and clean up what you created. Never reset or migrate a shared
  database without asking.
- For time-dependent logic, control the clock the way the project already does (fake timers,
  injectable clock, a test endpoint) rather than sleeping.
- For concurrency, real parallelism is required — `Promise.all` of N requests, or a load tool.
  Sequential calls will not reproduce a race.

## Falsification here

Reverting the fix is usually a rebuild/restart:

- feature flag or env var toggling the new path — cheapest and safest
- run the old build/image alongside on another port and point the probe at it
- temporary worktree with the fix reverted, build there (see `falsification.md`)

Expected shape of the result: with fix — invariant holds across N runs; without fix — a
specific, named violation (duplicate row, wrong total, 500 under parallelism).

## Environment to record

Base URL and port, build mode, commit, database (real/container/seeded), fixture identities,
concurrency level, number of repetitions, clock handling. Flaky-by-nature checks (timing,
parallelism) need a repeat count — one green pass on a race is not evidence.
