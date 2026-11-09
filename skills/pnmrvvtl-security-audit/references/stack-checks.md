# Checks by project class

## Contents
- Classifying the project
- Frontend (SPA / SSR client side)
- Backend (Node, Python, others)
- Fullstack frameworks (Next.js, Nuxt, SvelteKit, Remix)
- Mobile (Flutter, React Native)
- Library / CLI
- CI/CD and repository

## Classifying the project

| Signal | Class |
|---|---|
| React/Vue/Svelte/Angular, Vite/webpack, no server handlers | frontend |
| express, fastify, koa, nest, hono, django, flask, fastapi, spring, go net/http, routes/controllers | backend |
| next, nuxt, sveltekit, remix, astro with server routes/actions, or a monorepo with both | fullstack |
| `pubspec.yaml` + `lib/main.dart`, React Native, `android/` + `ios/` | mobile |
| published package, `bin` entry, no server | library / CLI |

A fullstack project gets both frontend and backend checks plus the framework section.

## Frontend (SPA / SSR client side)

- XSS sinks (see A05); URL-controlled `href`/`src`; markdown/HTML rendering without DOMPurify.
- `postMessage` handlers without `event.origin` checks; `window.opener` (target=_blank without noopener on old stacks).
- Tokens in `localStorage`/`sessionStorage` (stealable by any XSS); prefer HttpOnly cookies.
- Secrets in public env vars or bundled config; API keys that grant more than public access.
- Client-only authorization (route guards) with no matching server check: report on the server side.
- CSP present and without `unsafe-inline`/`unsafe-eval`; third-party scripts without SRI.
- Open redirects via `?next=`/`?returnUrl=` (low alone; higher when chained with OAuth).
- Source maps in production build; verbose errors to the console with data.

## Backend

- Authentication middleware coverage: list every route and mark protected / public; the
  unprotected ones must be intentionally public.
- Authorization per object (A01) on read, update, delete, export, and list endpoints.
- Validation at the boundary (zod, joi, class-validator, pydantic): present on every
  handler, strips unknown fields, types enforced.
- Injection sinks (A05), SSRF (A01), deserialization (A08), prototype pollution.
- File upload: type checked by content not extension, size limit, stored outside web root,
  random names, no SVG/HTML served inline from the same origin, archive extraction path checks (zip slip).
- Rate limits on auth, OTP, reset, signup, expensive endpoints.
- Webhooks: signature verification with constant-time compare, replay protection.
- Error handling (A10): central handler, no stack traces out, fail closed.
- Secrets: from env or a secret store, not committed; `.env.example` has no real values.
- Python specifics: `pickle`, `yaml.load` without SafeLoader, `subprocess(shell=True)`,
  Django `raw()`/`extra()`, `DEBUG=True`, `ALLOWED_HOSTS=['*']`, Flask `debug=True`.

## Fullstack frameworks

- **Next.js**: server actions are public POST endpoints: each needs its own auth and
  authorization check. Route handlers and middleware: middleware-only auth can be bypassed
  if the matcher misses paths; check the version against known middleware-bypass advisories.
  `NEXT_PUBLIC_*` is public. `dangerouslySetInnerHTML`. Image optimizer remote patterns (SSRF).
- **Nuxt / SvelteKit / Remix**: server routes and form actions need the same checks as
  backend handlers; `load` functions must not return data the user may not see.
- Data returned to the client in props/loaders: check for over-fetching (whole user
  objects with password hashes, internal fields).

## Mobile

- Secrets or privileged API keys in the app bundle (anything shipped can be extracted).
- Tokens in `SharedPreferences`/`AsyncStorage` instead of Keychain/Keystore
  (`flutter_secure_storage`, `react-native-keychain`).
- TLS: no cleartext traffic, no disabled certificate validation (`badCertificateCallback` returning true).
- Deep links / intent handlers: parameters validated, no auth bypass via link.
- WebViews: JavaScript bridges exposed to remote content.
- Backend trusts nothing the app sends (price, role, entitlement).

## Library / CLI

- Unsafe defaults exposed to callers; shell/command construction from arguments;
  path handling; regex on untrusted input (ReDoS: report only with a demonstrated slow input).

## CI/CD and repository

- GitHub Actions: `pull_request_target` + checkout of PR head; `${{ github.event.* }}` in `run:`;
  actions pinned by tag; `permissions:` missing (defaults too broad); secrets in logs.
- Committed secrets anywhere in history (gitleaks with history).
- Branch protection and required reviews: note only if visible (not auditable from the repo).
