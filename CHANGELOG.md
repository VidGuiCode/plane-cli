# Changelog

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
