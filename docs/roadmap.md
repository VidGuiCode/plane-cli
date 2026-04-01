# Roadmap

Planned improvements and features for upcoming releases. This is a living document - items may shift between releases or be dropped based on usage and feedback.

---

## v0.2.5

### Features

- **`--assignee me`** - resolve the special token `me` to the current authenticated user so `plane issue list --assignee me` works without knowing your own email
- **`plane issue mine`** - shortcut for listing issues assigned to the current user
- **`plane cycle current`** - show the active/in-progress cycle and its issues
- **`plane issue list --updated-since <date>`** - filter issues by last-updated date, useful for "what changed today" in CI and AI workflows

### Reliability

- **Post-pack release verification** - install the `.tgz` into a temp directory and run smoke tests against the installed binary before publishing, to catch version mismatches or broken dist files before they reach users

### Output consistency

- **Normalize `--json` passthrough output** on `issue list`, `cycle issues`, and `module issues` to return camelCase resolved fields (state name, identifier string) instead of raw API shapes, closing the gap between `--json` and `--json --fields`

### Error messages

- **Better diagnostics on auth failures and 404s** - surface which part of the resolution failed (workspace / project / issue number) so failures are actionable rather than cryptic

---

## v0.2.6

### Bug fixes

- **`--no-interactive` errors on optional fields** — `issue create --no-interactive` fails when optional fields like description are not provided, even though they should default to empty. Fix: default optional fields to their empty/null value in non-interactive mode instead of erroring.

### Polish

- **`--name` alias for `--title` on `issue update`** — agents reading `--json` output see the `name` field and naturally try `--name` on update. Accept `--name` as an alias for `--title`, consistent with how `--fields` already maps both.
- **`view` alias for `get`** — `plane issue view` is a common first guess; add it as an alias for `get` on issue (and other resource commands where applicable).
- **Preserve description formatting in compact/text output** — newlines and structure in issue descriptions get lost in flat text rendering. Retain line breaks so descriptions remain readable.
- **Richer cycle/module detail output** — cycle and module output is sparse compared to the Plane UI. Surface additional fields (dates, status, issue counts) already available from the API.

---

## v0.3.0

### Features

- **`plane project create`** — create projects from the CLI (`plane project create <name> --identifier <ID> --description "..." --network 0|2`). Highest-impact missing command — blocks AI agent workflows that need to set up new projects.
- **`plane project update`** — update project name, description, and settings to complete the project CRUD surface.
- **`plane issue move`** (cross-project) — move an issue to a different project (`plane issue move <issue> --to-project <identifier>`). Needs API research — if the Plane API doesn't support native moves, provide a `--copy` flag that recreates the issue in the target project.
- **Bulk operations** — update multiple issues in one call (e.g., `plane issue update ROADMAP-5,6,7 --state Done`). Accepts comma-separated issue refs and loops API calls.
- **Multi-filter** — support multiple values for filters on `issue list` (e.g., `--state Started,InReview`, combined `--state` + `--priority` + `--assignee`).

---

Items beyond v0.3.0 will be added as the project evolves. Feedback and suggestions welcome via [GitHub Issues](https://github.com/VidGuiCode/plane-cli/issues).
