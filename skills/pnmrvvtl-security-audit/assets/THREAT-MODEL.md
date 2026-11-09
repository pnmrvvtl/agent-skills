# Threat model: <project / feature>

Scope: <whole project | feature: paths, routes>. Class: <frontend | backend | fullstack | mobile | library>.
Date: <YYYY-MM-DD>. Based on: recon (raw/recon.md), code reading, user answers.

## Assets

| Asset | Where it lives | Why an attacker wants it |
|---|---|---|
| user accounts / sessions | | takeover |
| personal data | | theft, compliance |
| money / credits / orders | | fraud |
| admin functions | | full control |
| secrets / API keys | | pivot to other systems |

## Actors

| Actor | Starting capability |
|---|---|
| anonymous internet user | public pages and endpoints |
| authenticated user | own account, own objects |
| user of another tenant | own tenant |
| malicious dependency / CI input | code execution at install/build |

## Entry points

| # | Entry point | Auth | Input | Handler (file:line) |
|---|---|---|---|---|
| E1 | `POST /api/...` | session | JSON body | |

## Trust boundaries and data flows

- browser -> API: <what crosses, what validates it>
- API -> database: <ORM / raw, parameterised?>
- API -> third parties / outbound URLs: <which, who controls the URL>
- webhooks / queues -> workers: <verification>
- LLM output -> <sink>, if any

## Existing controls

Auth mechanism, authorization pattern (middleware / per-handler / policy), validation
library, ORM, output encoding, CSP / headers, rate limiting, secret storage, logging.
Note where each control is **not** applied.

## Questions the review must answer

1. Does every E# check authorization for the specific object, not just login?
2. ...

## Out of scope

<what was excluded and why>
