# Command reference

[Documentation](README.md) · [Setup](setup.md) · [Automation](automation.md)

Run `plane --help` for the command groups or `plane issue update --help` for a command's arguments and flags.

| Group | Subcommands |
| --- | --- |
| `account` | `list`, `use`, `show`, `remove` |
| `workspace` | `list`, `use` |
| `project` | `list`, `use`, `show`, `create`, `update` |
| `issue` | `list`, `mine`, `get` (`view`), `create`, `bulk-create`, `update`, `move`, `delete`, `close`, `reopen`, `open` |
| `cycle` | `list`, `current`, `issues`, `create`, `update`, `ensure`, `add`, `remove`, `delete` |
| `module` | `list`, `issues`, `create`, `update`, `ensure`, `add`, `remove`, `delete` |
| `label` | `list`, `create`, `ensure`, `update`, `delete`, `add`, `remove` |
| `comment` | `list`, `add`, `update`, `delete` |
| `page` | `list`, `get` (`view`), `search`, `create`, `archive`, `unarchive`, `update`, `delete` |
| `state`, `members` | `list` |
| `discover` | `context`, `projects`, `issue-inputs`, `states`, `members`, `labels`, `cycles`, `modules` |

Standalone commands include `login`, `logout`, `profile`, `where`, `upgrade`, and `completion <bash|zsh|fish>`.

## Issue references and lists

Use `42` for an issue in the active project, `PROJ-42` to identify a project and sequence number, or a full issue UUID. If an imported project contains duplicate sequence numbers, use the UUID of the issue you intend to change.

Commands that support multiple issue refs accept comma-separated values. For example, `plane issue update PROJ-42,PROJ-43 --priority high` applies the same update to both issues. To apply distinct changes, use [JSON batch updates](automation.md#update-issues-from-json). `module add` and `cycle add` also accept a repeatable `--issues <refs>` option instead of the positional list: `plane module add "Website Deployment" --issues ROADMAP-157,158`.

Use `--columns` to choose table columns for `issue list` or `issue mine`. With `--json`, use `--fields` to select fields from `issue list`, `issue mine`, or `issue get`. Use `--search <query>` on `issue list` or `issue mine` to filter by keyword in the title, identifier (`PROJ-42`), or stripped description, case-insensitively. It combines with `--state`, `--priority`, `--assignee`, and `--updated-since`.

Pass `--project ALL` to `issue list` or `issue mine` to list issues across every project in the workspace in one call. All filters apply per project, and each row keeps its own `PROJ-N` identifier and `projectId`.

| JSON field | API alias |
| --- | --- |
| `projectId` | `project_id` |
| `sequence` | `sequence_id` |
| `title` | `name` |
| `state` | `state_name` (name), `state_id` (ID) |
| `labels` | `label_ids` (UUIDs) |
| `dueDate` | `target_date` |
| `startDate` | `start_date` |
| `createdAt` | `created_at` |
| `updatedAt` | `updated_at` |

Common fields also include `id`, `identifier`, `priority`, `assignees`, `parent`, and `description`.

## Rich text and parent links

Use `--description-html` for issue descriptions and `--content-html` for project pages. Each is mutually exclusive with its plain-text counterpart (`--description` or `--content`). Plane CLI sends supplied HTML as-is, and Plane may sanitize it when storing it. You can pass an empty value on update to clear the content.

```bash
plane issue create --title "Release plan" --description-html '<h2>Plan</h2><ul><li>Ship</li></ul>'
plane issue update PROJ-42 --description-html '<h2>Updated plan</h2><p>Ready</p>'
plane page create "Release plan" --content-html '<h2>Plan</h2><p>Ready</p>'
plane issue update PROJ-42 --parent none
```

Use a parent issue ref to set a parent or `none` to clear it. When passing refs on the command line, change a parent on one issue at a time.

Use `--description-file <path>` on issue creation or update to read a UTF-8 plain-text description and preserve its line breaks. Use `--description-file -` to read from stdin and pass `--title` when creating an issue this way. Choose one of `--description`, `--description-html`, `--description-file`, and `--description-markdown`.

`--description-markdown <markdown>` converts a Markdown subset (headings, lists, bold/italic, inline code, links, blockquotes, fenced code) to HTML before sending; raw HTML in the input is escaped. Use `issue get --markdown` to read a stored description back as Markdown.

```bash
plane issue create --title "Release plan" --description-file plan.txt
plane issue update PROJ-42 --description-file - < revised-plan.txt
```

`issue create --validate-only` checks issue inputs and existing resources and returns a JSON preview. A missing named label fails validation by default. Use `--create-labels` to create missing names or `--ignore-missing-labels` to skip them. The same flags apply to bulk creation. [Create issues in bulk](automation.md#create-issues-from-json-or-yaml)

## Project pages

Plane CLI uses the project-pages public API. Availability varies by Plane edition and API version. Run `plane discover context --project PROJ` and check `capabilities.pages` to see whether the list endpoint is available. The probe reports baseline operations and cannot confirm update or delete support.

`page update <page-uuid>` uses `PUT` by default. Pass `--method PATCH` for an instance that supports PATCH. The selected method appears in the dry-run preview. You can update just the name, just the body, or both. Supplying content replaces the whole body. HTTP 404 or 405 errors identify the method and path.

Use `plane page archive "Release plan"` to retire a page and `plane page unarchive "Release plan"` to restore it.
