# Automation

[Documentation](README.md) · [Setup](setup.md) · [Commands](commands.md)

Scripts, CI jobs, and coding agents can run the `plane` command directly.

## Discover, preview, apply

```bash
plane discover context --project PROJ
plane discover issue-inputs --project PROJ
plane issue create --project PROJ --title "Fix login bug" --no-interactive --dry-run --json
plane issue create --project PROJ --title "Fix login bug" --no-interactive --json
```

`discover` emits JSON with `schemaVersion` and `kind`. `discover context` reports the account, workspace, project, and user in `context` and reports project-page support in `capabilities.pages`. `discover issue-inputs` lists valid project inputs, such as states, labels, and members.

| Flag | Script behavior |
| --- | --- |
| `--no-interactive` | Fail when required input needs a prompt. The CLI also detects non-TTY input or output. |
| `--no-resolver-cache` | Resolve project, state, member, and label names directly against Plane for this command. |
| `--dry-run` | Resolve inputs and preview writes on commands that support it. Preview fields vary by command and can include `method`, `path`, `body`, and `context`. |
| `--json` | Request JSON on commands that expose this option. Structured command errors go to stderr. |
| `--compact` | Remove indentation from JSON output. |
| `--workspace`, `--project` | Select context explicitly on commands that expose these options. |

Exit codes are `0` for success, `1` for general errors or failed batch rows, `2` for authentication or access errors, `3` for validation or required interactive input, and `4` for rate limits.

## Authentication for CI

Set `PLANE_BASE_URL` and `PLANE_API_TOKEN` together to run without a saved account. Inject the token through your CI secret store. Set the workspace with `PLANE_WORKSPACE` or `--workspace`, then pass `--project` for project-scoped commands.

| Variable | Value |
| --- | --- |
| `PLANE_BASE_URL` | Plane instance URL |
| `PLANE_API_TOKEN` | Plane API token |
| `PLANE_WORKSPACE` | Workspace slug |
| `PLANE_API_STYLE` | `issues` (the environment-only default) or `work-items`. Match the issue endpoint your instance uses. |
| `PLANE_CONFIG` | Optional custom path for saved accounts and context |

In an environment-only session, use `plane discover context --project PROJ` to inspect your API context. `plane where` reports the saved selection.

## Update issues from JSON

Use `--from-json` when each issue needs different changes. Save a nonempty JSON array as `updates.json`.

```json
[
  { "issue": "PROJ-42", "priority": "high", "due": "2027-01-15" },
  { "issue": "PROJ-43", "title": "Review release notes", "label": ["Documentation"] }
]
```

```bash
plane issue update --from-json updates.json --dry-run
plane issue update --from-json updates.json --json
```

Pass `--from-json -` to read from stdin. Use `--workspace` and `--project` to set batch context. Supply all per-issue values in JSON because `--from-json` is mutually exclusive with a positional issue ref and individual update flags.

| Field | Value |
| --- | --- |
| `issue` | Required. One issue ref as a string, such as `"PROJ-42"`, `"42"`, or a UUID. |
| `title`, `name` | Replacement title. `title` takes precedence. |
| `description`, `descriptionHtml` | Plain text or raw HTML. Use one field and pass `""` to clear it. |
| `priority` | `urgent`, `high`, `medium`, `low`, or `none`. |
| `state` | State name or ID in the issue's project. |
| `assignee` | Array of assignee names, emails, or `me`. |
| `label`, `labelId` | Arrays of label names or UUIDs. They replace the existing labels. |
| `parent` | Parent issue ref or `none` to clear it. |
| `due`, `start` | Date in `YYYY-MM-DD` format or `none` to clear it. |

Each row needs at least one update field. Values are strings except `assignee`, `label`, and `labelId`, which take nonempty arrays of nonblank strings. An invalid input structure stops the entire batch before writes begin. If multiple rows target the same resolved issue, each of those rows fails. Other valid rows can still succeed.

With `--json`, the batch returns `updated` and `failed` counts plus `results` in input order. Each result includes `issue`, `status`, and any resolved `issueId` and `projectId`. Failed rows include `error` and cause exit code `1`. Plane CLI verifies each PATCH response, so a row can fail verification after the server applied the update. Check that issue before retrying.

Dry runs always return JSON and leave `updated` at zero. Each `planned` row includes the proposed `method`, `path`, and `body`.

## Create issues from JSON or YAML

Save a nonempty array of issue specs in a JSON or YAML file. All rows use the project selected with `--project` or the active project. Use `--file -` to read the array from stdin.

```yaml
- title: Review release notes
  descriptionFile: release-notes.txt
  state: Todo
  assignee: [me]
  label: [Documentation]
  due: 2027-01-15
- title: Verify the release build
  description: Run the smoke tests against the packaged CLI.
  priority: high
```

```bash
plane issue bulk-create --project PROJ --file issues.yaml --validate-only
plane issue bulk-create --project PROJ --file issues.yaml --create-labels --dry-run
plane issue bulk-create --project PROJ --file issues.yaml --create-labels --json
```

| Field | Value |
| --- | --- |
| `title` | Required nonblank string. |
| `description`, `descriptionHtml`, `descriptionFile` | Choose one of inline text, raw HTML, and a UTF-8 plain-text file. Relative file paths are based on the spec file's directory, or the current directory for specs from stdin. |
| `priority` | `urgent`, `high`, `medium`, `low`, or `none`. |
| `state` | State name or ID in the selected project. |
| `assignee` | Array of workspace member names, emails, or `me`. |
| `label`, `labelId` | Arrays of label names or UUIDs. |
| `parent`, `module`, `cycle` | Existing parent issue ref, module name or UUID, or cycle name or UUID. |
| `due`, `start` | Dates in `YYYY-MM-DD` format. |

Bulk creation validates all rows before writing any labels or issues. By default, missing labels fail validation. `--create-labels` creates each missing named label once per batch, and `--ignore-missing-labels` skips missing names. Explicit label UUIDs must exist. Both `--validate-only` and `--dry-run` return JSON with row results and proposed requests.

The JSON summary includes `created`, `failed`, and `results` in input order. Failed rows cause exit code `1`. If Plane rejects a write after preflight, other rows can still succeed and labels created earlier can persist. When a membership write fails after issue creation, the result is `partial` and includes the issue ID. Use the row results to identify what to retry.

## Repeatable project setup

`ensure` returns a case-insensitive name match or creates the resource if it is missing. Module and cycle assignment commands accept comma-separated issue refs.

```bash
plane label ensure "Documentation" --project PROJ --json
plane module ensure "Website Deployment" --project PROJ --json
plane module add PROJ-42,43 "Website Deployment" --project PROJ --json
plane cycle ensure "January Delivery" --project PROJ --start 2027-01-04 --end 2027-01-15 --json
plane cycle add PROJ-42,43 "January Delivery" --project PROJ --json
```
