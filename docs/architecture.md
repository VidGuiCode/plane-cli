# Architecture

## Product shape

`plane-cli` is a local client CLI. It runs on the user's machine, stores auth and context state locally, and communicates with a Plane instance over its public REST API.

It does not require:
- Direct database access
- Docker or server-side access
- A running server process of its own

## Source layout

### `src/cli.ts`

Entrypoint. Registers all command groups and applies the help formatter after all commands are added (required for recursive help formatting to work).

### `src/commands/`

User-facing command groups. Each file exports a single `create*Command()` function that builds and returns a Commander subtree.

| File | Commands |
|---|---|
| `login.ts` | `plane login` |
| `logout.ts` | `plane logout` |
| `account.ts` | `plane account list/use/show/remove` |
| `where.ts` | `plane where` |
| `members.ts` | `plane members list` |
| `workspace.ts` | `plane workspace list/use` |
| `project.ts` | `plane project list/use/show` |
| `issue.ts` | `plane issue list/get/create/update/delete/close/reopen` |
| `module.ts` | `plane module list/add/issues/remove/assign` |
| `label.ts` | `plane label list/create/delete/add/remove` |
| `comment.ts` | `plane comment list/add/delete` |
| `cycle.ts` | `plane cycle list/issues/add/remove` |
| `page.ts` | `plane page list/get` |
| `state.ts` | `plane state list` |

Command handlers stay thin — they resolve context, call core helpers, and print output. Business logic lives in `src/core/`.

### `src/core/config-store.ts`

Local config, account, and context management.

Responsibilities:
- Load and save `~/.plane-cli/config.json`
- `requireActiveAccount()` — get active account or exit with error
- `requireActiveWorkspace()` — get active workspace (checks `PLANE_WORKSPACE` env var first)
- `requireActiveProject()` — get active project or exit with error
- `createClient()` — build a `PlaneApiClient` from active account (checks `PLANE_BASE_URL` / `PLANE_API_TOKEN` env vars first)

### `src/core/api-client.ts`

Plane HTTP boundary.

Responsibilities:
- `PlaneApiClient` class — authenticated `get`, `post`, `patch`, `delete`
- `unwrap()` — normalise paginated or plain array responses
- `fetchAll()` — cursor-based pagination helper (fetches all pages)
- `PlaneApiError` — typed HTTP error

### `src/core/resolvers.ts`

Name-to-ID resolution helpers used across commands.

| Function | Resolves |
|---|---|
| `resolveProject` | project identifier/name → `{ id, identifier, name }` |
| `parseIssueRef` | string → `IssueRef` (UUID / PROJ-42 / seq number) |
| `resolveIssueRef` | issue ref + context → `{ issueId, projectId, identifier }` |
| `buildStateMap` | state array → `Map<id, name>` |
| `resolveState` | issue + state map → state name string |
| `resolveMember` | display name or email → member UUID |
| `resolveLabel` | label name or color → label UUID |
| `resolveCycle` | cycle name or UUID → `{ id, name }` |
| `resolveModule` | module name or UUID → `{ id, name }` |

### `src/core/output.ts`

Terminal output utilities.

- `printInfo` / `printError` (`✗  prefix`) / `printJson`
- `printTable(rows, headers)` — fixed-width columns with `─` separator line under headers

### `src/core/help.ts`

Custom Commander help formatter applied recursively to all commands after registration. Adds section rules (`── Commands ────`) and a trailing newline.

### `src/core/html.ts`

`stripHtml(html)` — strips HTML tags and decodes common entities. Used for rendering `description_html` and `description_html` page content in the terminal.

### `src/core/prompt.ts`

`ask(label)` — interactive readline prompt for commands that support both interactive and flag-driven input.

### `src/core/types.ts`

TypeScript interfaces for all Plane API response shapes: `PlaneAccount`, `PlaneConfig`, `PlaneWorkspace`, `PlaneProject`, `PlaneIssue`, `PlaneState`, `PlaneModule`, `PlaneLabel`, `PlaneMember`, `PlaneCycle`, `PlanePage`, `PlaneComment`.

## Auth and context model

Each saved account contains:
- A local name (used to switch accounts)
- Plane base URL and API token
- `apiStyle` — `"issues"` for self-hosted, `"work-items"` for Plane Cloud (auto-detected on login)
- Optional default workspace and project

Context (`activeProfile`, `activeWorkspace`, `activeProject`) is stored separately from accounts so switching context does not require re-authenticating.

Command precedence for workspace/project: explicit flag → active context → error.

## Environment variable overrides

`PLANE_BASE_URL`, `PLANE_API_TOKEN`, `PLANE_WORKSPACE`, and `PLANE_API_STYLE` are checked at runtime. When both URL and token are set via env, no config file is required. This enables CI and container use.
