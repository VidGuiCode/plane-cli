# Project Context

## Origin

This project started from active operational use of Plane for Cylro work management.

The immediate pain point was that repeated Plane work through raw HTTP requests is workable, but not a good long-term interface for:

- repeated issue cleanup
- roadmap maintenance
- labels and module assignments
- AI-assisted workflows
- partner/team reuse

The conclusion was that a dedicated CLI is worth building if it becomes a real reusable tool instead of a one-off internal script.

## Why This Exists

The CLI is intended to provide a stable command surface for Plane so both humans and AI workflows can use the same predictable interface.

Target use cases:

- personal use by the project owner
- independent use by a partner with their own token
- reusable automation and AI skills
- readable, context-aware issue and roadmap operations
- local-machine usage without direct SSH dependency for normal Plane data operations

## AI-First Release Direction

The v0.2.0 direction is to make the CLI obvious for a cold-start AI with no repo history.

See also: `context/docs/project/v0.2.0-ai-first-release-notes.md`

Preferred agent flow:

1. Inspect context with `plane discover context`
2. Fetch selectors with `plane discover issue-inputs --project <identifier-or-name>`
3. Preview writes with `--dry-run`
4. Apply writes with `--json`

Canonical AI-facing command surface:

- `plane discover context`
- `plane discover projects`
- `plane discover issue-inputs`
- `plane discover states`
- `plane discover members`
- `plane discover labels`
- `plane discover cycles`
- `plane discover modules`
- `plane where --json` (compatibility)
- `plane profile --json` (compatibility)

Output policy:

- discovery commands are normalized JSON
- `--compact` reduces token usage
- `--dry-run` always emits the request preview
- `--json` emits machine-readable success and error output

## Key Product Decisions

- This should be its own open-source project, not a subfolder inside Cylro.
- The repository name should be obvious and non-clever: `plane-cli`.
- It should be publishable and installable by other users.
- It should be explicitly positioned as an unofficial CLI for Plane.
- It should support multiple user accounts with separate tokens.
- It should support active context switching similar in spirit to cloud CLIs.

## Positioning

**Not** prime-cli — that is the official Plane tool for server operations (Docker, Kubernetes, backups).
**Not** an MCP server — MCP requires a running server process and a protocol-aware client.
**The gap it fills:** a plain binary that humans and AI agents can call from a terminal or IDE to read and write Plane data without any additional server setup.

## Context Model

Context layers:

- active account (saved credentials)
- active workspace
- active project

Command style:

```bash
plane login
plane account use <name>
plane workspace use <workspace>
plane project use <project>
plane issue list
```

The preferred mental model is:

- `account` for saved credentials
- `workspace` for Plane workspace context
- `project` for active project context

Avoid using cloud terms like `subscription` because they do not map cleanly to Plane.

## Architecture Direction

- API-driven client only
- no direct database access
- no server-only assumptions
- local config/context per user
- stable command verbs that AI skills can rely on

The CLI should wrap Plane's API, not try to replace it.

## Naming / Positioning

- GitHub repository folder: `plane-cli`
- Product positioning: `Unofficial CLI for Plane`

Avoid cute or invented names. The project should be obvious, searchable, and easy to understand immediately.

## Splash / Header

```text
        ██████████
        ██████████   plane-cli
    ████    ██████   Unofficial CLI for Plane
    ████    ██████   v{version}
        ████
        ████
```

Guidelines:

- Keep the icon compact and readable in normal terminal widths.
- Text starts on line 2, aligned top-right of the icon.
- Use `Unofficial CLI for Plane` as the positioning copy.
- Avoid anything that looks like an official Plane first-party splash screen.

## Non-Goals

- Not a Cylro-only wrapper
- Not an infrastructure admin tool for Docker or server management
- Not a direct DB manipulation tool
- Not a giant framework before real command usefulness exists

## v0.1.0 Command Surface (implemented)

```bash
plane login / logout
plane account list/use/show/remove
plane where
plane workspace list/use
plane project list/use/show
plane members list
plane issue list/get/create/update/delete/close/reopen
plane module list/add/issues/remove
plane label list/create/delete/add/remove
plane comment list/add/delete
plane cycle list/issues/add/remove
plane page list/get
plane state list
plane upgrade
```

## Versioning note

`plane-cli` is now on the `0.2.x` line for the AI-first release series.

Use patch bumps for smaller follow-up releases:
- packaging or install fixes
- doc cleanup
- CI fixes
- non-breaking command polish

Use `0.3.0` or later only for a breaking command-surface change.
