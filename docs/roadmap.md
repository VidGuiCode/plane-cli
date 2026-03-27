# Roadmap

## v0.1.0 — Initial release (in progress)

### Account and auth
- `plane login` — interactive + non-interactive (`--url`/`--token`)
- `plane logout`
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

### Modules
- `plane module list/add/issues/remove`

### Labels
- `plane label list/create/delete/add/remove`

### Comments
- `plane comment list/add/delete`

### Cycles
- `plane cycle list/issues/add/remove`

### Pages
- `plane page list/get`

### States
- `plane state list`

### Infrastructure
- Cursor-based pagination on all list endpoints
- `--json` flag on all list and get commands
- `--workspace` / `--project` override flags on all commands
- Env var support: `PLANE_BASE_URL`, `PLANE_API_TOKEN`, `PLANE_WORKSPACE`, `PLANE_API_STYLE`
- Both `issues` and `work-items` API styles supported (self-hosted + Plane Cloud)
- Custom help formatter with section rules
- Visual table output with headers and `─` separators

---

## Potential next steps

- **Shell completions** — `plane completion bash/zsh/fish`
- **`issue open <ref>`** — open issue URL in the browser
- **`cycle create` / `cycle delete`**
- **Bulk operations**
- **`plane init`** — guided first-time setup wizard
- **Config file path override** via `PLANE_CONFIG` env var
