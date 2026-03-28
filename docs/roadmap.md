# Roadmap

## v0.1.7 — Current Release (Complete)

### Account and auth
- `plane login` — interactive + non-interactive (`--url`/`--token` flags, `--api-style`)
- `plane logout`
- `plane completion <shell>` — shell completions for bash, zsh, fish
- `plane account list/use/show/remove`
- `plane where` — active context display

### Workspace and project
- `plane workspace list/use`
- `plane project list/use/show`
- `plane members list`

### Issues
- `plane issue list` — with `--state`, `--priority`, `--assignee` filters
- `plane issue get` — description, parent, assignees, labels, dates
- `plane issue create` — with `--assignee`, `--label`, `--parent`, `--due`, `--start`
- `plane issue update` — all fields
- `plane issue delete`
- `plane issue close` / `plane issue reopen`
- `plane issue open <ref>` — open issue URL in browser

### Modules
- `plane module list/add/issues/remove`
- `plane module create <name>` — create a new module
- `plane module delete <module>` — delete a module

### Labels
- `plane label list/create/delete/add/remove`
- `plane label update <label>` — update label name/color

### Comments
- `plane comment list/add/delete`
- `plane comment update <id> <issue>` — update an existing comment

### Cycles
- `plane cycle list/issues/add/remove`
- `plane cycle create <name>` — create a new cycle
- `plane cycle delete <cycle>` — delete a cycle

### Pages
- `plane page list/get`
- `plane page create <name>` — create a new page
- `plane page update <id>` — update an existing page
- `plane page delete <id>` — delete a page

### States
- `plane state list`

### Upgrade
- `plane upgrade` — check for updates and upgrade in one command; passive update hint on splash banner

### Infrastructure
- Cursor-based pagination on all list endpoints
- `--json` flag on all list and get commands
- `--workspace` / `--project` override flags on all commands
- Env var support: `PLANE_BASE_URL`, `PLANE_API_TOKEN`, `PLANE_WORKSPACE`, `PLANE_API_STYLE`, `PLANE_CONFIG`
- Both `issues` and `work-items` API styles supported (self-hosted + Plane Cloud)
- API style auto-detection with fallback (work-items first, issues fallback)
- Custom help formatter with section rules
- Visual table output with headers and `─` separators
- Retry logic and rate limiting (exponential backoff, respects `Retry-After`)
- ESLint + Prettier configuration
- Unit tests for core modules

---

## Potential next steps

- **Bulk operations** — `plane issue bulk-update --state closed 42,43,44`
- **`plane init`** — guided first-time setup wizard
- **Inbox/Intake** — `plane inbox list/create/delete`
- **Issue Links** — `plane issue link <from> <to> --type blocks`
- **Time Tracking** — `plane issue time add <ref> <hours>`
