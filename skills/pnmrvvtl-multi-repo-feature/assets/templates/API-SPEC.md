# API-SPEC — backend contract for every mocked endpoint

This file is the final deliverable that lets the backend team build the real endpoints and lets the frontend
drop the mock by flipping one env var. One section per mocked route, in the exact heading shape below, so
`check-api-spec.mjs` can match it against the mock route table. A route with no section fails the build.

## Conventions

- Heading: `### METHOD /path` (the path as the real backend exposes it).
- Every section states: purpose; request (params / query / body TS types); response TS type plus a small
  JSON example; status codes; validation; side effects; frontend callers.

## Endpoints

### GET /example/:id

- **Purpose:**
- **Request:** params `{ id: string }`
- **Response:** `Example`
  ```json
  { "id": "1" }
  ```
- **Status:** 200; 404 unknown id
- **Validation:**
- **Side effects:**
- **FE callers:** `src/api/.../exampleApi.ts`
