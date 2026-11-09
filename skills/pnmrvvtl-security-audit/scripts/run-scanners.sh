#!/usr/bin/env bash
# Run every available security scanner against a project, read-only, storing raw output.
#
#   run-scanners.sh <project root> <audit dir>
#
# Missing tools are recorded, never fatal. Nothing is installed and nothing in the
# project is modified (npm audit reads the lockfile; no `npm audit fix`, no installs).
set -uo pipefail

ROOT=$(cd "${1:?project root required}" && pwd)
AUDIT=${2:?audit dir required}
RAW=$AUDIT/raw
mkdir -p "$RAW"
STATUS=$RAW/scanners.md
echo "# Scanner runs ($(date '+%F %H:%M'))" > "$STATUS"
echo "" >> "$STATUS"
echo "| Tool | Version | Result | Output |" >> "$STATUS"
echo "|---|---|---|---|" >> "$STATUS"

have() { command -v "$1" >/dev/null 2>&1; }
row() { echo "| $1 | $2 | $3 | $4 |" >> "$STATUS"; echo "$1: $3"; }

# Scanners may exit non-zero when they FIND issues; that is a result, not a failure.
run() {
  local name=$1 out=$2; shift 2
  ( cd "$ROOT" && timeout 1200 "$@" ) > "$RAW/$out" 2> "$RAW/$out.stderr"
  local rc=$?
  [ "$rc" = 124 ] && echo "timeout" && return
  echo "exit $rc"
}

# JS package managers: audit whichever lockfile exists.
if [ -f "$ROOT/package-lock.json" ] && have npm; then
  row "npm audit" "$(npm --version)" "$(run npm npm-audit.json npm audit --json)" "raw/npm-audit.json"
  if [ -d "$ROOT/node_modules" ]; then
    row "npm audit signatures" "$(npm --version)" "$(run npm npm-signatures.txt npm audit signatures)" "raw/npm-signatures.txt"
  else
    row "npm audit signatures" "$(npm --version)" "SKIPPED: needs installed node_modules (not installed by the audit)" "-"
  fi
elif [ -f "$ROOT/pnpm-lock.yaml" ] && have pnpm; then
  row "pnpm audit" "$(pnpm --version)" "$(run pnpm pnpm-audit.json pnpm audit --json)" "raw/pnpm-audit.json"
elif [ -f "$ROOT/yarn.lock" ] && have yarn; then
  row "yarn audit" "$(yarn --version)" "$(run yarn yarn-audit.json yarn npm audit --json)" "raw/yarn-audit.json"
elif [ -f "$ROOT/package.json" ]; then
  row "js audit" "-" "SKIPPED: package.json without a lockfile (itself a supply-chain finding candidate)" "-"
fi

if have osv-scanner; then
  row "osv-scanner" "$(osv-scanner --version 2>/dev/null | head -1)" \
    "$(run osv osv.json osv-scanner scan source -r --format json .)" "raw/osv.json"
else
  row "osv-scanner" "-" "MISSING" "-"
fi

if have gitleaks; then
  V=$(gitleaks version 2>/dev/null)
  if git -C "$ROOT" rev-parse --git-dir >/dev/null 2>&1; then
    row "gitleaks (history)" "$V" \
      "$(run gitleaks gitleaks-history.log gitleaks detect --source . --redact --report-format json --report-path "$RAW/gitleaks-history.json")" "raw/gitleaks-history.json"
  fi
  row "gitleaks (working tree)" "$V" \
    "$(run gitleaks gitleaks-tree.log gitleaks detect --source . --no-git --redact --report-format json --report-path "$RAW/gitleaks-tree.json")" "raw/gitleaks-tree.json"
else
  row "gitleaks" "-" "MISSING" "-"
fi

if have semgrep; then
  CONFIGS=(--config p/owasp-top-ten --config p/secrets)
  [ -f "$ROOT/package.json" ] && CONFIGS+=(--config p/javascript --config p/typescript)
  { [ -f "$ROOT/requirements.txt" ] || [ -f "$ROOT/pyproject.toml" ]; } && CONFIGS+=(--config p/python)
  row "semgrep" "$(semgrep --version 2>/dev/null)" \
    "$(run semgrep semgrep.json semgrep scan "${CONFIGS[@]}" --json --metrics=off .)" "raw/semgrep.json"
else
  row "semgrep" "-" "MISSING" "-"
fi

if ls "$ROOT"/Dockerfile* "$ROOT"/docker-compose* "$ROOT"/*.tf "$ROOT"/k8s "$ROOT"/helm >/dev/null 2>&1; then
  if have trivy; then
    row "trivy config" "$(trivy --version 2>/dev/null | head -1)" "$(run trivy trivy-config.json trivy config --format json .)" "raw/trivy-config.json"
  else
    row "trivy" "-" "MISSING (Docker/IaC present)" "-"
  fi
fi

if [ -f "$ROOT/requirements.txt" ] || [ -f "$ROOT/pyproject.toml" ]; then
  if have pip-audit; then
    row "pip-audit" "$(pip-audit --version 2>/dev/null)" "$(run pip pip-audit.json pip-audit -f json)" "raw/pip-audit.json"
  else
    row "pip-audit" "-" "MISSING (Python deps present)" "-"
  fi
fi

# Dependency install scripts: code that runs on every `npm install`.
if [ -d "$ROOT/node_modules" ]; then
  node -e '
    const fs=require("fs"),p=require("path");const root=process.argv[1];const out=[];
    const walk=(d,depth)=>{if(depth>3)return;let es=[];try{es=fs.readdirSync(d,{withFileTypes:true})}catch{return}
      for(const e of es){if(!e.isDirectory())continue;const q=p.join(d,e.name);
        if(e.name.startsWith("@")){walk(q,depth);continue}
        try{const j=JSON.parse(fs.readFileSync(p.join(q,"package.json"),"utf8"));const s=j.scripts||{};
          for(const k of ["preinstall","install","postinstall"]) if(s[k]) out.push(`${j.name}@${j.version} ${k}: ${s[k]}`)}catch{}
        const nm=p.join(q,"node_modules");if(fs.existsSync(nm))walk(nm,depth+1)}};
    walk(p.join(root,"node_modules"),0);console.log(out.join("\n"));' "$ROOT" > "$RAW/install-scripts.txt" 2>/dev/null
  row "install scripts" "-" "$(wc -l < "$RAW/install-scripts.txt" | tr -d ' ') packages with install scripts" "raw/install-scripts.txt"
fi

echo ""
echo "status table: $STATUS"
