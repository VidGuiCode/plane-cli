# Changelog

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
- Documented the AI cold-start workflow in README and mirrored it in the `context/` notes
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
