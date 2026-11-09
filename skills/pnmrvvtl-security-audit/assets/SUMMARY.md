# Security audit: <project / feature>

| | |
|---|---|
| Date | <YYYY-MM-DD> |
| Scope | <whole project / feature + paths> at commit `<sha>` |
| Class | <frontend / backend / fullstack / mobile / library> |
| Method | threat model, scanners (<list>), manual source-to-sink review against OWASP Top 10:<version> <+ API / LLM / Mobile lists>, validation gates <+ localhost PoCs> |
| Code changed by the audit | none |

## Verdict

<One paragraph: overall posture, the single most important risk, whether it is safe to ship as is.>

## Findings

| Severity | Confirmed | Likely |
|---|---|---|
| Critical | 0 | 0 |
| High | 0 | 0 |
| Medium | 0 | 0 |
| Low | 0 | 0 |
| Hardening (not findings) | | |

Rejected candidates: <n> (listed at the end of FINDINGS.md with the failing gate).

## Fix first

1. SA-<nn> <title>: <one line why>
2. ...
3. ...

## Coverage

<n/N> OWASP categories checked, <files reviewed n/N>, tools run: <list>, missing: <list>.
Not covered: <list>. Details in COVERAGE.md.

## Files

FINDINGS.md · THREAT-MODEL.md · DEPENDENCIES.md · COVERAGE.md · SOURCES.md · raw/
