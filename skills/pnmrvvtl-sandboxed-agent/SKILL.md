---
name: pnmrvvtl-sandboxed-agent
description: Run any delegated AI agent (Codex, Grok Build, OpenCode, Claude Code headless) or any untrusted command inside a throwaway Docker container, so nothing it does can touch the host machine. The container gets a git bundle of one branch, the task file and one read-only harness login; it returns a patch. The host applies the patch only after review. Use whenever an agent will run unattended, with auto-approve, with --dangerously-* flags, on code or input written by someone else, or when the user says sandbox, isolated, container, "nothing on my PC", don't touch my machine, safe mode, or delegate to another agent. Also use to run agent-written tests and gates before they ever execute on the host.
---

# Sandboxed agent

An agent with auto-approve on the host has the user's full rights. A shell variable error can turn
a cleanup command into a deletion of an unrelated directory. Run untrusted work in an isolated
workspace and review the returned patch before applying it.

Resolve `<installed-skill-dir>` to the directory containing this SKILL.md. Scripts: `<installed-skill-dir>/scripts/` (bash; Git Bash on Windows, or POSIX).

## The rule

**No agent CLI and no agent-written code runs on the host until a human-level review has read it.** Agents run in
the box. Agent-written tests and gates run in the box first. The host only receives a patch.

## How the box works

```
host                                      container (non-root, --rm, CPU/RAM limits)
repo ──git bundle <branch>──▶ xfer/<name>/repo.bundle ──▶ /work  (own named volume, own node_modules)
task.md ────────────────────▶ xfer/<name>/task.md          agent runs here with full permissions
~/.<harness>/auth.json ──ro──▶ /auth/<file>  (copied in)
                              ◀── xfer/<name>/out.patch, status.txt, events.jsonl, stderr.log, exit.txt
```

Mounted into the container: the `xfer/<name>` folder, one auth file read-only, a named volume for `/work`, a shared
package-cache volume. **Never** mount the home folder, the repo folder, `~/.ssh`, git credentials or
`/var/run/docker.sock`, and never use `--privileged` or `--network host`.

## Commands

```bash
B="<installed-skill-dir>/scripts"
bash "$B/box.sh" build                      # once, and after changing harness versions
bash "$B/box.sh" agent --repo <path> --branch <branch> --harness <opencode|grok|codex|claude> \
     --model <id> --task <task.md> --name <id> [--carry <patch>] [--timeout 6000]
bash "$B/box.sh" exec  --repo <path> --branch <branch> --name <id> [--carry <patch>] -- <command...>
bash "$B/box.sh" clean --name <id>          # removes that box's volume and archives its transfer folder
```

- Results land in `$BOX_ROOT/xfer/<name>/` (`BOX_ROOT` defaults to `~/agent-box`). The last line printed is
  `box: exit=<code> patch=<bytes>`.
- `--carry <patch>`: work from an earlier round that is not committed on the host yet. It is applied on top of the
  branch before the agent starts; the new `out.patch` is the delta of this round only.
- `--seed FILE:REL_PATH`: copy a host file into the workspace before the run, for example a mutation-testing cache
  (`--seed reports/stryker-incremental.json:reports/stryker-incremental.json`). The path must be git-ignored.
- `--with-ref <branch>` (repeatable): also put that branch in the box as `host/<branch>`, e.g. so the agent can
  `git merge host/main` and resolve conflicts itself.
- `exec` runs a command (for example `pnpm gate:full`) on branch + carry in the box and writes `exec.log`. Use it to
  run agent-written tests before they run anywhere else.
- Dependencies are installed in the box from the lockfile (pnpm, npm or yarn). A repo can add
  `.agent-box/setup.sh` for anything else.

## Workflow per task

1. Commit the task file and everything the agent needs on a branch. The box sees the committed branch content, plus the explicitly supplied task, carry patch and seed files.
2. Write the task file. Always tell the agent: it works in `/work`, must not commit, temporary files only under
   `mktemp -d`, and it must report what it did. If the host OS differs from Linux, say so and require
   platform-neutral code and tests.
3. `box.sh agent ...` in the background with a timeout (pair with `pnmrvvtl-no-freeze`).
4. Read `events.jsonl` for the final report and `status.txt` for the touched files.
5. **Review the patch before applying it.** At minimum:
   ```bash
   grep -nE '^\+.*(rm -rf|rmSync|unlink|Remove-Item|rimraf|homedir|USERPROFILE|\$HOME|child_process|exec\(|spawn|curl |fetch\(|\.ssh|auth\.json|token)' out.patch
   ```
   Every hit needs a reason. Then read the diff itself.
6. `box.sh exec ... -- <gates>` with `--carry out.patch` if the gates are not yet trusted.
7. Only then `git apply --index out.patch` on the host and commit through the normal hooks (never `--no-verify`).
8. `box.sh clean --name <id>` when the task is finished.

## Harness notes

| Harness | Auth file mounted | Command in the box |
|---|---|---|
| `opencode` | `~/.local/share/opencode/auth.json` | `opencode run --format json -m <model> <task>`; permissions set to allow-all inside the box (headless OpenCode otherwise rejects `/tmp` and ends the session) |
| `grok` | `~/.grok/auth.json` | `grok --prompt-file <task> --always-approve --output-format streaming-json -m <model>` (`grok models` lists ids) |
| `codex` | `~/.codex/auth.json` | `codex exec --json --dangerously-bypass-approvals-and-sandbox -m <model> -` with the task on stdin |
| `claude` | `~/.claude/.credentials.json` | `claude -p --output-format stream-json --verbose --dangerously-skip-permissions --model <model>` with the task on stdin |

The `--dangerously-*` flags are acceptable **only** because the container is the sandbox. Never use them on the host.

## Known limits (tell the user, do not hide them)

- The agent can read its own login token inside the box, and network egress is open (models and package registries
  need it). A prompt-injected agent could exfiltrate that one token. Revoke it by logging in again. For stronger
  isolation, add an egress allowlist proxy or move to microVMs (E2B, Firecracker).
- A token refreshed inside the box is not written back to the host.
- The box is Linux. Windows-only behaviour must still be checked on the host, after review.

## Never

- Run `codex`, `grok`, `opencode`, `claude -p`, `pi` or any other agent CLI directly on the host for delegated work.
- Run a destructive command on the host built from a variable you have not printed first. Prefer moving to a
  backup over deleting; ask before deleting anything you did not create in this task.
- Apply a patch you have not read, or bypass the host's git hooks to land it.
