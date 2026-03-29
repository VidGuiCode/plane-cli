# Agent Briefing — plane-cli

This file is the full context briefing for any AI agent working on this project.
Read this before touching any code.

---

## What this project is

`plane-cli` is an unofficial, open-source command-line client for Plane.
It is written in TypeScript, distributed via GitHub Releases (not the npm registry), and installable with:

```bash
npm install -g https://github.com/VidGuiCode/plane-cli/releases/download/v0.2.0/plane-cli-0.2.0.tgz
```

It works on Windows (PowerShell), Linux, and Mac — any terminal with Node.js installed.

**Important:** Do NOT use `npm install -g github:VidGuiCode/plane-cli` (without a tarball URL). On Windows, npm creates a broken directory junction for git-based installs. Always install from a GitHub release `.tgz` asset.

**Positioning:** sits between an MCP server and the Plane web app. Any tool that can run shell commands — including AI agents running inside an IDE — can use it to read and write Plane data without setting up a protocol server.

**Not** prime-cli (that manages Plane server infrastructure). **Not** an MCP server. **Not** a replacement for any official Plane tool.

GitHub: https://github.com/VidGuiCode/plane-cli

---

## Current state

**v0.2.0 AI-first work is the active release focus.**
All commands are working. No stubs. No `notImplemented()` calls.

### Current AI-first entrypoints

- `plane discover context`
- `plane discover issue-inputs --project <identifier-or-name>`
- `plane issue list --json --fields ...`
- `plane issue create/update ... --dry-run --json`
- `plane where --json` and `plane profile --json` for compatibility
- Bare `plane` hints at `plane discover context`

---

## Tech stack

| Concern | Tool |
|---|---|
| Language | TypeScript |
| CLI framework | Commander.js |
| Dev runtime | Bun (fast, native TS) |
| Release build | tsc (so users only need Node.js) |
| HTTP | Native `fetch` (Node 18+, no extra deps) |
| Test | Vitest |
| Distribution | GitHub Releases `.tgz` tarball — `npm install -g https://github.com/.../releases/download/v{x}/plane-cli-{x}.tgz` |

**No standalone binaries. No npm registry publishing. No heavy dependencies.**

### Testing

Tests live in `tests/` and use Vitest:

```
tests/
├── core/
│   ├── api-client.test.ts      # HTTP client, retry logic, pagination
│   ├── config-store.test.ts    # Config loading/saving, env vars
│   └── resolvers.test.ts       # Issue ref parsing, name resolution
└── smoke/
    └── cli-smoke.test.ts       # CLI version, help, command presence
```

Total: 66 tests. Run with `npm test`.

---

## Architecture

```
src/cli.ts                   ← entrypoint, registers all commands
src/commands/                ← thin command handlers only
  login.ts                   ← plane login
  logout.ts                  ← plane logout
  completion.ts              ← plane completion bash/zsh/fish
  account.ts                 ← plane account list/use/show/remove
  where.ts                   ← plane where
  members.ts                 ← plane members list
  workspace.ts               ← plane workspace list/use
  project.ts                 ← plane project list/use/show
  issue.ts                   ← plane issue list/get/create/update/delete/close/reopen/open
  module.ts                  ← plane module list/add/issues/remove/create/delete
  label.ts                   ← plane label list/create/delete/add/remove/update
  comment.ts                 ← plane comment list/add/delete/update
  cycle.ts                   ← plane cycle list/issues/add/remove/create/delete
  page.ts                    ← plane page list/get/create/update/delete
  state.ts                   ← plane state list
  discover.ts                ← plane discover context/projects/issue-inputs/...
  profile.ts                 ← plane profile
  upgrade.ts                 ← plane upgrade (version check + self-update)
src/core/                    ← all real logic lives here
  config-store.ts            ← read/write ~/.plane-cli/config.json, env var overrides
  api-client.ts              ← all HTTP calls to Plane API, fetchAll pagination
  resolvers.ts               ← name-to-ID resolution (project, issue ref, member, label, cycle, module)
  output.ts                  ← printInfo, printError, printTable, printJson
  help.ts                    ← custom Commander help formatter, applied recursively
  html.ts                    ← stripHtml for description_html fields
  prompt.ts                  ← ask() for interactive input
  discovery.ts               ← normalized discovery payload helpers
  errors.ts                  ← structured error handling / exit codes
  runtime.ts                 ← dry-run / no-interactive / compact flags
  types.ts                   ← all API response types
```

Commands stay thin. They resolve context, call core helpers, and print output.

---

## Types (src/core/types.ts)

```typescript
interface PlaneAccount {
  name: string;
  baseUrl: string;
  token: string;
  apiStyle: "issues" | "work-items";  // auto-detected at login
  defaultWorkspace?: string;
  defaultProject?: string;
}

// Backward-compat alias (JSON on disk still uses profiles[])
type PlaneProfile = PlaneAccount;

interface PlaneContext {
  activeProfile?: string;
  activeWorkspace?: string;
  activeProject?: string;
  activeProjectIdentifier?: string;
}

interface PlaneConfig {
  profiles: PlaneAccount[];
  context: PlaneContext;
}
```

---

## Config storage

- Path: `~/.plane-cli/config.json`
- Format: `PlaneConfig` JSON — `profiles[]` + `context` keys (JSON keys unchanged for backward compat)
- `loadConfig()` / `saveConfig()` fully implemented in `config-store.ts`

### Environment variable overrides

Checked at runtime, override config values:

| Variable | Purpose |
|---|---|
| `PLANE_BASE_URL` | Plane instance URL |
| `PLANE_API_TOKEN` | API token |
| `PLANE_WORKSPACE` | Active workspace slug |
| `PLANE_API_STYLE` | `issues` or `work-items` (auto-detected at login) |
| `PLANE_CONFIG` | Path to custom config file |

When both `PLANE_BASE_URL` and `PLANE_API_TOKEN` are set, no config file is needed (pure CI use).

---

## Plane API

Base URL for self-hosted: the user's own domain (e.g. `https://notes.cylro.com`)
Auth header: `X-API-Key: <token>`
All responses: JSON
Rate limit: 60 req/min

### Critical: API style difference

Self-hosted community edition uses `/issues/` in paths.
Plane cloud uses `/work-items/` in paths.

```
Self-hosted:  GET /api/v1/workspaces/{slug}/projects/{id}/issues/
Cloud:        GET /api/v1/workspaces/{slug}/projects/{id}/work-items/
```

The `apiStyle` field in `PlaneAccount` handles this. Detected automatically at login by probing the instance.
`PlaneApiClient.issuesSegment()` returns the correct path segment. Commands never reference `issues` or `work-items` directly.

### Key endpoints

Full reference: `context/docs/reference/plane-api-reference.md`

---

## plane login — implemented flow

1. Prompt: base URL (e.g. `https://notes.cylro.com`)
2. Prompt: API token
3. Call `GET /api/v1/workspaces/` — discover workspaces automatically
4. If 1 workspace → use it automatically
5. If multiple → show picker
6. Detect `apiStyle` by probing work-items first (modern), fallback to issues (legacy)
7. Use workspace slug as account name (prompt only if name already taken)
8. Write account to `~/.plane-cli/config.json`

Non-interactive mode available: `plane login --url <url> --token <token>`

### AI-safe workflow

1. `plane discover context`
2. `plane discover issue-inputs --project <identifier-or-name>`
3. `plane issue ... --dry-run --json`
4. `plane issue ... --json`

---

## Release strategy

**v0.1.x is the active release line.**

Small fixes, packaging fixes, doc corrections, CI cleanup, and other non-breaking improvements can keep shipping as `0.1.x` for as long as needed.

Examples:
- `0.1.1` - install/package fix
- `0.1.2` - distribution or CI fix
- `0.1.81` - still valid if the project is still in the same release phase

Only bump beyond `0.1.x` when the product has materially changed enough to justify a new minor version.

---

## Non-goals

- No direct database access
- No Docker or server infrastructure management
- No Cylro-specific hardcoding
- No giant framework — minimum complexity for what exists
- No standalone binaries
- No npm registry publishing

---

## Command resolution rules

Commands prefer **explicit flags first**, then **active context**.

Example: `plane issue list` uses active project from context.
`plane issue list --project CYL` overrides context without changing it permanently.

All commands accept `--workspace <slug>` and `--project <identifier>` override flags.

---

## Issue refs

Issue arguments accept three formats throughout the CLI:
- `42` — sequence number (requires active project)
- `PROJ-42` — project identifier + sequence number (works anywhere)
- UUID — direct issue ID

---

## Output conventions

- Default: human-readable tables with column headers and `─` separators
- `--json` flag available on all list and get commands for machine-readable output
- Errors go to stderr with `✗  ` prefix
- `printError` takes a single string argument

---

## Splash banner

```text
        ██████████
        ██████████   plane-cli
    ████    ██████   Unofficial CLI for Plane
    ████    ██████   v{version}
        ████
        ████
```

Rules:
- Use the compact block icon only, not the official Plane wordmark
- Keep `Unofficial CLI for Plane` visible
- Text starts on line 2, aligned with the top-right of the icon



