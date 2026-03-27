# Changelog

## Unreleased

- Added `plane comment list <issue>` so comments can be discovered and deleted from the CLI
- Updated docs and command references to reflect the shipped command surface
- Clarified that `plane-cli` works with self-hosted Plane and Plane Cloud via personal access tokens

## 0.1.0

- First public release of `plane-cli`
- Interactive and non-interactive login with saved local accounts
- Active account, workspace, and project context management
- Read/write issue workflows: list, get, create, update, delete, close, reopen
- Project, workspace, members, modules, cycles, labels, comments, pages, and states commands
- Support for both self-hosted `issues` and Plane Cloud `work-items` API styles
- JSON output, table output, custom help formatting, and env var overrides for automation
