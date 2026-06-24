# CLAUDE.md

Entry point for AI agents working on `plane-cli`. Read the canonical context before touching code.

## Start here

- **[context/docs/briefs/agent.md](context/docs/briefs/agent.md)** — full briefing: what the project is, tech stack, architecture, Plane API quirks (issues vs work-items), config storage, command-resolution rules, and the release checklist. **Read this first.**
- **[context/docs/project/current-state.md](context/docs/project/current-state.md)** — living summary of the current repo state: version, command surface, behavioral guarantees, and where planning lives.
- **[docs/roadmap.md](docs/roadmap.md)** — shipped releases and the planned backlog.
- **[CHANGELOG.md](CHANGELOG.md)** — release history.

## How work flows here

- **User reports / feedback** → capture verbatim first with the `capture-user-report` skill ([skills/capture-user-report/SKILL.md](skills/capture-user-report/SKILL.md)) into `context/research/user-reports/`, then triage to `context/research/lessons-learned/`, then (optionally) a roadmap entry. See [AGENTS.md](AGENTS.md).
- **Cutting a release** → use the `release-plane-cli` skill ([skills/release-plane-cli/SKILL.md](skills/release-plane-cli/SKILL.md)). Prepare the edits, commit, and push a `vX.Y.Z` tag; the release workflow builds, verify-packs, creates the release, and uploads the `.tgz`.
- **Context folder** → `context/` is local working memory (research, plans, references), separate from the source tree. See [context/README.md](context/README.md).

## Dev quickstart

```bash
bun install            # or: npm install
bun run typecheck
bun run lint
bun run format:check
bun run build
bun test
```

CI (`.github/workflows/ci.yml`) runs typecheck, lint, format:check, build, and test on every push and PR. Keep `src/` prettier-clean or CI fails.

## Boundaries

Commands live in `src/commands/` (thin handlers); shared logic in `src/core/`. No npm-registry publish, no standalone binaries, no server/infra management. Install is always from a GitHub release `.tgz` asset — never the bare `github:` form (broken Windows junctions).
