# Generic failure modes behind the rules

These examples describe reusable failure modes. They are illustrative scenarios, not a project log.
Use the identifiers to link a packet or decision to the corresponding rule.

| # | Example failure | Rule |
|---|---|---|
| L-001 | A design API rate-limits repeated exploratory calls. | Check the access tier, batch requests and cache responses. |
| L-002 | New gate scripts fail the repository's own lint rules. | Validate tooling immediately after adding it. |
| L-003 | Unrelated failing tests make every checkpoint red. | Measure the baseline before adding ratchets. |
| L-004 | Shell paths or line endings corrupt an edit. | Use platform-compatible paths and preserve encoding. |
| L-005 | A scanner or gate reports success without checking its intended input. | Plant a realistic defect, prove failure for the expected reason, restore, then prove success. |
| L-006 | A design export stops partway through a large batch. | Save incremental results and report incomplete coverage. |
| L-007 | A temporary proof leaves stale coverage artifacts. | Restore derived reports as well as source edits. |
| L-008 | An implementer substitutes a different runtime and reports checks green. | Re-run the declared commands in the required runtime. |
| L-009 | Exploration consumes the implementer's context or quota. | Put measured findings and scoped file paths in the packet; keep a fallback. |
| L-010 | An agent writes its result but never exits. | Use a watchdog with hard, idle and result-file deadlines. |
| L-011 | A changed visual surface is omitted from comparison. | Check every touched surface against its reference or siblings. |
| L-012 | An approximate asset looks plausible but differs from the design. | Use exported assets and map them by geometry. |
| L-013 | Default harness commands hang or run the wrong tests. | Use the target repository's real commands and verify test counts. |
| L-014 | Product offsets or skipped tests hide a real mismatch. | Review compensating CSS, skip reasons and baseline integrity. |
| L-015 | A gate stays green while a visible defect remains. | Identify the missing assertion and prove it detects the defect. |
| L-016 | Different design states prescribe contradictory data or order. | Measure the conflict, request a decision and record the unresolved states. |
| L-017 | Repeated images and large files dominate request cost. | Give delegates measured findings, extract relevant fields and keep sessions bounded. |
| L-018 | A stale cached asset hides an otherwise correct fix. | Inspect cache keys and verify the delivered asset before changing more code. |

## Record lessons in the consuming project

Record a new lesson as `## L-NNN · date · category`, followed by the observed failure, tested cause,
fix and reusable rule. Keep project-specific details in that project's own knowledge base.
Before adding a lesson here, replace names, tickets, hosts, paths, design IDs and operational figures
with abstract examples. Preserve the decision the lesson changes.
