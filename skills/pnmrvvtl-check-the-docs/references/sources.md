# Sources — the ladder, rung by rung

Cheapest first. Take the highest rung that answers the question and stop. Every rung writes its
raw output to `.agent/stack-research/<slug>.txt`, never straight into the conversation.

When a fetch turns out to describe a version this repo does not have, delete the file once the
one-line finding is recorded. Keeping it invites the next read to lift a snippet out of it.

## Portability

The commands below are written with `rg` and `jq` because they read well. Neither is guaranteed
to exist — on a stock Windows box, neither is on `PATH`. Substitute without comment:

| Written as | Substitute with | Why |
|---|---|---|
| `rg PATTERN` | the agent's own search tool, or `grep -rn PATTERN` | `rg` is bundled with some agents, absent on others |
| `jq '.a.b'` | `node -p "JSON.parse(require('fs').readFileSync('f','utf8')).a.b"` or `python -c` | `jq` is rarely installed; node or python is already there in the ecosystem being inspected |
| `curl` | `curl.exe` when the shell is PowerShell | in Windows PowerShell `curl` is an **alias for `Invoke-WebRequest`**, which silently ignores `-s` and mangles `-H` |

Check once, at the top of the phase, rather than discovering it mid-ladder:

```bash
command -v rg jq curl gh node python 2>/dev/null
```

A missing tool is never a reason to skip a rung — it is a reason to reach it differently.

---

## Cache rung — facts already established for these versions

```bash
ls .agent/stack-research/facts-*.md
rg -l "^# react@18.3.1" .agent/stack-research/
```

A hit answers for free and with no network. A file whose version no longer matches the lockfile
is **deleted, not adapted** — a fact re-pointed at a version it was not established for is worse
than no fact.

---

## Rung 0 — this repo

Free, instant, and the highest authority there is: a working call in this codebase beats any
document about how the call should be made.

```bash
rg -n "useFormState|useActionState" --type ts
rg -n "from ['\"]next/server['\"]" -A2
rg -n "createClient\(" --type py
```

Also check what the repo already decided: `CLAUDE.md`, `AGENTS.md`, `docs/`, ADRs, and the
comment above the call. A pin with a `# do not upgrade, breaks X` next to it is an answer.

Answers: "how does this project do it", "does this project already have a helper for this".

---

## Rung 1 — the installed package on disk

Free, offline, and exact for the version actually installed. No hallucination surface: this is
the code that will run.

**JS / TS** — types are the API contract:

```bash
cat node_modules/<pkg>/package.json | jq '{version,exports,types}'
rg -n "export (declare )?function after" node_modules/next/**/*.d.ts
sed -n '1,80p' node_modules/<pkg>/CHANGELOG.md
```

**Python**:

```bash
python -c "import sqlalchemy, inspect; print(sqlalchemy.__version__); print(inspect.signature(sqlalchemy.orm.Session.execute))"
python -c "import x; print(x.__file__)"     # then read the source
pip show -f <pkg>
```

**Go**:

```bash
go doc github.com/org/pkg.Symbol
go doc -all github.com/org/pkg | head -100
```

**Rust**: `~/.cargo/registry/src/**/<crate>-<ver>/src/lib.rs`, or `cargo doc --open`.

**.NET**: `dotnet list package`, then the XML docs in the nupkg, or decompile with `ilspycmd`.

Answers: "does this symbol exist", "what is the exact signature", "is it deprecated" (the
deprecation attribute is right there), "what changed" (bundled CHANGELOG).

---

## Rung 2 — Context7 REST

Version-pinned documentation snippets. Works anonymously at low rate limits; a key raises them.
No MCP server needed — plain HTTP, so it behaves identically in Claude Code, Codex and Grok.

### Key

Optional. Resolution order:

1. `$CONTEXT7_API_KEY` in the environment
2. `CONTEXT7_API_KEY=` in the repo's `.env`, if the repo has one and it is git-ignored
3. no key — proceed anonymously, expect `429` sooner

Never echo the key, never write it into `.agent/stack-research/`, never put it in a request URL.

```bash
KEY="${CONTEXT7_API_KEY:-}"
AUTH=(); [ -n "$KEY" ] && AUTH=(-H "Authorization: Bearer $KEY")
```

### Resolve the library id

```bash
curl -s "${AUTH[@]}" \
  "https://context7.com/api/v2/libs/search?libraryName=next.js&query=middleware" | jq '.results[] | {id,title,trustScore,benchmarkScore,versions,lastUpdateDate}'
```

Pick by `id`, then sanity-check `trustScore` and `lastUpdateDate`. Ids look like
`/vercel/next.js`, `/reactjs/react.dev`, `/websites/<host>`.

### Fetch the context, pinned to the installed version

```bash
curl -s "${AUTH[@]}" \
  "https://context7.com/api/v2/context?libraryId=/vercel/next.js@14.2.35&query=middleware%20matcher&type=txt&tokens=2500" \
  > .agent/stack-research/next-middleware.txt
```

- `libraryId` — `/{org}/{project}` with an optional `@{version}`. **Always pin**, but pin to a
  version Context7 actually publishes, not to the npm version. It indexes doc snapshots, not
  every release: `/vercel/next.js@14.2.35` returns
  `{"error":"version_not_found", ... "Available versions": [...]}` — the response lists them, so
  the error is the lookup. Take the nearest published version at or below the resolved one, and
  record the gap in the brief as `docs read at 14.3.0-canary, repo on 14.2.35`. Never silently
  fall back to the unpinned id, which serves the newest branch.
- `query` — the Phase 2 question, not the topic. Specific queries return specific snippets.
- `type=txt` — prose + code, no JSON envelope. Use `type=json` only when the metadata is needed.
- `tokens` — the ceiling. Start at 2000-3000. Raising it is a budget decision, not a reflex.

List what is published before pinning, when the resolved version is not a round release:

```bash
curl -s "${AUTH[@]}" "https://context7.com/api/v2/libs/search?libraryName=next.js&query=." \
  | jq -r '.results[] | select(.id=="/vercel/next.js") | .versions[]'
```

Status codes: `400` with `version_not_found` — repin from the version list in the body;
`202` the library is still being indexed, retry later or drop to another rung;
`404` wrong id, search again; `429` back off, honour `Retry-After`, and switch rungs rather than
waiting; `401` the key is wrong — drop the header and go anonymous.

Answers: "what is the idiomatic usage in this version", "show me a working example".

Does **not** answer: anything about a private library, or a library Context7 has not indexed.

---

## Rung 3 — the project's own llms.txt

Maintainer-curated, free, no key. Try in order:

```bash
curl -sf https://<docs-host>/llms.txt        # index of pages
curl -sf https://<docs-host>/llms-full.txt   # whole docs, often huge — check size first
curl -sf https://<docs-host>/docs/llms.txt
```

`llms.txt` is the map; fetch only the one or two linked pages that matter.
`llms-full.txt` is frequently hundreds of thousands of tokens — check `content-length` before
downloading, and never read it whole:

```bash
curl -sI https://<docs-host>/llms-full.txt | rg -i content-length
```

Finding whether a project publishes one: <https://llmstxt.site>,
<https://directory.llmstxt.cloud>, <https://llmstxthub.com>.

Answers: conceptual questions the type signatures cannot — lifecycle, ordering, caveats,
"why does it behave this way".

---

## Rung 4 — targeted web search

Only after the rungs above failed, and only in this shape:

- the version is **in the query**: `next.js 14.2 middleware matcher limitations`
- constrain to primary sources with `allowed_domains` — the project's docs host, its GitHub, its
  changelog. Not a general sweep.
- date-bound the query when the answer is time-sensitive

Reject on sight: listicles, "top 10 best practices", content farms, anything summarising other
search results, and any page that does not name a version. Follow to the primary source and cite
that URL, not the aggregator.

A search result is rung 6 authority (see SKILL.md Phase 5) until it is traced back to the docs,
the repository, or the changelog.

---

## Rung 5 — how the world actually calls it

For "is this API used this way in practice", when the docs are thin or ambiguous.

```bash
gh search code "createServerClient" --language=ts --limit=20
gh search code "after(" --repo vercel/next.js --limit=20
```

grep.app covers a million public repos and has an MCP server; its bare HTTP API rate-limits
aggressively, so prefer `gh search code` when `gh` is authenticated.

Weigh by repo quality, not by hit count. Ten forks of one tutorial are one data point.

---

## Rung 6 — release notes and migration guides

The right rung for "did this change", "when was it deprecated", "what breaks if we bump".

```bash
gh api repos/vercel/next.js/releases --paginate -q '.[] | select(.tag_name|startswith("v15")) | .tag_name' | head
gh api repos/<org>/<repo>/releases/tags/v15.0.0 -q .body > .agent/stack-research/rel-15.txt
gh api repos/<org>/<repo>/contents/CHANGELOG.md -q .content | base64 -d | head -200
```

Deprecation and EOL of the version line itself:

```bash
curl -s "https://registry.npmjs.org/-/package/<pkg>/dist-tags"
curl -s "https://registry.npmjs.org/<pkg>/<version>" | jq '{deprecated, engines, time}'
curl -s "https://pypi.org/pypi/<pkg>/json" | jq '.info.yanked_reason'
curl -s "https://endoflife.date/api/<product>.json" | jq '.[0:3]'
```

Answers: the single most valuable question this skill asks — *what breaks between the version
this repo has and the version the docs describe*.

---

## Rungs deliberately not in the default ladder

| Source | Why not default | When to reach for it |
|---|---|---|
| DeepWiki (`mcp.deepwiki.com`) | needs MCP, and answers architecture rather than API | understanding a library's internals before patching or forking it |
| Ref.tools | closed, paid after 200 credits | private docs / PDFs the other rungs cannot see |
| Context7 MCP server | duplicates rung 2 while costing tool schema in every session | if the user later installs it, prefer it over curl and skip the key plumbing |
| `ctx7` CLI | one more install to keep in sync across three agents | interactive exploration by hand, outside a task |
