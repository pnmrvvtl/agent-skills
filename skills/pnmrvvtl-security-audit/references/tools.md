# Scanners: what, how, what they miss

Tool install commands change. Confirm them in the research step before proposing
installs. Install only after the user agreed in intake. `scripts/run-scanners.sh` runs
whatever is on PATH and records versions.

| Tool | Covers | Install (Windows / cross-platform) | Misses |
|---|---|---|---|
| `npm audit` / `pnpm audit` / `yarn npm audit` | known CVEs in JS deps | ships with the package manager | reachability, malicious-but-unreported packages |
| `npm audit signatures` | registry signature / provenance of installed packages | npm >= 9 | anything published legitimately by a compromised maintainer |
| osv-scanner | CVEs across ecosystems (npm, PyPI, Go, Maven, pub, Cargo...) from OSV.dev | `winget install Google.OSVScanner`, or `go install github.com/google/osv-scanner/v2/cmd/osv-scanner@latest` | reachability |
| gitleaks | secrets in files and **git history** | `winget install gitleaks` / `choco install gitleaks` / release binary | secrets without a known pattern; still check `.env*`, configs by hand |
| semgrep (CE) | SAST patterns per language, OWASP rule packs | `pipx install semgrep` (or `pip install semgrep`) | cross-file data flow (CE is mostly intra-file), business logic, authorization |
| trivy | Dockerfile, compose, Kubernetes, Terraform misconfig; container image CVEs | `winget install AquaSecurity.Trivy` / `choco install trivy` | application code |
| pip-audit | Python deps | `pipx install pip-audit` | reachability |

## Commands used by run-scanners.sh

```bash
npm audit --json                                   # or pnpm audit --json / yarn npm audit --json
npm audit signatures
osv-scanner scan source -r --format json <root>
gitleaks detect --source <root> --report-format json --report-path raw/gitleaks.json --redact
gitleaks detect --source <root> --no-git --redact ...   # working tree incl. untracked files
semgrep scan --config p/owasp-top-ten --config p/secrets --config p/<lang> --json --metrics=off <root>
trivy config --format json <root>
pip-audit -f json                                   # when requirements/pyproject present
```

`--redact` keeps secret values out of the raw output. `--metrics=off` keeps semgrep from
sending telemetry about the project.

## Reading the results

- **Dependency CVEs**: for each High/Critical, find the vulnerable function in the
  advisory and grep for its use. Used → finding (validate). Not used → DEPENDENCIES.md
  "not reachable" list with the reason. Dev-only dependency → lower priority, note it.
- **gitleaks**: a secret in history stays exposed even if deleted now; the fix is
  rotation, not deletion. Check whether it looks live (not a placeholder/test key).
- **semgrep**: each hit is a candidate for step 7. Expect many false positives; the
  gates decide.
- **trivy config**: real only if that file is used to deploy.

## What no scanner finds (manual review must)

Broken access control, IDOR, mass assignment, business logic, fail-open error handling,
race conditions, SSRF through indirect paths, multi-tenant leaks, auth flow design flaws.
These are the most common real findings, so step 6 matters more than step 5.
