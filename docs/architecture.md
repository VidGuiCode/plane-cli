# Architecture

## Product Shape

`plane-cli` is a local client CLI. It runs on the user's machine, stores auth and context state locally, and communicates with a Plane instance over its public REST API.

It does not require:
- Direct database access
- Docker or server-side access
- A running server process of its own

## Source Layout

### `src/cli.ts`

Entrypoint. Registers all command groups and applies the help formatter after all commands are added, which is required for recursive help formatting.

### `src/commands/`

User-facing command groups. Each file exports a single `create*Command()` function that builds and returns a Commander subtree.

| File | Commands |
|---|---|
| `login.ts` | `plane login` |
| `logout.ts` | `plane logout` |
| `completion.ts` | `plane completion bash/zsh/fish` |
| `account.ts` | `plane account list/use/show/remove` |
| `where.ts` | `plane where` |
| `members.ts` | `plane members list` |
| `workspace.ts` | `plane workspace list/use` |
| `project.ts` | `plane project list/use/show/create/update` |
| `issue.ts` | `plane issue list/mine/get/create/update/move/delete/close/reopen/open` |
| `module.ts` | `plane module list/issues/create/ensure/add/remove/delete` |
| `label.ts` | `plane label list/create/delete/add/remove/update` |
| `comment.ts` | `plane comment list/add/delete/update` |
| `cycle.ts` | `plane cycle list/current/issues/create/ensure/add/remove/delete` |
| `page.ts` | `plane page list/get/search/create/update/delete` |
| `state.ts` | `plane state list` |
| `discover.ts` | `plane discover context/projects/issue-inputs/states/members/labels/cycles/modules` |
| `upgrade.ts` | `plane upgrade` |

Command handlers stay thin: they resolve context, call core helpers, and print output. Business logic lives in `src/core/`.

### `tests/`

Test suite using Vitest.

```text
core/
  api-client.test.ts      # HTTP client, retry logic, pagination
  config-store.test.ts    # Config loading/saving, env vars
  output.test.ts          # JSON/error output
  resolvers.test.ts       # Issue ref parsing, name resolution
  runtime.test.ts         # Global runtime flags
commands/
  cycle.test.ts           # Cycle create/ensure/bulk assignment
  issue.test.ts           # Issue update round-trip validation
  module.test.ts          # Module ensure/bulk assignment
smoke/
  cli-smoke.test.ts       # Version, help, command presence
  due-date-roundtrip.test.ts
  issue-update-audit.test.ts
  label-roundtrip.test.ts
```

Current suite: 83 passing tests plus 7 live tests skipped unless their environment variables are set. Run with `npm test`.

### `src/core/config-store.ts`

Local config, account, and context management.

Responsibilities:
- Load and save `~/.plane-cli/config.json`
- `requireActiveAccount()` gets active account or exits with error
- `requireActiveWorkspace()` gets active workspace, checking `PLANE_WORKSPACE` first
- `requireActiveProject()` gets active project or exits with error
- `createClient()` builds a `PlaneApiClient` from active account, checking `PLANE_BASE_URL` and `PLANE_API_TOKEN` first

### `src/core/api-client.ts`

Plane HTTP boundary.

Responsibilities:
- `PlaneApiClient` authenticated `get`, `post`, `patch`, `delete` with retry logic
- `unwrap()` normalizes paginated or plain array responses
- `fetchAll()` fetches all cursor-paginated pages
- `PlaneApiError` provides typed HTTP errors
- Retry logic uses exponential backoff on 5xx errors and respects `Retry-After` on 429 responses

### `src/core/resolvers.ts`

Name-to-ID resolution helpers used across commands.

| Function | Resolves |
|---|---|
| `resolveProject` | project identifier/name to `{ id, identifier, name }` |
| `parseIssueRef` | string to `IssueRef` (UUID / PROJ-42 / seq number) |
| `resolveIssueRef` | issue ref + context to `{ issueId, projectId, identifier }` |
| `buildStateMap` | state array to `Map<id, name>` |
| `resolveState` | issue + state map to state name string |
| `resolveMember` | display name or email to member UUID |
| `resolveLabel` | label name or color to label UUID |
| `resolveCycle` | cycle name or UUID to `{ id, name }` |
| `resolveModule` | module name or UUID to `{ id, name }` |

### `src/core/output.ts`

Terminal output utilities:
- `printInfo`
- `printError`
- `printJson`
- `printTable(rows, headers)`

### `src/core/help.ts`

Custom Commander help formatter applied recursively to all commands after registration. Adds section rules and a trailing newline.

### `src/core/html.ts`

`stripHtml(html)` strips HTML tags and decodes common entities. Used for rendering issue and page HTML content in the terminal.

### `src/core/prompt.ts`

`ask(label)` provides interactive readline prompts for commands that support both interactive and flag-driven input.

### `src/core/types.ts`

TypeScript interfaces for Plane API response shapes: `PlaneAccount`, `PlaneConfig`, `PlaneWorkspace`, `PlaneProject`, `PlaneIssue`, `PlaneState`, `PlaneModule`, `PlaneLabel`, `PlaneMember`, `PlaneCycle`, `PlanePage`, `PlaneComment`.

## Auth And Context Model

Each saved account contains:
- A local name used to switch accounts
- Plane base URL and API token
- `apiStyle`: `issues` for self-hosted or `work-items` for Plane Cloud
- Optional default workspace and project

Context (`activeProfile`, `activeWorkspace`, `activeProject`) is stored separately from accounts so switching context does not require re-authenticating.

Command precedence for workspace/project is explicit flag, then active context, then error.

## Environment Variable Overrides

`PLANE_BASE_URL`, `PLANE_API_TOKEN`, `PLANE_WORKSPACE`, `PLANE_API_STYLE`, and `PLANE_CONFIG` are checked at runtime. When both URL and token are set via env, no config file is required. This enables CI and container use.
