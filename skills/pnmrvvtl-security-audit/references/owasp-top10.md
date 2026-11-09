# OWASP Top 10:2025, as audit checks

## Contents
- Version note
- A01 Broken Access Control (incl. SSRF)
- A02 Security Misconfiguration
- A03 Software Supply Chain Failures
- A04 Cryptographic Failures
- A05 Injection
- A06 Insecure Design
- A07 Authentication Failures
- A08 Software and Data Integrity Failures
- A09 Security Logging and Alerting Failures
- A10 Mishandling of Exceptional Conditions
- Companion lists (API, LLM, Mobile)

## Version note

OWASP Top 10:2025 was finalised in January 2026 (https://top10.owasp.org/2025/).
Compared with 2021: SSRF merged into A01; Misconfiguration rose to A02; A03 Supply Chain
is new (it replaces and widens "Vulnerable and Outdated Components"); A10 Exceptional
Conditions is new. Step 2 of the workflow must confirm this is still the current version.

Grep hints below are starting points for finding candidates. A hit is never a finding
by itself.

## A01 Broken Access Control (incl. SSRF)

Most common real finding. Check:
- Every route/handler/server action/resolver: is there an authorization check, and does
  it check **ownership** (IDOR/BOLA: `/orders/:id` returns any user's order)?
- Function-level: admin-only handlers reachable by normal users; checks done only in the
  frontend (hidden button, route guard) with no server check.
- Mass assignment: request body spread into a model (`{...req.body}`, `Object.assign(user, body)`,
  `Model.update(body)`): can a user set `role`, `isAdmin`, `ownerId`, `price`?
- Multi-tenant: queries filtered by tenant everywhere, including background jobs and exports.
- Path traversal: user input in file paths (`path.join(base, input)` without resolve+prefix check).
- CORS: `Access-Control-Allow-Origin` reflecting the request origin with credentials.
- **SSRF**: user-controlled URL fetched by the server (`fetch(url)`, `axios(url)`, webhooks,
  image/URL previews, PDF renderers, import-from-URL). Check scheme/host allowlist, redirects,
  DNS rebinding, access to `169.254.169.254`, `localhost`, internal hosts.
- JWT/session claims trusted without server-side verification of the subject's rights.

Grep: `req.params`, `params.id`, `findById(`, `where: { id`, `...req.body`, `role`, `isAdmin`,
`fetch(`, `axios`, `got(`, `request(`, `path.join`, `readFile(`, `res.sendFile`, `Access-Control-Allow-Origin`.

## A02 Security Misconfiguration

- Debug/dev mode in production config; stack traces or framework error pages returned.
- Default credentials, sample accounts, open admin panels, exposed `/metrics`, `/debug`, swagger in prod.
- Security headers: CSP, HSTS, X-Content-Type-Options, frame-ancestors / X-Frame-Options, Referrer-Policy.
- Cookies: `HttpOnly`, `Secure`, `SameSite` on session/auth cookies.
- Permissive CORS (`*` with credentials, origin reflection).
- Cloud/IaC/Docker: containers as root, secrets in Dockerfile/compose, public buckets,
  wide security groups (trivy config covers much of this).
- Source maps and `.env`/`.git` served publicly; directory listing.
- Frontend: secrets in public env vars (`NEXT_PUBLIC_*`, `VITE_*`, `REACT_APP_*` are shipped to browsers).
- GraphQL introspection and unlimited depth in production.

## A03 Software Supply Chain Failures

- Known-vulnerable dependencies (audit tools), **with reachability**: is the vulnerable API used?
- Install scripts (`preinstall`, `postinstall`) in dependencies; recently hijacked packages;
  names one edit away from popular packages (typosquats).
- Unpinned ranges on critical packages, git/URL/tarball dependencies, missing or
  uncommitted lockfile, lockfile not matching `package.json`.
- Unmaintained packages (no release in years, archived repo) on security-relevant paths.
- CI/CD: third-party GitHub Actions pinned by tag not SHA; `pull_request_target` with checkout
  of PR code; secrets available to fork PRs; untrusted input (`github.event.*.title`) in `run:`.
- Registry integrity: `npm audit signatures`; `.npmrc` pointing at unexpected registries.
- Build: artifacts not reproducible, no SBOM (note as recommendation, not a finding).

## A04 Cryptographic Failures

- Passwords hashed with anything but argon2id / scrypt / bcrypt (with sane cost); MD5/SHA1/SHA256 for passwords.
- `Math.random()` / `random.random()` for tokens, reset codes, IDs that grant access.
- Hardcoded keys, IVs, salts; ECB mode; custom crypto; JWT `alg: none` accepted or HS/RS confusion.
- TLS verification disabled (`rejectUnauthorized: false`, `verify=False`, `NODE_TLS_REJECT_UNAUTHORIZED=0`).
- Sensitive data stored or logged in plaintext; tokens in URLs.

Grep: `createHash('md5'|'sha1')`, `Math.random`, `rejectUnauthorized`, `verify=False`, `algorithms`, `jwt.decode(` (decode is not verify).

## A05 Injection

- **SQL**: string-built queries, template literals in `query()`, ORM raw APIs
  (`$queryRawUnsafe`, `sequelize.query`, `knex.raw`, `.raw(`, TypeORM `.query(`), dynamic
  `ORDER BY`/column names from input.
- **NoSQL**: user objects passed as filters (`{ $ne: null }`, `$where`, `$regex` from input).
- **Command**: `exec`, `execSync`, `spawn(..., { shell: true })`, `child_process` with input; Python `os.system`, `subprocess(..., shell=True)`.
- **XSS** (frontend and server-rendered): `dangerouslySetInnerHTML`, `v-html`, `innerHTML`,
  `outerHTML`, `document.write`, `insertAdjacentHTML`, `[innerHTML]`, `bypassSecurityTrust*`,
  unescaped template output (`{{{ }}}`, `|safe`, `<%- %>`), `href`/`src` from input
  (`javascript:` URLs), markdown rendered without sanitising.
- **Code**: `eval`, `new Function`, `vm.runIn*`, `setTimeout(string)`, template engines with user templates (SSTI).
- **Other**: LDAP, XPath, header/CRLF injection, log injection, prompt injection into LLM tool calls (see LLM list).

## A06 Insecure Design

Flaws no single line causes; derive from the threat model:
- Business-logic abuse: negative quantities, coupon stacking, skipping steps of a flow,
  replaying one-time actions, race conditions on balance/stock/redeem (check-then-act without a transaction or lock).
- Missing limits on sensitive flows: signup, password reset, OTP attempts, invitations, exports.
- Trust in client-side computed values (price, totals, permissions).
- Missing re-authentication for critical actions (email/password change, payout details).

## A07 Authentication Failures

- Brute force/credential stuffing: no rate limit or lockout on login, OTP, reset.
- Password reset: token entropy, expiry, single use, bound to user, no user enumeration.
- Sessions: rotated on login, invalidated on logout/password change, sane expiry;
  JWT expiry, revocation strategy, storage (localStorage + XSS = token theft).
- MFA bypass paths; OAuth `state` and PKCE; redirect_uri validation; account linking by unverified email.
- User enumeration via different messages or timing.

## A08 Software and Data Integrity Failures

- Insecure deserialization: `node-serialize`, `serialize-javascript` misuse, YAML `load`
  (unsafe), Python `pickle`, Java/PHP unserialize of untrusted data.
- Webhooks accepted without signature verification (Stripe, GitHub, etc.) or with non-constant-time compare.
- Auto-update or plugin loading without signature checks; CDN scripts without SRI.
- Prototype pollution: deep merge/`lodash.merge`/`set` with user keys (`__proto__`, `constructor`).

## A09 Security Logging and Alerting Failures

- Auth failures, access-control denials and admin actions not logged.
- Sensitive data in logs: passwords, tokens, full card numbers, PII.
- No alerting path (note as design gap; low severity unless compliance requires it).

## A10 Mishandling of Exceptional Conditions

New in 2025 (CWE-209, CWE-636 fail-open, CWE-476, and others):
- **Fail open**: auth/authorization middleware that calls `next()` in its `catch`, feature
  flags or permission lookups defaulting to allow on error, `try { verify() } catch {}`.
- Error responses leaking stack traces, SQL, internal paths, versions.
- Multi-step operations (payments, transfers, inventory) without transactions: a failure
  midway leaves a state an attacker can exploit (double spend, duplicate transfer).
- Unhandled promise rejections / uncaught exceptions that crash the process (DoS on demand).
- Resources not released on error paths (files, locks, DB connections).

Grep: `catch {}`, `catch (e) {}`, `catch(() => {})`, `.catch(() => next())`, `err.stack`, `res.send(err`.

## Companion lists

Verify current versions in step 2.

**OWASP API Security Top 10 (2023)**: API1 BOLA, API2 Broken Authentication, API3 Broken
Object Property Level Authorization, API4 Unrestricted Resource Consumption, API5 BFLA,
API6 Unrestricted Access to Sensitive Business Flows, API7 SSRF, API8 Security
Misconfiguration, API9 Improper Inventory Management (old/undocumented endpoints),
API10 Unsafe Consumption of APIs (trusting third-party API responses).

**OWASP Top 10 for LLM Applications (2025)**: LLM01 Prompt Injection, LLM02 Sensitive
Information Disclosure, LLM03 Supply Chain, LLM04 Data and Model Poisoning, LLM05 Improper
Output Handling (LLM output into HTML/SQL/shell), LLM06 Excessive Agency (tools with more
power than needed, no confirmation), LLM07 System Prompt Leakage, LLM08 Vector and
Embedding Weaknesses, LLM09 Misinformation, LLM10 Unbounded Consumption.

**OWASP Mobile Top 10 (2024)**: M1 Improper Credential Usage, M2 Inadequate Supply Chain
Security, M3 Insecure Authentication/Authorization, M4 Insufficient Input/Output
Validation, M5 Insecure Communication, M6 Inadequate Privacy Controls, M7 Insufficient
Binary Protections, M8 Security Misconfiguration, M9 Insecure Data Storage, M10
Insufficient Cryptography.

For depth on any single control, the OWASP ASVS and the OWASP Cheat Sheet Series are the
reference; cite the specific cheat sheet in a finding's fix guidance.
