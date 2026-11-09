# Validation, severity, and the finding template

## Contents
- Rationalizations to reject
- The gates
- Localhost probes
- False-positive checklist
- Severity and confidence
- Finding template

Adapted from Trail of Bits `fp-check` and Anthropic's `claude-code-security-review`.

## Rationalizations to reject

| Thought | Why it's wrong |
|---|---|
| "This pattern looks dangerous" | pattern recognition is not analysis; trace source to sink |
| "Similar code elsewhere was vulnerable" | each instance has its own validation and callers |
| "This is clearly critical" | models over-rate severity; prove impact |
| "Quick pass over the rest" | every candidate gets every gate |
| "The scanner says so" | scanners report candidates; reachability decides |

## The gates

Restate the claim first: what input, from which attacker, reaches which sink, causing what.
Half of false positives collapse when restated precisely. Then all gates must pass:

1. **Reachability**: the vulnerable code runs in production paths (not tests, not dead
   code, not behind a flag that is off). Name the entry point.
2. **Attacker control**: the attacker controls the data at the sink. Trace every hop and
   every validation or transformation on the way. Name the attacker (anonymous,
   authenticated user, other tenant, admin).
3. **Real impact**: data read or changed that the attacker may not access, code execution,
   privilege gain, account takeover, money or integrity loss. Robustness-only is not impact.
4. **No blocking protection**: framework escaping, ORM parameterisation, CSP, WAF-independent
   middleware, type coercion, or an allowlist does not already neutralise it.
5. **Proof**: a localhost PoC (when allowed) or a complete written path with the concrete
   input that would trigger it.

Any gate fails → **Rejected** (list it with the failing gate). All pass with PoC → **Confirmed**.
All pass without a runnable PoC → **Likely**. After all verdicts, look for **chains**:
rejected low-impact issues that combine into a real attack (open redirect + OAuth,
self-XSS + CSRF, info leak + IDOR).

## Localhost probes

Only when the user allowed it in intake, only against the local instance, only test data.

Allowed: requests as two different test users to check object access (IDOR); a single
quote / `' OR '1'='1` style probe on a read endpoint and observing errors; a harmless
XSS marker (`<svg onload=console.log(1)>`) where it renders to your own session;
SSRF probe to a local listener you start (`http://127.0.0.1:<port>`), never cloud metadata
of a real host; a missing-auth check by calling a handler without credentials.

Not allowed: destructive statements, bulk requests, fuzzing at volume, anything against a
non-local host, anything touching real accounts or data, persisting payloads others would see.

Save each probe's request and response (secrets redacted) to `raw/poc-<id>.md`.

## False-positive checklist

- React/Vue/Angular escape by default: XSS needs an unsafe sink.
- ORMs parameterise by default: SQLi needs a raw API or string building.
- Environment variables and CLI flags are trusted input (operator-controlled).
- UUIDv4 identifiers are not guessable, but IDOR still applies if they leak or are listed.
- Client-side permission checks are not required when the server checks.
- Test files, fixtures, scripts not deployed: not findings (note secrets in them, though).
- A vulnerable dependency is a finding only if the vulnerable code is reachable, or
  severity is Critical and reachability can't be ruled out (then mark Likely).
- DoS, missing rate limits and regex DoS: report only on authentication/OTP flows or with
  a demonstrated input, otherwise put them under hardening recommendations.
- Missing headers or hardening measures without an exploit path: hardening
  recommendations, not findings.

## Severity and confidence

| Severity | Meaning |
|---|---|
| Critical | unauthenticated RCE, full auth bypass, access to all users' data, secret granting production access |
| High | authenticated user reaches others' data or admin functions, stored XSS on shared views, SQLi, SSRF to internal network |
| Medium | exploitation needs specific conditions or user interaction, limited data exposure, CSRF on meaningful actions |
| Low | minor information disclosure, issues needing unlikely preconditions |
| Info / hardening | defence-in-depth gaps without an exploit path |

Confidence: **high** (Confirmed), **medium** (Likely with a complete path), **low** → not
reported as a finding. Severity is set after validation, from demonstrated impact.

## Finding template

```markdown
### SA-<nn> <short title>

| | |
|---|---|
| Severity | High |
| Verdict / confidence | Confirmed / high |
| OWASP | A01:2025 Broken Access Control (API1:2023 BOLA) |
| CWE | CWE-639 |
| Location | `src/api/orders/[id].ts:42` (handler), `src/lib/db.ts:88` (query) |
| Attacker | authenticated user of another tenant |

**What:** one or two sentences.

**Path:** source (`req.query.id`) -> `getOrder(id)` -> `db.order.findUnique({ where: { id } })`,
no ownership check between.

**Impact:** any logged-in user reads any order, including addresses and payment status.

**Proof:** request/response in `raw/poc-<nn>.md`: test user B fetched test user A's `<resource-id>`.

**Fix guidance:** filter by owner in the query (`where: { id, userId: session.userId }`)
or check ownership before returning; apply to update and delete handlers too.
Reference: OWASP Authorization Cheat Sheet.
```
