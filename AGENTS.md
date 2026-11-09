# Working on agent-skills

This is a collection of reusable development skills. Each skill lives in `skills/<name>/`.

- Keep examples abstract. Use `TASK-123`, `example-app`, `<repo-path>`, `<node-id>` and similar placeholders.
- Never include real employer, customer or project names; internal domains; actual tickets; design IDs;
  user-specific paths; credentials; transcripts; or identifiable operational logs.
- Public tool, framework, package and API names are appropriate when needed to explain an integration.
- Resolve bundled scripts relative to the installed skill directory, never a particular checkout.
- Keep a skill's folder name, frontmatter name and references consistent. Include required supporting files
  and any other skills its workflow depends on.
- Preserve the consuming project's rules and the user's authorization. A skill does not grant permission
  to commit, publish, change an account, or run a destructive action.
- Before finishing, run `node scripts/validate.mjs` and the relevant script checks. Review new content for
  identifying details manually; a structural validator cannot recognize every real-world name.
- Do not run the installer against a user's existing skill directories as a test. Use a temporary destination.

No remote publication is implied by editing this repository.
