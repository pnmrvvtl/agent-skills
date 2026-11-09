#!/usr/bin/env bash
# agent-box host driver. Usage:
#   box.sh build
#   box.sh agent --repo R --branch B --harness H --model M --task FILE --name N [--carry PATCH] [--seed FILE:REL] [--timeout S]
#   box.sh exec  --repo R --branch B --name N [--harness H] [--carry PATCH] [--timeout S] -- COMMAND...
#   box.sh clean --name N
set -euo pipefail
hostpath() { cygpath -m "$1" 2>/dev/null || printf %s "$1"; }   # Docker on Windows wants an absolute host path
here=$(hostpath "$(cd "$(dirname "$0")" && pwd)")
root=$(hostpath "${BOX_ROOT:-$HOME/agent-box}")
h=$(hostpath "$HOME")
image=${BOX_IMAGE:-agent-box:1}
export MSYS_NO_PATHCONV=1   # Git Bash: keep container paths as written

mode=${1:?mode: build|agent|exec|clean}; shift
repo= branch= harness= model= task= name= carry= seed= refs= timeout=6000 cmd=()
while [ $# -gt 0 ]; do
  case $1 in
    --repo) repo=$2; shift 2 ;;      --branch) branch=$2; shift 2 ;;
    --harness) harness=$2; shift 2 ;; --model) model=$2; shift 2 ;;
    --task) task=$2; shift 2 ;;      --name) name=$2; shift 2 ;;
    --carry) carry=$2; shift 2 ;;    --timeout) timeout=$2; shift 2 ;;
    --seed) seed=$2; shift 2 ;;
    --with-ref) refs="$refs $2"; shift 2 ;;   # extra branch available in the box as host/<ref>      # FILE:REL_PATH, copied into the workspace (e.g. a test cache)
    --) shift; cmd=("$@"); break ;;
    *) echo "box: unknown argument $1" >&2; exit 2 ;;
  esac
done

case $mode in
  build) docker build -t "$image" "$here"; exit ;;
  clean)
    [[ $name =~ ^[A-Za-z0-9._-]+$ ]] || { echo "box: bad --name" >&2; exit 2; }
    docker volume rm "box-$name" >/dev/null 2>&1 || true
    [ -d "$root/xfer/$name" ] && mv "$root/xfer/$name" "$root/xfer/.done-$name-$(date +%s)"
    echo "box: cleaned $name (xfer moved aside, not deleted)"; exit ;;
esac

[[ $name =~ ^[A-Za-z0-9._-]+$ ]] || { echo "box: --name must match [A-Za-z0-9._-]+" >&2; exit 2; }
[ -n "$repo" ] && [ -n "$branch" ] || { echo "box: --repo and --branch are required" >&2; exit 2; }
repo=$(hostpath "$repo")
x=$root/xfer/$name
mkdir -p "$x"
git -C "$repo" bundle create "$x/repo.bundle" "$branch" $refs 2>/dev/null || { echo "box: cannot bundle $branch from $repo" >&2; exit 1; }
for f in out.patch status.txt exit.txt carry.patch exec.log; do [ -e "$x/$f" ] && mv -f "$x/$f" "$x/$f.prev"; done
[ -n "$carry" ] && cp "$carry" "$x/carry.patch"
rm -rf "$x/seed"; if [ -n "$seed" ]; then mkdir -p "$x/seed/$(dirname "${seed##*:}")"; cp "${seed%:*}" "$x/seed/${seed##*:}"; fi

env=(-e BRANCH="$branch" -e TIMEOUT="$timeout" -e MODE="$mode" -e EXTRA_REFS="$refs")
# Logins are mounted read-only for the named harness, in agent mode and in exec mode (e.g. a real doctor run).
auth=()
case $harness in
  '') ;;
  opencode) auth=(-v "$h/.local/share/opencode/auth.json:/auth/opencode-auth.json:ro") ;;
  grok)     auth=(-v "$h/.grok/auth.json:/auth/grok-auth.json:ro") ;;
  codex)    auth=(-v "$h/.codex/auth.json:/auth/codex-auth.json:ro") ;;
  claude)   auth=(-v "$h/.claude/.credentials.json:/auth/claude-credentials.json:ro") ;;
  *) echo "box: unknown harness $harness" >&2; exit 2 ;;
esac
if [ "$mode" = agent ]; then
  [ -n "$harness" ] && [ -n "$model" ] && [ -f "$task" ] || { echo "box: agent needs --harness --model --task" >&2; exit 2; }
  cp "$task" "$x/task.md"
  env+=(-e HARNESS="$harness" -e MODEL="$model" -e OPENCODE_WHITELIST="${OPENCODE_WHITELIST:-}" -e OPENCODE_CONTEXT_LIMIT="${OPENCODE_CONTEXT_LIMIT:-}" -e EFFORT="${EFFORT:-medium}")
else
  [ ${#cmd[@]} -gt 0 ] || { echo "box: exec needs -- COMMAND" >&2; exit 2; }
  env+=(-e COMMAND="${cmd[*]}")
fi

docker run --rm --name "box-$name" --cpus "${BOX_CPUS:-8}" --memory "${BOX_MEMORY:-12g}" --security-opt no-new-privileges \
  -v "box-$name:/work" -v box-pkg-cache:/home/node/.pkg-cache -v "$x:/xfer" -v "$here/entry.sh:/home/node/entry.sh:ro" "${auth[@]}" "${env[@]}" "$image" || true
echo "box: exit=$(cat "$x/exit.txt" 2>/dev/null || echo none) patch=$(wc -c < "$x/out.patch" 2>/dev/null || echo 0) dir=$x"
