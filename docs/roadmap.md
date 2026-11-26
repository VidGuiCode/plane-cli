# Roadmap

[Documentation](README.md) · [Changelog](../CHANGELOG.md) · [Share feedback](https://github.com/VidGuiCode/plane-cli/issues)

Release targets are provisional and may change with usage and feedback.

## Unscheduled

| Idea | Scope |
| --- | --- |
| Richer JSON errors | Add `command`, `retryable`, and `suggestedFix`. Coordinate the output contract with consumers. |
| Alternate bulk assignment input | Consider `--issues` or repeated positional refs for module and cycle assignment. |
| Cross-project issue view | `issue list` / `issue mine` across every project in the workspace (e.g. `--project ALL`) for standup-style overviews. Single-project listing works today; requested in the 2025-06-25 field report. |
| Issue keyword search | `issue list --search <query>` (or `issue search`) so finding by keyword does not mean list-per-project plus grep. `page search` already exists; issues do not. Requested 2025-06-25. |
| Markdown descriptions | Opt-in markdown in/out for issue descriptions (send converted HTML, render stored HTML as markdown on read). Descriptions are HTML today; raw-HTML passthrough shipped in v0.4.6. Requested 2025-06-25. |

## Recent milestones

| Version | Highlights |
| --- | --- |
| [v0.6.0](../CHANGELOG.md#060) | Import issues from JSON or YAML, validate issues and handle missing labels before creation, and read descriptions from files or stdin. [Bulk creation](automation.md#create-issues-from-json-or-yaml) |
| [v0.5.1](../CHANGELOG.md#051) | Reuse resolver lookups across CLI runs, with expiry, refresh on a name miss, and an opt-out. [Resolver cache](architecture.md#resolver-cache) |
| [v0.5.0](../CHANGELOG.md#050) | Apply distinct updates to multiple issues in one process. [Batch input and output](automation.md#update-issues-from-json) |
| [v0.4.6](../CHANGELOG.md#046) | Pass raw HTML, clear issue parents, resolve project UUIDs, and update pages with `PUT`. Includes the v0.4.5 page archive and discovery work. |
| [v0.4.4](../CHANGELOG.md#044) | Report page availability in discovery and verify module lead and member role fields against a live instance. |

## Closed decisions

**Workspace-level pages fallback.** The tested Community instance returned 404 for the versioned workspace endpoint and 401 for the web app's internal endpoint with an API key (ROADMAP-175). The CLI supports the project-pages public API where available. [Project pages](commands.md#project-pages)
