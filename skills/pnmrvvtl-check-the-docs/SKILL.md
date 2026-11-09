---
name: pnmrvvtl-check-the-docs
description: Ground the work in current, version-pinned facts about the libraries and frameworks the task actually touches, instead of relying on model memory. Use when the task involves a third-party API, a framework feature, a config surface, a migration or an upgrade, when the user says "check the docs", "latest best practices", "is this still the right way", "did this change", or when a version-specific detail would change the implementation. Reads the exact installed versions from the repo first, asks a bounded list of questions, answers them from the cheapest reliable source, and returns a short sourced brief instead of a pile of documentation.
---

# Check The Docs

Model memory is a snapshot with no version attached. This skill replaces it with facts that
carry a version and a source URL, without moving the documentation into the context window.

Two failure modes, equally bad:

- **Stale.** Writing the pre-migration API because that is what memory holds.
- **Too fresh.** Writing the newest documented API into a repo pinned three majors back.

The second is the more common one, and it looks authoritative while being unbuildable. So the
version comes from the repo, always, before anything is fetched.

## Phase 0 — decide whether to look anything up

Answer this before spending a single request.

Skip this skill entirely when **all** of these hold:

- the change touches no third-party API, config surface, CLI flag or framework behaviour
- the repo already contains a working instance of the pattern being written
- nothing in the task mentions upgrading, migrating, or "the new way"

Run it when **any** of these hold:

- an API is being called that does not already appear in this repo
- a version was bumped, or the task is the bump
- the task names a feature that sounds recent
- something is deprecated, or is suspected to be
- an error message points at a library, not at project code
- a claim the model would otherwise make from memory would change the code if it were wrong

Stating "skipped, the repo already does X at `path:line`" is a valid and preferred outcome. The
repo is a source, and it is the cheapest one.

## Phase 1 — pin the versions

No fetch happens before this table exists.

| Library | Declared | Resolved | Source |
|---|---|---|---|
| next | `^14.2.0` | `14.2.35` | `package-lock.json` |

Resolved beats declared. Read the lockfile or ask the toolchain — never infer a version from a
range, and never assume "latest". `references/version-pinning.md` has the command per ecosystem.

Also pin what the code runs on when it matters: language runtime, compile target, framework
major, and for mobile the SDK / platform level.

If a version cannot be resolved, write `unknown` and say so in the brief. An unknown version
means every answer about that library is provisional — mark it, do not paper over it.

## Phase 2 — write the questions down

Convert the task into **at most five** questions. Each one must have a decision attached: if the
answer cannot change a line of code, drop the question.

Good:

- Does `after()` exist in `next@14.2.35`, or is it 15+ only?
- Was `useFormState` renamed in `react@19.2.0`, and what is the replacement signature?
- In `sqlalchemy@2.0.36`, is `Session.execute()` still the non-deprecated path for raw SQL?

Bad — unbounded, no decision, returns a book:

- Tell me about Next.js caching.
- What are the best practices for React state management?
- How does SQLAlchemy work?

Every question carries a version. A question without a version is not ready to be asked.

## Phase 3 — climb the ladder, stop when answered

Sources in cost order. Take the cheapest rung that answers the question, then stop. Do not sweep
every rung "for completeness" — that is the behaviour this skill exists to prevent.

```
-  cached facts               .agent/stack-research/facts-<lib>@<ver>.md
0  this repo                  grep for the symbol / pattern
1  installed package on disk  .d.ts, site-packages, go doc, bundled CHANGELOG
2  Context7 REST              version-pinned snippets, anonymous or keyed
3  official llms.txt          maintainer-curated docs index
4  targeted web search        primary domains only, version in the query
5  real-world usage           grep.app / gh search code
6  release notes              gh api releases, for breaking-change questions
```

The cache rung comes first because a repo's versions change far less often than its tasks: a
fact keyed to `react@18.3.1` stays true until that number moves. Rungs 0 and 1 are free,
offline, and exact for the installed version — they answer more questions than expected,
especially "does this symbol exist" and "what is its signature".
Exact commands and endpoints for every rung: `references/sources.md`.

### Climbing

"Stop when answered" is not "stop when a rung is tried". **An empty rung is not an answer** — it
is a reason to climb. A library Context7 has not indexed, an `llms.txt` that does not exist, a
search that returns only aggregators: each of those means the question is still open, and the
next rung is where it gets closed.

Rung 2 is cheap and version-pinned, not authoritative. It is a third-party index *of* the
official docs, and the source URL in its output is the thing with authority — follow that URL
when the snippet is ambiguous. The maintainer's own `llms.txt` at rung 3 outranks it, and
release notes at rung 6 are the only rung that answers "what breaks between these two versions".

The budget caps how many fetches happen in total. It never caps how high the ladder goes: six
fetches spread across rungs 3, 4 and 6 is a correct run. Reaching the top without an answer
produces an **Unknown**, which Phase 6 turns into a question for the user. Falling back to model
memory is never the way a climb ends.

**Raw output never enters the conversation.** Write every fetch to
`.agent/stack-research/<slug>.txt` (git-ignored, or the repo's own scratch location) and read
back only the part that answers the question. Piping a documentation dump into context is the
exact failure this skill exists to prevent.

### Budget

| Limit | Value | On exceeding |
|---|---|---|
| External fetches | 6 | stop, report the rest as unresolved |
| Raw text fetched | ~15k tokens | stop, distil what is already there |
| Questions | 5 | rank, answer the top ones, list the rest |
| Final brief | ~40 lines / 1.5k tokens | cut facts that change no code |

Running out of budget is a reportable result, not a reason to keep going. Unresolved questions
go into the brief under **Unknown**, and Phase 6 says what to do with them.

### Isolating the research — only if the user asks

When the ladder would be wide (more than two libraries, or the full five questions), the whole
of rungs 2-6 can run in a subagent whose context holds the raw documents and whose only return
value is the brief. That is the strongest possible version of "raw never enters the
conversation". It costs a spawn, so **do not do it unless the user asked for a subagent** —
writing fetches to disk already achieves most of the benefit.

## Phase 4 — distil into the brief

The only thing that survives into the working context is `.agent/stack-brief-<task>.md`, built
from `assets/stack-brief.md`. Fixed shape:

- **Versions** — the Phase 1 table
- **Facts** — 3 to 8 entries, each: claim, the version it holds for, source URL, confidence
- **Not applicable** — one line per API that belongs to a version this repo does not have
- **Unknown** — every question the budget did not answer, and what each one blocks
- **Verdict** — one line: what the implementation now does differently

Every fact carries a URL. A fact with no URL is model memory wearing a costume — source it or
move it to **Unknown**.

Delete facts that are true but change nothing. "Interesting" is not a criterion.

### Never carry the wrong version's code

The most dangerous token in the brief is a code sample from a version this repo does not have.
It is not noise the model ignores — it is a near-miss the model reaches for, because it looks
exactly like the answer. Irrelevant-but-similar content misleads harder than unrelated content.

So: a version that does not apply gets **one line of prose and no snippet**. Delete its raw file
from `.agent/stack-research/` rather than keeping it "for comparison".

```
useActionState — react 19, not applicable here (repo on 18.3.1). Use useFormState.
```

Never a fenced block showing how the 19 version would have been written.

### Cache by version, not by task

Write the durable part to `.agent/stack-research/facts-<lib>@<ver>.md`, and make
`.agent/stack-brief-<task>.md` the per-task view over it. Versions move far more slowly than
tasks, so the next change in this repo starts at the cache rung and often fetches nothing.

Invalidate when the resolved version changes. A cache entry whose version no longer matches the
lockfile is deleted, not adapted.

## Phase 5 — resolve conflicts by authority, not by recency

```
1  this repo's existing working pattern
2  the type definitions / source of the installed version
3  official docs for that exact version
4  official docs for a nearby version, with the difference noted
5  release notes and migration guides
6  everything else — blogs, answers, listicles, model memory
```

Rung 6 is never sufficient on its own for a claim that changes code.

When the docs and the repo disagree, **say so, do not modernise silently**. The repo may be
pinned for a reason, and a drive-by upgrade inside an unrelated task is scope the user did not
ask for. Put it in the brief as a finding and let the user decide. This is the rule
`pnmrvvtl-follow-project-style` applies to code style, applied to library usage.

## Phase 6 — carry it to the code, then prune

**Re-read the brief immediately before writing the code it governs.** Not once at the end of
research, not from memory of having read it. A fact read forty turns ago is sitting in the
middle of the context window, which is the position models attend to worst — and a compaction
may have dropped it entirely. The file is on disk precisely so it can be re-read cheaply.

**An Unknown that gates a line of code is a stop, not a guess.** Abstaining removes more error
per unit of effort than any other move available here. Say which question is unresolved, say
what it blocks, and ask. Guessing here spends the whole value of the phase.

**After the code is written, prune.** Every fact should be able to name the line it changed. The
ones that named nothing were curiosity, not grounding — delete them from the cached file. The
cache gets sharper each time it is used instead of accumulating.

## Trust rules

- No version number without a source.
- Anything the model "knows" without fetching is labelled `unverified` — it may guide where to
  look, never what to write.
- A blog post is evidence that someone did it, not that it is correct for this version.
- An old accepted answer describing an API that still exists is fine; one describing a
  deprecated API is a trap. Check the version, not the vote count.
- Search results that summarise other search results are not sources. Follow to the primary.
- If the library is private or internal, rungs 0 and 1 are the whole ladder. Say that instead of
  searching the public web for a name that does not exist there.

## Output

Terse. The brief is on disk; the reply is the summary of it.

```
Docs checked: <lib>@<ver>, <lib>@<ver>   (fetches <n>/6, <m> from cache)
Changes the plan: <fact> -> <what we do instead>   (or: nothing, memory was correct)
Deprecated hit: <api> since <ver> -> use <replacement>
Unknown: <question> — blocks <what>, asking before implementing
Brief: .agent/stack-brief-<task>.md
```

If nothing needed looking up, one line is the whole output:

```
Docs check skipped — repo already does this at <path:line>.
Docs check served from cache — facts-react@18.3.1.md, versions unchanged.
```
