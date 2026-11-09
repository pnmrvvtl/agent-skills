# Backend invariants and sweep

## Contents
- Invariants B1–B9
- Sweep recipe
- Traps

## Invariants

Check every one for every request in the sweep.

| # | Invariant | How to measure |
|---|-----------|----------------|
| B1 | No client input produces a 5xx | status of every malformed, oversized, wrong-type request is 4xx |
| B2 | Every error has the project's error shape and a stable code | validate the body against the error schema |
| B3 | A failed request writes nothing | hash or count the affected rows before and after; queue and outbox unchanged |
| B4 | Authorization holds on every path | actor × endpoint × resource-owner matrix: other user's id → 403/404, no token → 401, never 200 |
| B5 | Every success response matches its schema | validate against the OpenAPI / zod / pydantic schema the project uses |
| B6 | A retried request is safe | same request twice → one effect (idempotency key, unique constraint, upsert) or a documented 409 |
| B7 | Concurrent requests keep the data consistent | N parallel conflicting writes → final state equals some serial order; no lost update |
| B8 | Limits are enforced at the boundary | max+1 length, page size, payload size, rate limit return the documented error |
| B9 | No secret or internal detail leaks in errors or logs | no stack trace, SQL, token or password in response bodies and in log lines the request produced |

## Sweep recipe

Use the project's integration-test setup (supertest, httpx, test client, seeded test DB). Drive
the **real HTTP layer**, never the handler or validator function directly.

```ts
const cases = buildCases(); // from Step 3: { actor, endpoint, body, headers, repeat, parallel }
for (const c of cases) {
  const before = await snapshot(db, c.tables);   // row counts or content hash
  const res = await send(c);                     // repeat and parallel handled here
  const after = await snapshot(db, c.tables);
  record(c, checkInvariants(c, res, before, after, logsSince(c.start))); // B1–B9
}
```

- Build bodies from the schema: for every field, each lens value from SKILL.md Step 2, one field
  wrong at a time, plus one all-valid control.
- Run against a throwaway test database. Never reset or migrate the user's database without
  asking.

## Traps

- A validator unit test passing does not prove the route uses that validator.
- Framework body-size and JSON-parse errors often bypass the project's error shape; test them.
- Timezone-dependent code passes on a UTC CI machine; run once with `TZ` set to a non-UTC zone.
