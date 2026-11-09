# Delegation: dispatch, watchdog, failure modes, cost

The orchestrator's job is to make an implementer's run short, bounded and checkable. This file is how.

## One writer per repo

Only one agent writes a given repository at a time. Parallel units are allowed only across disjoint file
sets, and the disjointness is written into **both** packets (a list of the paths the other agent owns and
must not be touched). Each packet says: "If `tsc` or `eslint` report errors in files you did not touch,
ignore them and mention them in your report. Do not fix them."

Packets are **agent-agnostic**: nothing in a packet names the model. That makes reassignment free when a
quota dies, so another implementer can resume the same scope.

## Never run an agent bare

Wrap every long or external command in the `pnmrvvtl-no-freeze` watchdog:

```
node <no-freeze>/scripts/watchdog.mjs --timeout 90m --idle 20m \
  --done-file <agent result file> --log <log> -- <agent cli> [args]
```

- stdin is closed at once (agent CLIs block forever on a non-TTY pipe with no writer).
- `TIMEOUT` / `STALLED` kill the whole process tree; exit 124.
- `HUNG-AFTER-DONE`: the result file was written but the process did not exit — kills it, exit 0.
- Its last line always starts with `watchdog:`, so it can never hang its caller.
- Size the timeout at about 2× the expected duration. On Windows, after any stop, kill the **children**
  the shell orphaned, by the PID you spawned, never by process name.

Arm something that wakes the orchestrator even when no agent signals: a heartbeat (a background
`sleep 1800 && echo heartbeat`) plus a check of every running job. Idle for more than 30 minutes without a
check is a defect. On every wake-up: is the result file present? is the log growing? is the PID alive?
Result present but process alive → kill and continue. No output for 20 min → treat as stalled.

## Provider failure modes seen in practice

| Symptom | What it is **not** | What to do |
|---|---|---|
| `Bad Request: {"model":"<name>"}`, naming only the model | not necessarily an exhausted quota, not necessarily a context overflow — both were wrong diagnoses | **instrument before theorising**: a `PONG` probe and `--print-logs --log-level DEBUG` cost seconds. Never switch to a paid route on an unverified diagnosis. |
| `ProviderHeaderTimeoutError` | not a code failure | treat as a transient route failure; retry once, then reassign. |
| a directory-permission refusal | not a broken repo | the CLI's directory permission check refused a path outside the workspace, so the run ends there. Keep every temp file **inside** the repo (`agent-scratch/`); never write to `<outside-workspace>`. Treat it as an execution boundary. |
| context overflow | | start a fresh session with a packet that carries **findings, not files**. Do not paste the old transcript. |
| usage/quota limit | not a stoppage of the programme | save state to `PROGRESS.md`, reassign the packet to the fallback agent, report the reset time if both are out. |

Watch for an agent that reports checks green while having run them through a substitute runtime
("node inaccessible", "via Deno") — its evidence is not trustworthy; re-run the checks yourself.

## Resume, do not restart

When a session is stopped mid-unit, the next packet **continues from disk**, it does not restart:
"`<previous packet>` for scope; `<output file>` is on disk; continue from it, do not restart." A restart
throws away the work and pays the context again. `--continue` (opencode) or the equivalent resume flag is
the default; a fresh `exec` is the exception.

## Cost: context × steps (L-017)

Repeated context can dominate execution cost. Compare routes using a bounded representative task,
measuring prompt tokens, cache reads, completion quality and total cost in the current environment.
Do not assume that a particular model or route is always cheaper.

Rules:

- **Ban image reads in the packet** and in `_rules.md`. The orchestrator is the one who looks at pictures
  and turns what it sees into a written defect list ("row 2 card order wrong; the blog title wraps instead
  of truncating; the grid sits 9px low").
- **Never read a large JSON whole.** A 1-1.7MB design node file is extracted with a `node -e` script that
  prints only the needed fields.
- **Keep probe output to a few lines.** Filter, then print a summary.
- **Read source files with an offset and a limit** when only one region is needed.
- **Keep sessions short**; front-load exploration into the packet (name the token files, the modal
  primitive, the existing components) so the agent does not spend 100k tokens discovering them.
- **Check the free route is actually down** before paying for another. A `PONG` probe answers in seconds.
- Assign the heaviest unit to the agent with the **most remaining quota**, and always have a fallback.

## The scratch-directory convention

One git-ignored directory per repo (`agent-scratch/`) holds every throwaway: probe output, lint dumps,
measurement JSON, agent logs. Rules the packet states explicitly:

- **Never write outside the repository** (for example `<outside-workspace>/lint.txt`) — the CLI's directory permission
  check refuses to read it back and the run ends there.
- **`scratchpad/` at the repo root is not the agent's.** It holds the orchestrator's gate-runner scripts.
  Deleting it can remove the scripts that run the gates.
- Anything worth keeping is not temporary: it goes into the committed knowledge base.
