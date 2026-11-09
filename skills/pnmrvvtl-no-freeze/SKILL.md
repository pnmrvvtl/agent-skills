---
name: pnmrvvtl-no-freeze
description: Keep an AI agent working until the task is actually done, without freezing or idling. Wrap every long or external command (agent CLIs such as codex, grok, opencode, pi, claude -p, plus builds and test suites) in a watchdog that closes stdin, enforces a hard timeout and an output-idle timeout, and kills the whole process tree, including a job that wrote its result but never exited. Adds a "don't stop while work remains" guard, usable as a Claude Code Stop hook or as an outer loop for any CLI, and a self-heartbeat rule. Use when running autonomous, overnight or unattended work, orchestrating other agents, when the user says don't freeze, keep going, work until done, run overnight, or when a background job might hang.
---

# No freeze

An agent that waits on one signal will eventually wait forever. The known killers are:
- a child process that finishes its work but never exits
- a CLI blocked on a stdin that nobody closes (`codex exec`, openai/codex#20919)
- a network stream that never ends
- the agent itself ending its turn "to wait" with nothing scheduled to wake it

A process can write its result and remain alive; monitor both the result and the process.

Resolve `<installed-skill-dir>` to the directory containing this SKILL.md. Scripts are in its `scripts/` directory (node, no dependencies, Windows + POSIX).

## Rules
1. **Never run a long or external command bare.** Use the watchdog:
   ```
   node "<installed-skill-dir>/scripts/watchdog.mjs" --timeout 90m --idle 20m --done-file <agent result file> --log <log> -- <command> [args]
   ```
   - It closes stdin and kills the whole process tree on `TIMEOUT` (no finish) or `STALLED` (no output for `--idle`).
   - It also kills on `HUNG-AFTER-DONE`: the result file was written but the process did not exit within 60 s.
   - Its last line always starts with `watchdog:`, so it can never hang its caller.
   - Size the timeout at about 2× the expected duration.
2. **Never end a turn to "wait" without a wake-up.** Something must be armed that re-invokes you: a background job with a timeout,
   or a heartbeat (Claude Code: a background `sleep 1800 && echo heartbeat`; other tools: their scheduler or loop). Waiting on one
   notification with no timer is a defect.
3. **On every wake-up, check every job:**
   - result present but process alive → kill it and continue
   - log not growing for 20 min or more → treat it as stalled
   - finished → review it and start the next step
   Idle more than 30 min without a check is a defect.
4. **Declare what "done" means, and guard it.** Put `.no-freeze.json` in the project root:
   ```json
   { "active": true, "doneCheck": "<command that exits 0 only when all work is done>", "maxBlocks": 20 }
   ```
   Keep it out of commits with `.git/info/exclude`, together with `.no-freeze.state`. Set `"active": false`, and tell the user why,
   only when you are genuinely blocked or finished.
5. **Only kill what you started, and all of it.** After stopping a job on Windows, also find and kill the node children it left behind (a shell stop does not kill the tree). Kill by the PID you spawned, never by process name. The user's own copies of the same tool
   (IDE extensions, terminals) stay untouched.

## Enforce it
- **Claude Code:** register the guard as a Stop hook. It blocks the end of the turn while `doneCheck` fails, up to `maxBlocks` times:
  ```json
  { "hooks": { "Stop": [ { "hooks": [ { "type": "command",
      "command": "node \"<installed-skill-dir>/scripts/stop-guard.mjs\"" } ] } ] } }
  ```
  Put it in the project's `.claude/settings.json` or `~/.claude/settings.json`. It does nothing when no `.no-freeze.json` exists.
- **Any other CLI** (codex, grok, opencode, pi, aider): use an outer loop around its resume/continue command:
  ```
  until node "<installed-skill-dir>/scripts/stop-guard.mjs" --check <dir>; do node "<installed-skill-dir>/scripts/watchdog.mjs" --timeout 60m --idle 15m -- <cli> <resume args>; done
  ```
  If the tool has its own hooks (for example grok's and codex's hook config), point their stop/turn-end hook at `stop-guard.mjs`.
  It speaks Claude's `{"decision":"block"}` format and exits 0 to allow.

## Checklist for an unattended run
```
- [ ] .no-freeze.json with a real doneCheck (gates or tests, or a phase checkbox grep)
- [ ] Stop hook or outer loop in place
- [ ] every agent/job launched through watchdog.mjs, with timeouts ≈ 2× the expected time
- [ ] heartbeat armed whenever nothing else will wake you
- [ ] each wake-up: result file? log growing? PID alive? → act
```
