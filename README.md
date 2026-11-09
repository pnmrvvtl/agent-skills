# agent-skills

Reusable agent skills for planning, implementing and verifying software changes. Each skill packages a
workflow in `SKILL.md`, with scripts, references or templates where they are useful. Examples use abstract
project names, paths, tickets and design identifiers. Public tool and API names retain their usual names.

## Skills

All skill names use the `pnmrvvtl-` namespace to avoid collisions with other collections.

| Skill | Purpose |
|---|---|
| `pnmrvvtl-inspect-before-implement` | Inspect a project and resolve ambiguity before implementation. |
| `pnmrvvtl-check-the-docs` | Check version-specific library and framework facts against current sources. |
| `pnmrvvtl-follow-project-style` | Reuse the consuming project's architecture, components and conventions. |
| `pnmrvvtl-cover-edge-cases` | Define expected behavior across missing, invalid, overflowing and failed states. |
| `pnmrvvtl-verify-for-real` | Verify behavior in the real runtime and prove the check detects a broken mechanism. |
| `pnmrvvtl-match-the-design` | Extract a design specification and measure the implementation against it. |
| `pnmrvvtl-full-cycle` | Run inspection, documentation, edge-case, implementation and verification phases. |
| `pnmrvvtl-full-cycle-from-design` | Run the complete workflow with design extraction and visual comparison. |
| `pnmrvvtl-feature-intake` | Turn feature descriptions into implementation notes, design handoffs and stories. |
| `pnmrvvtl-gated-refactor` | Deliver a large refactor in resumable phases with measured quality gates. |
| `pnmrvvtl-multi-repo-feature` | Coordinate delegated implementation across repositories using packets and a knowledge base. |
| `pnmrvvtl-branch-transfer` | Port an intended change between long-lived branches without unrelated history. |
| `pnmrvvtl-no-freeze` | Bound unattended processes with deadlines, progress checks and a completion guard. |
| `pnmrvvtl-progress-pulse` | Report counted progress and keep an append-only progress log. |
| `pnmrvvtl-sandboxed-agent` | Run delegated work in a container and return a patch for review. |
| `pnmrvvtl-security-audit` | Perform a read-only security review with validated findings and explicit coverage. |

The full-cycle skills depend on the individual skills they name. Install the full collection to use all
workflows together. For a smaller selection, include each referenced skill as well as the entrypoint.

## Install

Clone this repository from its published URL, then open the checkout. With PowerShell on Windows, or
PowerShell 7 on another platform:

```powershell
./install.ps1                                               # link all skills for Codex
./install.ps1 -Skill pnmrvvtl-check-the-docs                  # install one skill
./install.ps1 -Agent Claude                                 # select another agent
./install.ps1 -Agent Antigravity                            # always uses copies
./install.ps1 -Copy                                         # copy instead of linking
./install.ps1 -Destination <skill-directory> -Copy -WhatIf    # preview a custom destination
```

| Agent | Default destination |
|---|---|
| Codex | `~/.agents/skills` |
| Claude Code | `~/.claude/skills` |
| OpenCode | `~/.agents/skills` |
| Grok | `~/.grok/skills` |
| Antigravity | `~/.gemini/config/skills` |

The installer checks all selected destinations before creating anything and refuses to replace existing
files or folders. If a matching skill is already installed, choose a different destination or inspect and
remove that installation yourself. It never deletes an existing installation.

Links follow changes in the checkout; keep the checkout in place. Copies are snapshots. To update a copy,
review the existing installation before replacing it. If a tool does not follow links, use `-Copy`.

For Codex, you can also ask `$skill-installer` to install a skill from its published GitHub folder URL.
Without PowerShell, copy the desired complete skill folders into your agent's supported skill directory.
Codex's [official skills documentation](https://learn.chatgpt.com/docs/build-skills) explains local discovery
and installation. Other agents' discovery paths and behavior can vary by version; use `-Destination`
with the location supported by your installation.

## Use

Ask for a skill explicitly, for example:

```text
Use pnmrvvtl-inspect-before-implement to inspect this change before coding.
Use pnmrvvtl-full-cycle to implement this feature.
Use pnmrvvtl-full-cycle-from-design to implement the supplied design.
```

Skills complement the consuming project's instructions and your agent's available capabilities. They do
not grant permission to publish, commit, change accounts or run destructive actions. Replace angle-bracket
placeholders with values for the current task; template `{{TOKENS}}` are filled by the scaffold helper.
Within a skill, `scripts/`, `references/` and `assets/` refer to that skill's directory. Resolve helper
paths from its `SKILL.md` location rather than the consuming project's working directory.

## Requirements

Instruction-only workflows need a compatible agent. Bundled JavaScript helpers use Node.js; shell helpers
use Bash and their documented command-line tools. The sandbox workflow needs Docker with Linux containers
and an authenticated supported agent CLI. Browser verification needs a real browser and the target runtime.
Figma API access uses `FIGMA_TOKEN`; Context7 access optionally uses `CONTEXT7_API_KEY`. Keep credentials in
user-level environment configuration, and never commit them. The security-audit skill documents optional
scanners and records any checks that could not run.

## Validate changes

```sh
node scripts/validate.mjs
node --test tests/validate.test.mjs
```

To check installer behavior in temporary directories:

```powershell
./tests/install.tests.ps1
```

This checks collection structure, referenced skills, linked resources, JSON, and common path and credential
patterns. It does not prove a skill's behavior or recognize every identifying name. Review examples and
run relevant script checks before sharing changes. See [AGENTS.md](AGENTS.md) for contribution rules.
