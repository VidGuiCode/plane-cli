# Context

Local working context for this repository.

This directory is intentionally separate from the main source tree. Use it for local reference material, scratch research, and non-source assets that help during development.

## Structure

- `assets/` - local images, logos, icons, and branding references
- `docs/briefs/` - agent or contributor briefings
- `docs/project/` - project notes, product decisions, and planning context
- `docs/reference/` - captured external references such as API notes
- `research/ai-dumps/` - raw AI-generated notes or copied working dumps
- `research/lessons-learned/` - retrospective notes and learnings
- `research/web-search/` - saved search notes and external findings

## Notes

- Keep secrets, tokens, profiles, and machine-specific state out of committed source files.
- Treat this folder as working context, not as the canonical home for production code or end-user docs.
- For the current AI-first release work, start with `docs/briefs/agent.md`, `docs/project/project-context.md`, and `docs/project/v0.2.0-ai-first-release-notes.md`.
