# Architecture

[Documentation](README.md) · [Contributing](../CONTRIBUTING.md)

Plane CLI runs locally and communicates with a Plane instance over its public REST API. It stores named accounts and the active workspace and project in a local config file. CI can supply credentials and context through environment variables and flags. [Setup](setup.md) · [CI authentication](automation.md#authentication-for-ci)

## Command flow

1. [`src/cli.ts`](../src/cli.ts) registers Commander command groups, then applies the help formatter recursively.
2. A handler in [`src/commands/`](../src/commands/) reads flags, loads context, and resolves resource names or references to IDs.
3. The handler calls the API client or emits a dry-run preview for supported writes. It then formats the result for a person or a script.

## Shared modules

| Area | Responsibilities |
| --- | --- |
| [Config and accounts](../src/core/config-store.ts) | Load and save account profiles and active context. Build the client from saved credentials or environment overrides. |
| [API client](../src/core/api-client.ts) | Send authenticated requests to `/api/v1`, unwrap responses, follow cursor pagination, retry transient errors, and honor `Retry-After`. |
| [Resolvers](../src/core/resolvers.ts) | Resolve users and resources by name or ID, parse issue refs, and normalize issue results. |
| [Discovery](../src/core/discovery.ts) | Gather project metadata and probe project-page availability for automation. |
| [Issue updates](../src/core/issue-update.ts) and [batch updates](../src/core/issue-update-batch.ts) | Build update payloads and verify the API response. Batches also validate input files, reuse lookups, and report outcomes in input order. |
| [Runtime](../src/core/runtime.ts), [prompts](../src/core/prompt.ts), [output](../src/core/output.ts), and [errors](../src/core/errors.ts) | Share runtime flags, interactive input, human and JSON output, and error handling. |

## Context and compatibility

For commands that support workspace overrides, `--workspace` takes precedence over `PLANE_WORKSPACE` and then the saved workspace. Project-scoped commands that expose `--project` use it to override the saved project. A project-qualified issue ref can identify a project as part of the issue lookup.

An account stores the detected or explicitly selected issue API style (`issues` or `work-items`). Environment-only authentication uses `PLANE_API_STYLE` and defaults to `issues`. Project-page support is checked independently because it varies by edition and API version.

## Resolver cache

Saved accounts reuse project, state, member, and label lookup lists for 60 seconds. Workspace paths scope project and member lists. Project paths scope state and label lists. A hash of the effective instance URL, token, and lookup path isolates accounts without storing tokens in cache files. Files live in `resolver-cache` next to the active config file, including when `PLANE_CONFIG` overrides its location. Cached member metadata can include email addresses.

A lookup miss refreshes the list once. An API 404 invalidates lookups for the affected workspace and project, and a successful write to a lookup resource invalidates its list. Existing write requests keep their normal error handling. Cache files are replaced atomically, and failed cache reads or writes fall back to API behavior. Explicit list and discovery data reads stay live.

Use `--no-resolver-cache` to bypass the cache for a command. Environment-only authentication leaves the disk cache disabled.
