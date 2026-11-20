# Roadmap

[Documentation](README.md) · [Changelog](../CHANGELOG.md) · [Share feedback](https://github.com/VidGuiCode/plane-cli/issues)

Release targets are provisional and may change with usage and feedback.

## Planned

| Target | Work | Scope |
| --- | --- | --- |
| After v0.5.0 | On-disk resolver cache | Reuse project, state, member, and label lookups across CLI runs. Design expiry, invalidation after a 404 or name miss, and an opt-out. |
| v0.6.0 | Bulk issue creation | Read JSON or YAML with `issue bulk-create --file`. Add `--dry-run` and `--validate-only` to report missing resources and invalid assignees, states, or dates before writing. |
| v0.6.0 | Missing-label handling | Add `--create-labels`, `--ignore-missing-labels`, and `--validate-only` to issue creation and bulk import, using shared preflight validation. |
| v0.6.0 | Descriptions from files | Read long descriptions from `--description-file <path>` or stdin (`-`) on issue create and update, with support for bulk specs. |

## Unscheduled

| Idea | Scope |
| --- | --- |
| Richer JSON errors | Add `command`, `retryable`, and `suggestedFix`. Coordinate the output contract with consumers. |
| Alternate bulk assignment input | Consider `--issues` or repeated positional refs for module and cycle assignment. |

## Recent milestones

| Version | Highlights |
| --- | --- |
| [v0.5.0](../CHANGELOG.md#050) | Apply distinct updates to multiple issues in one process. [Batch input and output](automation.md#update-issues-from-json) |
| [v0.4.6](../CHANGELOG.md#046) | Pass raw HTML, clear issue parents, resolve project UUIDs, and update pages with `PUT`. Includes the v0.4.5 page archive and discovery work. |
| [v0.4.4](../CHANGELOG.md#044) | Report page availability in discovery and verify module lead and member role fields against a live instance. |

## Closed decisions

**Workspace-level pages fallback.** The tested Community instance returned 404 for the versioned workspace endpoint and 401 for the web app's internal endpoint with an API key (ROADMAP-175). The CLI supports the project-pages public API where available. [Project pages](commands.md#project-pages)
