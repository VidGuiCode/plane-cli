# plane-cli

Unofficial CLI for [Plane](https://plane.so) — manage your workspace, projects, and issues from any terminal or IDE.

![Version](https://img.shields.io/badge/version-0.2.4-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Node](https://img.shields.io/badge/node-%3E%3D20-brightgreen)
![Platform](https://img.shields.io/badge/platform-windows%20%7C%20linux%20%7C%20mac-lightgrey)

Works with self-hosted Plane instances and Plane Cloud. Token-based auth — no browser session required.

---

## Install

```bash
npm install -g https://github.com/VidGuiCode/plane-cli/releases/download/v0.2.4/plane-cli-0.2.4.tgz
```

Requires Node.js 20+.

---

## Quick start

```bash
plane login                    # connect to your Plane instance
plane where                    # verify your context
plane issue list               # list issues in the active project
plane issue get PROJ-42        # fetch a single issue
plane issue create             # create a new issue interactively
```

Context (account, workspace, project) is sticky — set it once and every command uses it.

---

## Commands

| Area | Commands |
|------|----------|
| **Auth** | `login`, `logout`, `profile` |
| **Accounts** | `account list`, `use`, `show`, `remove` |
| **Context** | `where`, `workspace list/use`, `project list/use/show` |
| **Issues** | `issue list`, `get`, `create`, `update`, `delete`, `close`, `reopen`, `open` |
| **Cycles** | `cycle list`, `issues`, `create`, `add`, `remove`, `delete` |
| **Modules** | `module list`, `issues`, `create`, `add`, `remove`, `delete` |
| **Labels** | `label list`, `create`, `update`, `delete`, `add`, `remove` |
| **Comments** | `comment list`, `add`, `update`, `delete` |
| **Pages** | `page list`, `get`, `create`, `update`, `delete` |
| **States** | `state list` |
| **Discovery** | `discover context`, `projects`, `issue-inputs`, `states`, `members`, `labels`, `cycles`, `modules` |
| **Utility** | `members list`, `completion`, `upgrade` |

Issue refs are flexible: `42` (active project), `PROJ-42` (any project), or a full UUID.

Run `plane <command> --help` for full options on any command.

<details>
<summary><strong>Global flags</strong></summary>

| Flag | Purpose |
|------|---------|
| `--workspace <slug>` | Override active workspace |
| `--project <id-or-name>` | Override active project |
| `--json` | Machine-readable JSON output |
| `--compact` | Compact JSON without indentation (saves tokens) |
| `--dry-run` | Validate and resolve without sending |
| `--no-interactive` | Fail instead of prompting (auto-detected in non-TTY) |

</details>

<details>
<summary><strong>Issue field names for <code>--fields</code></strong></summary>

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

</details>

---

## Using with AI agents

Any AI agent that can run shell commands (Claude Code, Cursor, Copilot, CI scripts) can use `plane-cli` directly — no MCP server, no protocol, no setup.

### Recommended workflow

```bash
# 1. Orient
plane discover context

# 2. Learn valid inputs
plane discover issue-inputs --project <identifier>

# 3. Preview changes
plane issue create --title "Fix login bug" --dry-run --json

# 4. Apply
plane issue create --title "Fix login bug" --json
```

Use `--no-interactive` in automation. Use `--compact` to reduce token usage. When `--json` is used, errors are structured JSON on stderr.

<details>
<summary><strong>Discover schema</strong></summary>

`plane discover` commands output normalized JSON with a consistent schema:

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

Dry-run output includes `dryRun`, `method`, `path`, `body`, and `context`.

Exit codes: 0 = success, 1 = error, 2 = auth failure, 3 = validation, 4 = rate limit.

</details>

---

## Configuration

Credentials are stored in `~/.plane-cli/config.json`. Multiple accounts are supported for working with more than one Plane instance.

<details>
<summary><strong>Environment variables (CI / containers)</strong></summary>

When both `PLANE_BASE_URL` and `PLANE_API_TOKEN` are set, no config file is needed.

| Variable | Purpose |
|---|---|
| `PLANE_BASE_URL` | Plane instance URL |
| `PLANE_API_TOKEN` | API token |
| `PLANE_WORKSPACE` | Active workspace slug |
| `PLANE_API_STYLE` | `issues` or `work-items` (auto-detected on login) |
| `PLANE_CONFIG` | Path to custom config file |

</details>

---

## How this differs from other tools

- **[prime-cli](https://github.com/makeplane/prime-cli-releases)** is the official Plane tool for server operations (deploy, backup, health checks). `plane-cli` talks to the API on behalf of a user — no server admin required.
- **[Plane MCP server](https://github.com/makeplane/plane-mcp-server)** requires a running server process and an MCP-compatible client. `plane-cli` is a standalone binary — any tool that can run shell commands can use it.

---

## Development

```bash
bun install
bun run dev -- --help
bun run build
bun test
```

Tests use Vitest. See `tests/` for coverage of the HTTP client, config store, resolvers, and CLI smoke tests.

---

## Vibe coding

This project was built with AI assistance — architecture, tooling decisions, and implementation were developed through human-AI collaboration. The code works and the design is intentional, but it was not written line by line without AI involvement.

Contributions are welcome regardless of how they are written.

---

## Roadmap

See [docs/roadmap.md](docs/roadmap.md) for planned features and improvements.

---

## License

[MIT](LICENSE)
