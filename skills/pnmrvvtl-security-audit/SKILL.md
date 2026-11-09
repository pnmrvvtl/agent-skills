---
name: pnmrvvtl-security-audit
description: Read-only security audit of a whole project or one named feature, module or path. Classifies the project (frontend, backend, fullstack, mobile, library), researches the current OWASP Top 10 and stack-specific advisories on the web, builds a threat model, runs dependency, secret and SAST scanners, reviews code source-to-sink per OWASP category (input validation, SQL/NoSQL/command injection, XSS, access control, auth, SSRF, crypto, misconfiguration, supply chain, error handling), verifies every finding against false-positive gates (with harmless localhost probes when allowed), and writes a set of markdown audit artifacts. Never edits project code. Use when the user asks for a security audit, security review, vulnerability scan, pentest-style code review, OWASP check, npm audit review, "is this secure", or a security check of a feature, endpoint, PR or branch.
---

# Security audit

Produce the most complete, **verified** security picture possible, as markdown files.
The audit never changes the project: no code edits, no dependency upgrades, no fixes,
no commits. The only files written are inside the audit directory.

Method: threat model first, then look for bugs against it, then prove each one before
reporting it. Unverified pattern matches are the main failure mode of AI audits: LLMs
over-report and over-rate severity. Every finding must survive the gates in
[references/validation.md](references/validation.md).

Resolve `<installed-skill-dir>` to the directory containing this SKILL.md. Invoke its bundled scripts
by that path; `<project-root>` and `<audit-dir>` refer to the repository being reviewed and its output.

## Hard rules

- **Read-only on the project.** Output goes to `security-audit/<YYYY-MM-DD>-<scope-slug>/`
  in the project root (added to `.git/info/exclude`, not `.gitignore`), or where the user says.
- **Dynamic probes only against localhost** instances the user named or that you started
  from the project's own dev scripts, with test data. Never production, staging, or any
  external host. Never destructive payloads (DROP, DELETE, rm), never DoS or load tests,
  never real user data. If a probe could change persistent data, don't run it: describe it.
- **Never print secrets.** A found secret is reported by file, line, type and the first 4
  characters only. Never copy `.env` values into artifacts.
- **Install scanners only after the user says yes** (asked once in intake). Missing tool →
  record it in COVERAGE.md and compensate with manual review.
- **Coverage is reported honestly.** What was not checked is listed, never implied checked.

## Workflow

Copy and track:

```
Security audit <scope>:
- [ ] 1. Intake (one round of questions)
- [ ] 2. Research: current OWASP lists, stack advisories, tool usage -> SOURCES.md
- [ ] 3. Recon: classify project, inventory entry points -> scripts/recon.sh
- [ ] 4. Threat model -> THREAT-MODEL.md
- [ ] 5. Automated scans -> scripts/run-scanners.sh -> raw/, DEPENDENCIES.md
- [ ] 6. Manual review per category, source to sink -> candidate list
- [ ] 7. Validate every candidate (gates, localhost PoC if allowed) -> verdicts
- [ ] 8. Severity + confidence, then write FINDINGS.md, COVERAGE.md, SUMMARY.md
- [ ] 9. Self-check the artifacts, then report to the user
```

### 1. Intake

Ask once, in one message, only what can't be discovered from the repo:
- **Scope:** whole project, or which feature / paths / routes / branch / PR diff?
- **Running app allowed?** Command and URL of a local instance, test credentials, test DB?
- **Install scanners?** Propose the missing ones from [references/tools.md](references/tools.md).
- **Context:** who are the users and the attackers (public internet, internal staff,
  multi-tenant)? Anything already known or accepted? Compliance (PCI, HIPAA, GDPR)?

Proceed with safe defaults if the user doesn't answer: static only, no installs,
attacker = unauthenticated internet user plus a low-privilege authenticated user.

### 2. Research (mandatory, before reviewing code)

Knowledge goes stale; the lists and advisories change yearly. Web-search and record
every source with URL and date in `SOURCES.md`:
- the **current** OWASP Top 10 version and its category list (verify it still matches
  [references/owasp-top10.md](references/owasp-top10.md); if a newer version exists, use it
  and note the differences)
- OWASP API Security Top 10 if there is an API; OWASP LLM Top 10 if the app calls an LLM;
  OWASP Mobile Top 10 if mobile
- security advisories for the exact framework versions in the lockfile
  (e.g. "next.js 15.2 security advisory", "express 5 CVE")
- recent supply-chain incidents in the ecosystem (npm worms, hijacked packages) and
  whether any appear in the lockfile
- current install/usage of each scanner you will run

### 3. Recon

Run `bash "<installed-skill-dir>/scripts/recon.sh" "<project-root>" "<audit-dir>"`: stack signals, frameworks,
lockfiles, entry points (routes, API handlers, server actions, GraphQL, websockets,
queues, cron), dangerous-sink hits, config files. Then classify:
**frontend | backend | fullstack | mobile | library | CLI**. The class decides which
checklists in [references/stack-checks.md](references/stack-checks.md) apply.
For a feature scope, trace the feature's entry points and follow them across the whole
codebase: a feature's vulnerability often lives in shared middleware.

### 4. Threat model

Fill [assets/THREAT-MODEL.md](assets/THREAT-MODEL.md): assets worth stealing or
breaking, actors, entry points, trust boundaries, data flows across them, existing
controls (auth middleware, validation library, ORM, CSP, rate limiter), and the
questions the review must answer. Review in step 6 is driven by this list, not by grep.

### 5. Automated scans

Run `bash "<installed-skill-dir>/scripts/run-scanners.sh" "<project-root>" "<audit-dir>"`. It runs whatever is
available (npm/pnpm/yarn audit, npm audit signatures, osv-scanner, gitleaks, semgrep,
trivy), stores raw output and tool versions in `raw/`, and never fails on a missing tool.
Summarise into `DEPENDENCIES.md`: vulnerable packages with reachability (is the vulnerable
function actually used?), install scripts, unpinned or git dependencies, lockfile drift,
unmaintained packages, typosquat-looking names. Scanner output is candidates, not findings.

### 6. Manual review

For each threat-model question and each applicable category in
[references/owasp-top10.md](references/owasp-top10.md) and
[references/stack-checks.md](references/stack-checks.md): find the sources (user input,
headers, cookies, files, webhooks, queue messages, LLM output), follow each to its sinks
(query, shell, filesystem, HTML, redirect, outbound request, deserializer, auth decision),
and record every candidate with file:line and the path between. Check that each control
is applied on **every** route, not just most. Missing authorization on one handler among
twenty is the most common real finding.

### 7. Validate

Every candidate goes through [references/validation.md](references/validation.md):
restate the claim, prove reachability and attacker control, prove impact, check
environmental protections, and (if a local instance is allowed) demonstrate with a
harmless probe. Verdicts: **Confirmed** (PoC or complete proof), **Likely** (full path
traced, no PoC possible), **Rejected** (a gate failed; kept in FINDINGS.md's rejected
section with the reason). Below Likely → not a finding.

### 8. Write the artifacts

Templates in `assets/`. Directory:

```
security-audit/<date>-<scope>/
  SUMMARY.md        one page: scope, verdict, counts by severity, top risks, what to fix first
  FINDINGS.md       every finding in the template; rejected candidates at the end
  THREAT-MODEL.md   step 4
  DEPENDENCIES.md   step 5 summary
  COVERAGE.md       categories x status, files reviewed n/N, tools run/missing, not covered
  SOURCES.md        step 2
  raw/              scanner output, recon output, PoC transcripts
```

Severity rubric and finding template: [references/validation.md](references/validation.md).
Fix guidance in findings describes **what** to change and where; it is advice in the
report, never applied.

### 9. Self-check before reporting

- Every finding has file:line, source, sink, path, impact, PoC or proof, verdict, severity, confidence.
- No finding rests only on a pattern match or only on a scanner line.
- No secret value appears in any artifact.
- COVERAGE.md lists every OWASP category as checked / not applicable (with reason) / not checked.
- `git status` shows no change outside the audit directory.

Final message to the user: path to SUMMARY.md, counts by severity, the top 3 risks in one
line each, and what was not covered.
