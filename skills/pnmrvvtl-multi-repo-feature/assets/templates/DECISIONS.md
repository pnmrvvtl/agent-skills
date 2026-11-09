# DECISIONS (locked unless the user changes them)

| # | Date | Decision |
|---|---|---|
| D-01 | {{DATE}} | Scope: <what is in, what is explicitly out>. |
| D-02 | {{DATE}} | <what is mocked vs production — default: only the network>. |
| D-03 | {{DATE}} | Git: one local commit per phase once all gates are green. Hooks never bypassed. No push. |
| D-04 | {{DATE}} | Visual gate: <global budget> **and** per-region cells, plus computed-style checks. |
| D-05 | {{DATE}} | Agent limits: if <A> is limited, <B> takes over, and the reverse; if both, save state, stop, report. The orchestrator never writes feature code. |
| D-06 | {{DATE}} | Never idle-wait on a single signal: every agent run under the watchdog, plus an orchestrator heartbeat. |
| D-07 | {{DATE}} | No guesses. "Done" only when the mechanical gates are green. Assets verbatim from the design. Wording: "implemented, NOT verified: <gate>" until green. |
| D-08 | {{DATE}} | Inspect before implement: search the inventory + the repos first; reuse or extract before building. Exceptions need a written note. |
| D-09 | {{DATE}} | Design assets verbatim (`figma:<nodeId>`); fonts mapped through the project; invalid-CSS patterns banned. |
| D-10 | {{DATE}} | Every interactive control needs an e2e proof. "Renders" is not "works". |
| D-11 | {{DATE}} | Delegates never read images; design PNGs are measured with a script, large JSON extracted with a script. The orchestrator is the only one who looks at pictures. |
| D-12 | {{DATE}} | Where design frames of one screen contradict each other, the product follows <which frames> and the disagreeing states are parked with `test.fixme`, their measured number and the cause. They un-park when the designer reconciles the frames. |

## Assumptions (user may override)

- <assumption, with the source it came from>
