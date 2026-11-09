# Stack brief — <task>

<YYYY-MM-DD> · fetches <n>/6, <m> from cache · rungs reached <->6
Cache: `.agent/stack-research/facts-next@14.2.35.md`, `facts-react@18.3.1.md`

## Versions

| Library | Declared | Resolved | Source |
|---|---|---|---|
| next | `^14.2.0` | `14.2.35` | `package-lock.json` |
| react | `^18.3.0` | `18.3.1` | `npm ls` |

Runtime: node 20.11.1 · tsconfig target ES2022

## Facts

Three to eight. Each changes a line of code. Each carries a version and a source.

1. **`useActionState` is not in `react@18.3.1`.** Use `useFormState` from `react-dom`.
   `node_modules/react-dom/index.d.ts:412` · `certain`
2. **`useFormStatus` is present in 18.3.1** — pending state comes from it, no `useState`.
   `node_modules/react-dom/index.d.ts:429` · `certain`
3. **Server actions are stable in `next@14.2`, no flag.** Repo already uses them at
   `app/cart/actions.ts:8` · `certain`

Confidence: `certain` (read the installed source or types) · `high` (official docs, this exact
version) · `medium` (nearby version or release notes) · `low` (single secondary source — a lead,
not a fact).

## Not applicable

One line each, **no code samples**. A snippet from a version this repo does not have is the
single most misleading thing that can sit in this file.

- `useActionState` — react 19 only. Repo is 18.3.1.

## Unknown

- <question> — blocks <what>. Ask before implementing it; do not guess.

## Verdict

One line: what the implementation does differently. Or `nothing, memory was correct` — a real
result.

---

Re-read this file immediately before writing the code it governs, not from memory of having read
it. Afterwards, delete any fact that cannot name the line it changed.
