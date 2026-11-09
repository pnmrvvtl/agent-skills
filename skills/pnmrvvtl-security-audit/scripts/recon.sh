#!/usr/bin/env bash
# Read-only reconnaissance: stack signals, entry points, dangerous sinks, config files.
#
#   recon.sh <project root> <audit dir> [sub path to focus on]
#
# Writes <audit dir>/raw/recon.md. Every hit is a place to LOOK, not a finding.
set -uo pipefail

ROOT=$(cd "${1:?project root required}" && pwd)
AUDIT=${2:?audit dir required}
FOCUS=${3:-.}
mkdir -p "$AUDIT/raw"
OUT=$AUDIT/raw/recon.md
cd "$ROOT" || exit 2

# Tracked + untracked-but-not-ignored files; falls back to find outside git.
if git rev-parse --git-dir >/dev/null 2>&1; then
  FILES=$(git ls-files -co --exclude-standard -- "$FOCUS")
else
  FILES=$(find "$FOCUS" -type f -not -path '*/node_modules/*' -not -path '*/.git/*' -not -path '*/dist/*' -not -path '*/build/*')
fi
CODE=$(echo "$FILES" | grep -E '\.(js|jsx|ts|tsx|mjs|cjs|vue|svelte|astro|py|dart|go|java|kt|php|rb)$' | grep -vE '(^|/)(dist|build|coverage|\.next|vendor)/')

hits() {
  # $1 title, $2 regex; prints file:line:text, capped
  local n tmp
  tmp=$(mktemp)
  echo "### $1"; echo; echo '```'
  n=$(echo "$CODE" | tr '\n' '\0' | xargs -0 -r grep -nE "$2" 2>/dev/null | grep -vE '(\.test\.|\.spec\.|__tests__|/tests?/)' | tee "$tmp" | wc -l)
  head -60 "$tmp" | cut -c1-200
  [ "$n" -gt 60 ] && echo "... $n hits total, first 60 shown"
  echo '```'; echo
  rm -f "$tmp"
}

{
  echo "# Recon: $ROOT (focus: $FOCUS)"
  echo
  echo "Files: $(echo "$FILES" | grep -c .) total, $(echo "$CODE" | grep -c .) code files."
  echo
  echo "## Stack signals"
  echo
  for f in package.json pnpm-lock.yaml package-lock.json yarn.lock requirements.txt pyproject.toml Pipfile \
           pubspec.yaml go.mod pom.xml build.gradle composer.json Gemfile Dockerfile docker-compose.yml \
           docker-compose.yaml next.config.js next.config.mjs next.config.ts nuxt.config.ts svelte.config.js \
           vite.config.ts vite.config.js angular.json nest-cli.json vercel.json netlify.toml serverless.yml; do
    [ -e "$f" ] && echo "- \`$f\`"
  done
  ls .github/workflows/*.y*ml >/dev/null 2>&1 && echo "- \`.github/workflows/\` ($(ls .github/workflows | wc -l) workflows)"
  echo
  if [ -f package.json ]; then
    echo "### package.json frameworks and security-relevant deps"
    echo
    node -e '
      const j=require(process.cwd()+"/package.json");const d={...j.dependencies,...j.devDependencies};
      const re=/^(next|nuxt|@sveltejs\/kit|@remix-run|astro|react|vue|svelte|@angular\/core|express|fastify|koa|hono|@nestjs\/core|graphql|apollo|prisma|@prisma\/client|sequelize|typeorm|knex|mongoose|mongodb|pg|mysql2?|better-sqlite3|drizzle-orm|jsonwebtoken|jose|passport|next-auth|@auth\/core|lucia|bcrypt|bcryptjs|argon2|helmet|cors|express-rate-limit|zod|joi|yup|class-validator|dompurify|isomorphic-dompurify|sanitize-html|marked|markdown-it|multer|busboy|formidable|axios|node-fetch|got|undici|ws|socket\.io|openai|@anthropic-ai\/sdk|ai|langchain|stripe|serialize-javascript|node-serialize|js-yaml|lodash|xml2js|puppeteer|playwright)$/;
      for(const [k,v] of Object.entries(d)) if(re.test(k)) console.log(`- ${k} ${v}`);
      const s=j.scripts||{}; for(const k of ["preinstall","install","postinstall","prepare"]) if(s[k]) console.log(`- script ${k}: ${s[k]}`);'
    echo
  fi

  echo "## Entry points"
  echo
  hits "HTTP routes / handlers" '(app|router|server|fastify)\.(get|post|put|patch|delete|all|use)\(|@(Get|Post|Put|Patch|Delete|Controller)\(|export (async )?function (GET|POST|PUT|PATCH|DELETE)\b|@app\.(get|post|put|delete|route)|path\(|urlpatterns|createServer\(|req\.method|method === ["'"'"']|url\.pathname'
  hits "Server actions / form actions / loaders" "[\"']use server[\"']|export const actions|export (async )?function (load|action|loader)\\b|getServerSideProps"
  hits "GraphQL / websockets / queues / cron" 'resolvers|ApolloServer|createYoga|new WebSocketServer|io\.on\(|socket\.on\(|\.process\(|new Worker\(|cron|schedule\('
  hits "Webhooks" 'webhook|constructEvent|x-hub-signature|stripe-signature'

  echo "## Dangerous sinks"
  echo
  hits "SQL / NoSQL raw" '\.prepare\(|\$queryRawUnsafe|\$executeRawUnsafe|\.raw\(|sequelize\.query|knex\.raw|\.query\(`|\.query\(".*\+|execute\(f"|cursor\.execute\(.*(%|\+|f")|\$where|\.extra\('
  hits "Command / code execution" 'child_process|exec\(|execSync|spawn\(|shell: ?true|eval\(|new Function\(|vm\.run|os\.system|subprocess\.|pickle\.loads|yaml\.load\('
  hits "HTML / XSS sinks" 'dangerouslySetInnerHTML|v-html|innerHTML|outerHTML|insertAdjacentHTML|document\.write|bypassSecurityTrust|\{@html|\|safe\b|<%-'
  hits "Outbound requests (SSRF)" 'fetch\(|axios[.(]|got\(|request\(|http\.get\(|https\.get\(|urllib|requests\.(get|post)|httpx\.'
  hits "Filesystem with paths" 'readFile|createReadStream|writeFile|sendFile|res\.download|unlink|path\.join\(.*req|open\(.*request'
  hits "Mass assignment" '\.\.\.req\.body|Object\.assign\([^,]+, ?req\.body|\.create\(req\.body|\.update\(req\.body|\*\*request\.(json|data)'
  hits "Crypto / tokens" "Math\\.random|createHash\\([\"'](md5|sha1)|rejectUnauthorized: ?false|verify=False|NODE_TLS_REJECT_UNAUTHORIZED|jwt\\.decode\\(|algorithms|alg.*none"
  hits "Fail-open / swallowed errors" 'catch ?\{\s*\}|catch ?\([a-z_]*\) ?\{\s*\}|\.catch\(\(\) ?=> ?\{?\s*\}?\)|catch.*next\(\)|err\.stack|res\.(send|json)\(err'
  hits "Client storage of tokens" 'localStorage\.setItem|sessionStorage\.setItem|SharedPreferences|AsyncStorage'
  hits "CORS / cookies / headers" "Access-Control-Allow-Origin|cors\\(|credentials: ?true|httpOnly|sameSite|secure: ?false|helmet"
  hits "LLM calls (prompt injection / output handling)" 'openai|anthropic|chat\.completions|messages\.create|generateText|streamText|langchain'

  echo "## Config and secret-bearing files"
  echo
  echo '```'
  echo "$FILES" | grep -E '(^|/)\.env|\.pem$|\.key$|\.p12$|credentials|secrets?\.(json|ya?ml)|\.npmrc$|firebase.*\.json|google-services\.json|GoogleService-Info\.plist' | head -40
  echo '```'
  echo
  echo "## Public env vars (shipped to browsers)"
  echo
  hits "NEXT_PUBLIC_ / VITE_ / REACT_APP_ / PUBLIC_" '(NEXT_PUBLIC|VITE|REACT_APP|PUBLIC)_[A-Z_]*(KEY|SECRET|TOKEN|PASSWORD)'
} > "$OUT"

echo "recon written: $OUT"
