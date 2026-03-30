# plane-cli

Unofficial CLI for Plane — manage your workspace, projects, and issues from any terminal or IDE.

> Built with AI assistance (vibe coding). See [Vibe coding](#vibe-coding).

---

## What this is

`plane-cli` is an open-source command-line client for [Plane](https://plane.so). It works with self-hosted Plane instances and Plane Cloud through the public API using personal access tokens. It lets you read and write Plane data — issues, cycles, modules, pages, states, labels, comments — directly from your terminal, without opening a browser.

It is designed for two kinds of use:

- **Humans** — work with Plane from any terminal on Windows, Linux, or Mac
- **AI and automation** — any tool that can run shell commands (Claude Code, Cursor, scripts, CI pipelines) can call `plane-cli` to interact with Plane data without extra server setup

It does not use your browser login session. Authentication is token-based.

---

## What this is not

**Not a replacement for prime-cli.**
[prime-cli](https://github.com/makeplane/prime-cli-releases) is the official Plane tool for *server operations* — deploying Plane, managing Docker/Kubernetes instances, backups, health checks. `plane-cli` does none of that. It only talks to the Plane API on behalf of a user.

**Not an MCP server.**
Plane has an [official MCP server](https://github.com/makeplane/plane-mcp-server) that lets AI assistants connect to Plane as a tool provider. MCP requires a running server process and a client that speaks the MCP protocol. `plane-cli` is simpler: it is just a binary. Any AI agent that can run shell commands can use it directly from an IDE or terminal — no protocol, no server, no additional setup.

**Not the Plane web app.**
The web app is the right choice for visual workflows. `plane-cli` is optimized for scripting, automation, and keyboard-driven work.

---

## Install

Requires Node.js 20+.

```bash
npm install -g https://github.com/VidGuiCode/plane-cli/releases/download/v0.2.3/plane-cli-0.2.3.tgz
```

Works on Windows, Linux, and Mac.

---

## Quick start

```bash
plane login                    # connect to your Plane instance
plane where                    # verify active account, workspace, and project
plane issue list               # list issues in the active project
plane issue create             # create a new issue interactively
```

---

## AI Start

If you're a cold-start AI, use this path:

```bash
# 1. Context
plane discover context

# 2. Inputs
plane discover issue-inputs --project <identifier-or-name>

# 3. Preview
plane issue update <ref> --state Done --dry-run
plane issue create --title "Test" --dry-run

# 4. Apply
plane issue update <ref> --state Done --json
plane issue create --title "Test" --json
```

**Rules:**
- Start with `plane discover`
- Dry-run writes first
- Use `--no-interactive` in automation
- Use `--compact` for smaller JSON
- Use `--json` for structured errors

---

## Commands

### Auth

```bash
plane login                          # connect to a Plane instance (interactive or --url/--token flags)
plane completion <shell>             # generate shell completion script (bash, zsh, or fish)
plane logout                         # disconnect the active account
plane profile                        # show the current authenticated user
```

### Account

```bash
plane account list                   # list saved accounts
plane account use <name>             # switch the active account
plane account show                   # show the active account details
plane account remove <name>          # remove a saved account
```

### Context

```bash
plane where                          # show active account, workspace, and project
plane discover context               # machine-readable account/workspace/project/user context
```

### Workspace

```bash
plane workspace list                 # list available workspaces
plane workspace use <slug>           # set the active workspace
```

### Project

```bash
plane project list                   # list projects in the active workspace
plane project use <identifier-or-name> # set the active project
plane project show                   # show active project details
```

### Members

```bash
plane members list                   # list workspace members
```

### Issues

```bash
plane issue list                     # list issues in the active project
plane issue get <ref>                # fetch a single issue (42, PROJ-42, or UUID)
plane issue create                   # create a new issue
plane issue update <ref>             # update an existing issue
plane issue delete <ref>             # delete an issue
plane issue close <ref>              # move to the first completed state
plane issue reopen <ref>             # move back to the first backlog/unstarted state
plane issue open <ref>               # open an issue in the default browser
```

Issue refs are flexible: `42` (active project), `PROJ-42` (any project), or a full UUID.

`issue list` supports filters: `--state`, `--priority`, `--assignee`

`issue list` and `issue get` support `--fields <names>` with `--json` for reduced payloads. Both normalized names and raw API names are accepted:

| Normalized | Raw API alias(es) |
|---|---|
| `id` | — |
| `projectId` | `project_id` |
| `identifier` | — |
| `sequence` | `sequence_id` |
| `title` | `name` |
| `state` | `state_name`, `state_id` |
| `priority` | — |
| `assignees` | — |
| `labels` | `label_ids` |
| `parent` | — |
| `dueDate` | `due_date` |
| `startDate` | `start_date` |
| `createdAt` | `created_at` |
| `updatedAt` | `updated_at` |
| `description` | — |

`issue create` accepts: `--title`, `--description`, `--priority`, `--assignee`, `--label`, `--parent`, `--due`, `--start`

`issue update` accepts: `--title`, `--description`, `--priority`, `--state`, `--assignee`, `--label`, `--parent`, `--due`, `--start`

### Cycles

```bash
plane cycle list                     # list cycles in the active project
plane cycle issues <cycle>           # list issues in a cycle (name or UUID)
plane cycle add <issue> <cycle>      # add an issue to a cycle
plane cycle remove <issue> <cycle>   # remove an issue from a cycle
plane cycle create <name>            # create a new cycle
plane cycle delete <cycle>           # delete a cycle by name or UUID
```

### Modules

```bash
plane module list                    # list modules in the active project
plane module issues <module>         # list issues in a module (name or UUID)
plane module add <issue> <module>    # add an issue to a module
plane module remove <issue> <module> # remove an issue from a module
plane module create <name>           # create a new module
plane module delete <module>         # delete a module by name or UUID
```

### Labels

```bash
plane label list                     # list labels in the active project
plane label create <name> <color>    # create a label (color: hex e.g. #ff0000)
plane label delete <label>           # delete a label by name or UUID
plane label add <issue> <label>      # add a label to an issue
plane label remove <issue> <label>   # remove a label from an issue
plane label update <label>           # update a label (--name, --color)
```

### Comments

```bash
plane comment list <issue>           # list comments with IDs for an issue
plane comment add <issue>            # add a comment (interactive or --message)
plane comment update <id> <issue>    # update a comment (--message)
plane comment delete <id> <issue>    # delete a comment by UUID
```

### Pages

```bash
plane page list                      # list pages in the active project
plane page get <id>                  # show a page's content
plane page create <name>             # create a new page
plane page update <id>               # update an existing page
plane page delete <id>               # delete a page by UUID
```

### States

```bash
plane state list                     # list workflow states with group and color
```

### Discover

```bash
plane discover context               # normalized account/workspace/project/user snapshot
plane discover projects              # normalized project metadata for active workspace
plane discover issue-inputs          # states, members, labels, cycles, modules, priorities
plane discover states                # normalized states for a project
plane discover members               # normalized members for a workspace
plane discover labels                # normalized labels for a project
plane discover cycles                # normalized cycles for a project
plane discover modules               # normalized modules for a project
```

### Upgrade

```bash
plane upgrade                        # check for updates and upgrade to the latest version
```

Most commands accept `--workspace <slug>` and `--project <identifier-or-name>` flags to override active context. Most list and mutation commands accept `--json` for machine-readable output.

Global AI/automation flags:

- `--dry-run` — validate and resolve a mutating command without sending it
- `--no-interactive` — fail instead of prompting for missing input
- `--compact` — output compact JSON without indentation (saves tokens for AI)

---

## Using with AI agents

`plane-cli` is well suited for AI agents running inside an IDE (Claude Code, Cursor, Copilot Workspace, etc.). Because it is a plain binary, any agent that can run shell commands has full read/write access to your Plane workspace — no MCP setup, no protocol overhead.

### AI-first model

The recommended flow is:

1. Discover context with `plane discover context`
2. Discover valid inputs with `plane discover issue-inputs --project <identifier-or-name>`
3. Preview changes with `--dry-run`
4. Apply changes with `--json`

Prefer `plane discover` over `where` and `profile` for new automation. `where --json` and `profile --json` remain normalized compatibility views.

```bash
# An agent can do things like:
plane discover context                         # machine-readable context (always JSON)
plane discover issue-inputs --project <identifier-or-name>     # fetch all mutation selectors

plane issue list --json                        # read issues as JSON
plane issue list --json --fields id,title,state # compact JSON for large lists

plane issue get PROJ-42 --json --fields id,title,state,labels

plane issue update PROJ-42 --state Done --dry-run --json  # preview before applying
plane issue create --title "Fix login bug" --dry-run --json
plane issue create --title "Fix login bug" --json

plane workspace use marketing --dry-run --json
plane project use CYL --dry-run --json

plane cycle issues "Sprint 3" --json
```

### Normalized JSON schema

`plane discover` commands always output normalized JSON with a consistent schema:

```json
{
  "schemaVersion": 1,
  "kind": "context",
  "context": {
    "account": { "name": "...", "baseUrl": "...", "apiStyle": "..." },
    "workspace": { "slug": "..." },
    "project": { "id": "...", "identifier": "...", "name": "..." },
    "user": { "id": "...", "displayName": "...", "email": "..." }
  }
}
```

`plane where --json` and `plane profile --json` also follow this normalized schema (use these for compatibility, but prefer `plane discover` for new AI agents).

### Safe mutation workflow

Follow this pattern to avoid accidents:

1. **Discover** — get context and valid inputs
   ```bash
   plane discover issue-inputs --project <identifier-or-name>
   ```

2. **Preview** — validate with `--dry-run`
   ```bash
   plane issue create --title "Test" --dry-run --json
   ```

3. **Execute** — remove `--dry-run` when ready
   ```bash
   plane issue create --title "Test" --json
   ```

4. **Recover** — handle errors
   - When `--json` is used, errors are structured JSON on stderr
   - Check exit codes: 0=success, 1=error, 2=auth, 3=validation, 4=rate limit

### CI / environment variables

For use in pipelines or containers where no config file is available:

```bash
export PLANE_BASE_URL=https://plane.example.com
export PLANE_API_TOKEN=your-token
export PLANE_WORKSPACE=your-workspace-slug

plane issue list
```

| Variable | Purpose |
|---|---|
| `PLANE_BASE_URL` | Plane instance URL |
| `PLANE_API_TOKEN` | API token |
| `PLANE_WORKSPACE` | Active workspace slug |
| `PLANE_API_STYLE` | `issues` or `work-items` (auto-detected) |
| `PLANE_CONFIG` | Path to custom config file |

When both `PLANE_BASE_URL` and `PLANE_API_TOKEN` are set, no config file is needed.

When `--json` is used, API failures are emitted as structured JSON on stderr so agents can recover programmatically.

### JSON schema notes

- `plane discover ...` always emits normalized JSON with `schemaVersion` and `kind`
- `plane where --json` and `plane profile --json` mirror the normalized discovery shape for compatibility
- `--compact` removes indentation from JSON output to reduce token usage
- Dry-run output always includes `dryRun`, `method`, `path`, `body`, and `context`

---

## Configuration

Credentials are stored in `~/.plane-cli/config.json`. Each account holds:

- A name (used to switch between accounts)
- Plane base URL and API token
- API style (`issues` for many self-hosted installs, `work-items` for Plane Cloud)
- Active workspace and project context

Multiple accounts are supported — useful when working with more than one Plane instance.

---

## Development

Bun is used for local development. Node.js is used for the published build.

```bash
bun install
bun run dev -- --help
bun run build
bun test
```

### Testing

The project includes 72 tests covering core functionality:

```
tests/
├── core/
│   ├── api-client.test.ts      # HTTP client, retry logic, pagination
│   ├── config-store.test.ts    # Config loading/saving, env vars
│   └── resolvers.test.ts       # Issue ref parsing, name resolution
└── smoke/
    └── cli-smoke.test.ts       # CLI version, help, command presence
```

Run tests with `npm test` (uses Vitest).

---

## Vibe coding

This project was built with AI assistance — architecture, tooling decisions, and implementation were developed through human-AI collaboration. The code works and the design is intentional, but it was not written line by line without AI involvement.

This is disclosed upfront so there is no confusion about how the project was built. Contributions are welcome regardless of how they are written.

---

## License

[MIT](LICENSE) — use freely, modify freely, redistribute freely.
