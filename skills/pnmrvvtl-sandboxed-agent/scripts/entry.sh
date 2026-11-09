#!/usr/bin/env bash
# Container entrypoint. Inputs in /xfer: repo.bundle, task.md (agent mode), carry.patch (optional).
# Env: BRANCH, MODE (agent|exec), HARNESS, MODEL, TIMEOUT (seconds), COMMAND (exec mode).
# Outputs in /xfer: out.patch, status.txt, events.jsonl, stderr.log, exec.log, install.log, exit.txt.
set -uo pipefail
cd /work

# Logins: copied from read-only mounts, never written back.
mkdir -p ~/.local/share/opencode ~/.grok ~/.codex ~/.claude ~/.config/opencode
[ -f /auth/opencode-auth.json ] && cp /auth/opencode-auth.json ~/.local/share/opencode/auth.json
[ -f /auth/grok-auth.json ] && cp /auth/grok-auth.json ~/.grok/auth.json
[ -f /auth/codex-auth.json ] && cp /auth/codex-auth.json ~/.codex/auth.json
[ -f /auth/claude-credentials.json ] && cp /auth/claude-credentials.json ~/.claude/.credentials.json
# The container is the sandbox, so the harness may use any tool and path inside it without asking.
# OPENCODE_WHITELIST: comma-separated "provider/model" ids; when set, OpenCode in the box can use only those models.
python3 - > ~/.config/opencode/opencode.json <<'PY'
import collections, json, os
config = {"$schema": "https://opencode.ai/config.json", "permission": {"*": "allow", "external_directory": "allow"}}
allowed = collections.defaultdict(list)
for model_id in filter(None, os.environ.get("OPENCODE_WHITELIST", "").split(",")):
    provider, _, model = model_id.strip().partition("/")
    allowed[provider].append(model)
# OPENCODE_CONTEXT_LIMIT: declared context window for the allowed models, so automatic compaction starts before the
# provider rejects the request (OpenCode otherwise trusts model metadata that can be larger than the real window).
limit = int(os.environ.get("OPENCODE_CONTEXT_LIMIT") or 0)
# OPENCODE_OUTPUT_LIMIT: cap output per response, including reasoning.
output = int(os.environ.get("OPENCODE_OUTPUT_LIMIT") or 32000)
config["compaction"] = {"auto": True, "prune": True}
if allowed:
    config["provider"] = {p: {"whitelist": models} for p, models in allowed.items()}
    if limit:
        for p, models in allowed.items():
            config["provider"][p]["models"] = {m: {"limit": {"context": limit, "output": output}} for m in models}
    config["enabled_providers"] = list(allowed)  # hides every other provider (Zen, OpenRouter, ...)
print(json.dumps(config))
PY

git config --global user.name agent-box
git config --global user.email agent-box@localhost
git config --global --add safe.directory /work

# Workspace = exactly the bundled branch head (+ carried patch).
[ -d /work/.git ] || git init -q /work
git fetch -q /xfer/repo.bundle "$BRANCH" || { echo fetch-failed > /xfer/exit.txt; exit 1; }
git checkout -q -f -B "$BRANCH" FETCH_HEAD
for r in ${EXTRA_REFS:-}; do git fetch -q /xfer/repo.bundle "refs/heads/$r:refs/remotes/host/$r"; done
git clean -q -fd
if [ -s /xfer/carry.patch ]; then git apply --index /xfer/carry.patch || { echo carry-failed > /xfer/exit.txt; exit 1; }; fi

{
  if [ -f .agent-box/setup.sh ]; then bash .agent-box/setup.sh
  elif [ -f pnpm-lock.yaml ]; then pnpm install --frozen-lockfile
  elif [ -f package-lock.json ]; then npm ci
  elif [ -f yarn.lock ]; then corepack yarn install --immutable
  fi
} > /xfer/install.log 2>&1

# Untracked helper files (caches) the host seeded; they must be git-ignored in the repo to stay out of the patch.
[ -d /xfer/seed ] && cp -r /xfer/seed/. /work/

git add -A
head=$(git rev-parse HEAD)   # the branch head before the carry; an agent commit must not shrink the cumulative patch
base=$(git commit-tree "$(git write-tree)" -p HEAD -m round-base)   # plumbing only: no hooks, no branch change

t=${TIMEOUT:-6000}
if [ "${MODE:-agent}" = exec ]; then
  timeout -k 30 "$t" bash -lc "$COMMAND" < /dev/null > /xfer/exec.log 2>&1
else
  case "$HARNESS" in
    opencode) timeout -k 30 "$t" opencode run --format json -m "$MODEL" "$(cat /xfer/task.md)" ;;
    grok)     timeout -k 30 "$t" grok --prompt-file /xfer/task.md --always-approve --output-format streaming-json \
                -m "$MODEL" --max-turns "${MAX_TURNS:-400}" ;;
    codex)    timeout -k 30 "$t" codex exec --json --dangerously-bypass-approvals-and-sandbox -m "$MODEL" - ;;
    claude)   timeout -k 30 "$t" claude -p --output-format stream-json --verbose --dangerously-skip-permissions \
                --model "$MODEL" --effort "${EFFORT:-medium}" ;;
    *) echo "unknown harness: $HARNESS" >&2; false ;;
  esac < <( [ "$HARNESS" = codex ] || [ "$HARNESS" = claude ] && cat /xfer/task.md || true ) \
    > /xfer/events.jsonl 2> /xfer/stderr.log
fi
echo $? > /xfer/exit.txt

# Codex writes quota (rate_limits: used %, window, reset time) only to its session log, not to the --json stream.
latest=$(ls -t ~/.codex/sessions/*/*/*/rollout-*.jsonl 2>/dev/null | head -1)
[ -n "$latest" ] && cp "$latest" /xfer/codex-session.jsonl

git add -A
git diff --cached --binary "$base" > /xfer/out.patch
git diff --cached --binary "$head" > /xfer/cumulative.patch   # carry + this round, relative to the branch head
git status --short > /xfer/status.txt
