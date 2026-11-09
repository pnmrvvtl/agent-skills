# Coverage

## Categories

| Category | Status | Notes |
|---|---|---|
| A01:2025 Broken Access Control (incl. SSRF) | checked / n.a. / NOT CHECKED | <routes reviewed n/N> |
| A02:2025 Security Misconfiguration | | |
| A03:2025 Software Supply Chain Failures | | |
| A04:2025 Cryptographic Failures | | |
| A05:2025 Injection | | |
| A06:2025 Insecure Design | | |
| A07:2025 Authentication Failures | | |
| A08:2025 Software and Data Integrity Failures | | |
| A09:2025 Security Logging and Alerting Failures | | |
| A10:2025 Mishandling of Exceptional Conditions | | |
| API Top 10 / LLM Top 10 / Mobile Top 10 | | only if applicable |

`n.a.` needs a reason (e.g. "no outbound requests exist"). `NOT CHECKED` needs a reason too.

## Code reviewed

| Area | Files reviewed | Total | Depth |
|---|---|---|---|
| entry points / handlers | | | line by line |
| auth / middleware | | | line by line |
| data access | | | |
| frontend | | | sinks only |

## Tools

Copy the table from raw/scanners.md, plus any tool that was missing and what manual
review compensated for it.

## Dynamic validation

<allowed / not allowed>. Local instance: <command, URL>. PoCs run: <n>. Probes not run and why.

## Not covered

- <e.g. infrastructure outside the repo, production configuration, third-party services,
  runtime secrets, branch protection, cloud IAM>
