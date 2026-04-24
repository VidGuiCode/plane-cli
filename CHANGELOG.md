# Changelog

## 0.3.2

### Bug fixes
- Fixed `--due` flag silently dropped on `issue create`, `issue update`, and `issue move` — the request body sent `due_date: "..."` but Plane's API expects `target_date` and silently ignored the wrong key, leaving the due date unset despite the CLI printing `Updated` and exiting zero. Same class of bug as the v0.3.1 `--label` fix
- Fixed `issue get` never displaying the due date — the `Due:` line read `issue.due_date` (the wrong field) so it was always skipped
- Fixed `--json` output field `dueDate` always returning `null` — the normalizer at `resolvers.ts` was reading the wrong source field

### Testing
- Added `tests/smoke/due-date-roundtrip.test.ts` — live regression test gated on `PLANE_CLI_LIVE_TESTS=1` + `PLANE_TEST_PROJECT`, round-trips `--due` on create, update, and clear (`--due none`), mirroring the `label-roundtrip` pattern from v0.3.1
- Added `tests/smoke/issue-update-audit.test.ts` — silent-drop audit for other `issue update` flags: `--priority`, `--description`, `--assignee me`, `--state` (opt-in), `--parent` (opt-in). Guards against future field-name mismatches like the v0.3.1 / v0.3.2 bugs

## 0.3.1

### Bug fixes
- Fixed `--label` flag silently dropped on `issue create`, `issue update`, `label add`, and `label remove` — the request body sent `label_ids: [...]` but Plane's API expects `labels: [...]` and silently ignored the wrong key, leaving issues with no labels attached despite the CLI exiting zero (fixes #19)

### Features
- Added `--label-id <uuid>` on `issue create` and `issue update` as an alternative to `--label` — skips name resolution (no extra API call), and validates the UUID format up front

### Polish
- `--label` help text now says "case-insensitive" so users know they can pass `security`, `Security`, or `SECURITY` interchangeably
- `discover issue-inputs` now lists `labels` (not `label_ids`) as an optional field, matching the actual API payload key

## 0.3.0

### Features
- Added `plane project create <name> --identifier <ID> --description "..." --network 0|2` — full project CRUD from the CLI (fixes #13)
- Added `plane project update` — rename, change description, or update visibility on the active project (fixes #14)
- Added `plane issue move <issue> --to-project <identifier>` — cross-project move via copy+delete with state mapped by group; `--copy` skips the delete (fixes #15)
- Bulk operations: `plane issue update PROJ-1,2,3 --state Done` resolves all refs first, then patches in parallel (fixes #16)
- Multi-filter on `issue list` and `issue mine`: `--state`, `--priority`, and `--assignee` accept comma-separated values, applied in-memory (fixes #17)

## 0.2.6

### Bug fixes
- Fixed `issue create` and `page create` hanging in non-interactive mode when optional fields (description, content) have no default — `ask()` now receives an empty-string default so it returns immediately in non-TTY environments (fixes #8)

### Features
- Added `--name` as an alias for `--title` on `issue update` — matches the Plane API field name, useful for AI agents that discover fields via `plane discover issue-inputs` (fixes #9)
- Added `view` alias for `issue get` and `page get` — `plane issue view PROJ-42` and `plane page view <id>` now work alongside `get` (fixes #10)
- Improved `stripHtml()` to preserve paragraph breaks, line breaks, and list structure instead of collapsing everything to a single line (fixes #11)
- Richer `cycle` and `module` output: types now include progress counters (`totalIssues`, `completedIssues`, etc.), `module list` table shows NAME/STATUS/START/TARGET columns, and `discover cycles`/`discover modules` expose progress fields (fixes #12)

## 0.2.5

### Features
- Added `--assignee me` — resolves the special token `me` to the current authenticated user on `issue list`, `issue create`, and `issue update` (fixes #1)
- Added `plane issue mine` — shortcut for listing issues assigned to the current user (fixes #2)
- Added `plane cycle current` — shows the active cycle and its issues (fixes #3)
- Added `--updated-since <date>` filter on `issue list` — filters issues by last-updated date, useful for "what changed today" queries (fixes #4)
- Added post-pack release verification script (`npm run verify-pack`) — installs the `.tgz` into a temp directory and runs smoke tests before publishing (fixes #5)

### Output consistency
- `issue list --json`, `issue get --json`, `cycle issues --json`, and `module issues --json` now return normalized camelCase fields (state name, identifier string, label names) instead of raw API shapes, closing the gap between `--json` and `--json --fields` (fixes #6)

### Error messages
- API errors now include actionable hints based on HTTP status code (401→check token, 404→verify identifiers, 429→rate limited) (fixes #7)
- Resolver error messages now include more context (e.g., which workspace was searched)

## 0.2.4

### Bug fixes
- Fixed `plane issue list --fields` and `plane issue get --fields` returning empty objects `{}` for every issue — the raw Plane API fields (`id`, `name`, `priority`, `assignees`, `sequence_id`, `updated_at`, etc.) were not accessible by their exact API names because the projection only checked a curated alias map; all raw issue fields are now spread directly into the projection lookup so any field the API returns can be requested by its exact name
- Fixed `--fields` failing when the shell (e.g. PowerShell) splits a comma-separated list like `id,name,title` into separate arguments; the parser now splits on both commas and whitespace so the value is correctly reassembled regardless of how the shell passes it

## 0.2.3

### Bug fixes
- Fixed `plane issue list --fields` and `plane issue get --fields` producing empty objects `{}` when field names match the raw Plane API format — `--fields` now accepts both the normalized camelCase names and common raw API aliases: `name`→`title`, `sequence_id`→`sequence`, `state_name`/`state_id`→`state`, `project_id`→`projectId`, `updated_at`→`updatedAt`, `created_at`→`createdAt`, `due_date`→`dueDate`, `start_date`→`startDate`, `label_ids`→`labels`
- Added `projectId` as a selectable field in `--fields` output (accepts `project_id` alias)

## 0.2.2

### Bug fixes
- Fixed `plane members list` still showing blank NAME and EMAIL columns after 0.2.1 — the most common Plane API format returns members with top-level `display_name` and `email` fields (and `member` as a plain UUID string, not an object); the previous fix only handled the double-underscore annotation format and a nested `member` object, missing this third shape entirely
- Fixed `plane issue list --assignee` still failing with "Member not found" — same root cause; `getMemberDisplayName` and `getMemberEmail` now correctly extract from top-level `display_name`/`email` when `member` is a string UUID
- Fixed `getMemberId` to return the string value of `member` when it is a UUID (rather than falling back to the membership record `id`), so issue assignee filtering passes the correct user UUID to the API

## 0.2.1

### Bug fixes
- Fixed infinite pagination loop that caused `plane discover projects`, `plane issue list`, and all `plane discover` sub-commands to hang indefinitely — Plane API always returns a `next_cursor` even on the last page; the loop now correctly checks `next_page_results` to stop
- Fixed `plane issue list --assignee` crashing with `TypeError: Cannot read properties of undefined (reading 'toLowerCase')` — newer Plane instances return workspace members as a nested `member` object (`member.display_name`, `member.email`) rather than flat `member__display_name`/`member__email` fields; both formats are now handled transparently
- Fixed `plane members list` showing `undefined` for name and email columns — same nested vs flat member format issue
- Fixed `plane discover members` and `plane discover issue-inputs` emitting `undefined` for `displayName`/`email` fields — same root cause
- Fixed `plane help` failing with "too many arguments. Expected 0 arguments but got 1" — Commander.js v13 suppresses the implicit `help` subcommand when `.action()` is registered on the root command; explicitly re-enabled with `.helpCommand(true)`
- Fixed `plane profile` showing `Status: Inactive` for active users — `is_active` is not always present in the `/users/me/` response; `undefined` now defaults to Active instead of Inactive
- Fixed `plane profile` showing `Role: undefined` — `/users/me/` does not return a role (it is workspace-scoped); removed the Role line from plain-text output and from the JSON shape
- Fixed `resolveMember` returning the workspace membership UUID instead of the user UUID on newer API — `member.id` (user UUID) is now preferred over the top-level `id` (membership record UUID) for issue assignee filtering

## 0.2.0

### AI and automation
- Added `plane discover` as the canonical AI-first discovery surface
- Added `plane discover context`, `plane discover projects`, and `plane discover issue-inputs`
- Added normalized discovery commands for states, members, labels, cycles, and modules
- Added `plane profile` and normalized `plane where --json` output
- Added global `--dry-run`, `--no-interactive`, and `--compact` flags
- Added structured JSON error output for JSON-aware workflows
- Added dry-run JSON payload output for issue, comment, page, label, module, cycle, account, project, workspace, login, logout, and issue-open flows
- Added `--json` coverage to more mutating and local-context commands
- Added `--fields` support to `plane issue list` and `plane issue get` for reduced JSON payloads
- Fixed short issue reference resolution so it pages through all issues instead of stopping at 100
- Documented the AI cold-start workflow in README
- Promoted `discover` in CLI help and added a bare `plane` AI start hint

## 0.1.7

### New Commands
- `plane completion <bash|zsh|fish>` — generate shell completion scripts
- `plane issue open <ref>` — open an issue in the default browser
- `plane cycle create <name>` — create a new cycle
- `plane cycle delete <cycle>` — delete a cycle by name or UUID
- `plane module create <name>` — create a new module
- `plane module delete <module>` — delete a module by name or UUID
- `plane label update <label> --name <name> --color <color>` — update an existing label
- `plane comment update <commentId> <issue> --message <text>` — update an existing comment
- `plane page create <name>` — create a new page
- `plane page update <id>` — update an existing page
- `plane page delete <id>` — delete a page by UUID

### API & Authentication
- API style detection now tries `work-items` first, falls back to `issues`
- Added `--api-style` flag to `plane login` command for explicit control
- Added `PLANE_CONFIG` environment variable support for custom config file path

### Developer Experience
- Added ESLint + Prettier configuration for code quality
- Added unit tests for core modules using Vitest
- Added retry logic and rate limiting in API client

## 0.1.6

- Fix install on Windows: switch to GitHub release tarballs (`npm install -g https://github.com/.../releases/download/v{x}/plane-cli-{x}.tgz`); npm installs HTTPS tarballs as real directories — no junctions, no broken paths
- `plane upgrade` now installs from the GitHub release tarball for the same reason

## 0.1.5

- Fix GitHub install on Windows: npm creates a broken directory junction (not a real copy) for git dependencies that have no `prepare` script; adding a no-op `prepare` script forces npm to do a full pack-and-install, producing a real directory
- `dist/` is still committed — no build step required during install

## 0.1.4

- Fix install failure on Windows: `npm install -g github:VidGuiCode/plane-cli` was creating a broken junction to a temporary git-clone directory that npm later cleaned up; now uses tagged installs (`#v{version}`) so npm fetches a proper GitHub archive tarball instead of cloning
- `plane upgrade` now installs the exact tagged version (`github:VidGuiCode/plane-cli#v{latest}`) to benefit from the same fix

## 0.1.3

- Env var support: `PLANE_BASE_URL`, `PLANE_API_TOKEN`, `PLANE_WORKSPACE`, `PLANE_API_STYLE` — no config file needed in CI/automation
- `plane issue delete` — delete an issue by ref
- `plane issue close` / `plane issue reopen` — move to first completed/backlog state automatically
- `plane label create <name> <color>` / `plane label delete <name>` — manage labels
- `plane label add` / `plane label remove` — now accept names instead of raw UUIDs
- `plane module add <issue> <module>` — name-based, consistent with `cycle add`
- `plane comment delete <id> <issue>` — delete a comment by UUID
- Removed legacy `plane module assign` (replaced by `plane module add`)
- `plane upgrade` — check for updates and upgrade in one command
- Update hint shown on `plane` splash when a newer version is available
- Rebuilt and shipped updated `dist/`

## 0.1.2

- Fixed GitHub installs by shipping the built `dist/` output in the repository
- Removed the install-time `prepare` build hook that was failing during `npm install -g github:...`
- Included the CI workflow fix for `setup-node` cache configuration in a repo without `package-lock.json`

## 0.1.1

- Added `plane comment list <issue>` so comments can be discovered and deleted from the CLI
- Updated docs and command references to reflect the shipped command surface
- Clarified that `plane-cli` works with self-hosted Plane and Plane Cloud via personal access tokens
- Added an npm `prepare` build hook so GitHub installs produce the `plane` binary correctly

## 0.1.0

- First public release of `plane-cli`
- Interactive and non-interactive login with saved local accounts
- Active account, workspace, and project context management
- Read/write issue workflows: list, get, create, update, delete, close, reopen
- Project, workspace, members, modules, cycles, labels, comments, pages, and states commands
- Support for both self-hosted `issues` and Plane Cloud `work-items` API styles
- JSON output, table output, custom help formatting, and env var overrides for automation
