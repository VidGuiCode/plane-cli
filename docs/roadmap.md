# Roadmap

Planned improvements and features for upcoming releases. This is a living document: items may shift between releases or be dropped based on usage and feedback.

---

## v0.2.5 *(shipped)*

### Features

- ~~**`--assignee me`**~~ - shipped: resolve the special token `me` to the current authenticated user so `plane issue list --assignee me` works without knowing your own email.
- ~~**`plane issue mine`**~~ - shipped: shortcut for listing issues assigned to the current user.
- ~~**`plane cycle current`**~~ - shipped: show the active/in-progress cycle and its issues.
- ~~**`plane issue list --updated-since <date>`**~~ - shipped: filter issues by last-updated date, useful for "what changed today" in CI and AI workflows.

### Reliability

- ~~**Post-pack release verification**~~ - shipped: install the `.tgz` into a temp directory and run smoke tests against the installed binary before publishing.

### Output Consistency

- ~~**Normalize `--json` passthrough output**~~ - shipped on `issue list`, `cycle issues`, and `module issues` to return camelCase resolved fields instead of raw API shapes.

### Error Messages

- ~~**Better diagnostics on auth failures and 404s**~~ - shipped: surface which part of resolution failed so failures are actionable.

---

## v0.2.6 *(shipped)*

### Bug Fixes

- ~~**`--no-interactive` errors on optional fields**~~ - shipped: optional fields default to empty in non-interactive mode (#8).

### Polish

- ~~**`--name` alias for `--title` on `issue update`**~~ - shipped (#9).
- ~~**`view` alias for `get`**~~ - shipped on `issue get` and `page get` (#10).
- ~~**Preserve description formatting in compact/text output**~~ - shipped: `stripHtml` preserves paragraphs, line breaks, and list structure (#11).
- ~~**Richer cycle/module detail output**~~ - shipped: progress counters, richer tables, and discovery output (#12).

---

## v0.3.0 *(shipped)*

### Features

- ~~**`plane project create`**~~ - shipped: `plane project create <name> --identifier <ID> --description "..." --network 0|2`.
- ~~**`plane project update`**~~ - shipped: update active project name, description, and network visibility.
- ~~**`plane issue move`**~~ - shipped: `plane issue move <issue> --to-project <identifier>` with copy/delete semantics; `--copy` skips delete.
- ~~**Bulk operations**~~ - shipped: `plane issue update PROJ-1,2,3 --state Done` resolves refs first, then patches in parallel.
- ~~**Multi-filter**~~ - shipped: `--state`, `--priority`, and `--assignee` accept comma-separated values on `issue list` and `issue mine`.

---

## v0.3.1 *(shipped)*

### Bug Fixes

- ~~**`--label` flag silently dropped on `issue create` / `issue update`**~~ - shipped: request bodies now send `labels` rather than `label_ids`. Same fix applied to `label add` and `label remove` (#19). See [bug-label-flag-silently-dropped.md](../context/research/lessons-learned/bug-label-flag-silently-dropped.md).

### Polish

- ~~**`--label-id <uuid>`**~~ - shipped: alternative to `--label <name>` on `issue create` and `issue update`.
- ~~**Document case-insensitive label matching in `--help`**~~ - shipped on `issue create`, `issue update`, `label add`, and `label remove`.

---

## v0.3.2 *(shipped)*

### Bug Fixes

- ~~**`--due` flag silent no-op on `issue update`**~~ - shipped: request bodies now send `target_date` rather than `due_date`. Also fixed `issue get` due-date display and the `--json` `dueDate` alias. See [bug-due-flag-silent-noop-on-update.md](../context/research/lessons-learned/bug-due-flag-silent-noop-on-update.md).

### Test Coverage

- ~~**Live round-trip test for `--due`**~~ - shipped: `tests/smoke/due-date-roundtrip.test.ts`.
- ~~**Silent-drop audit harness for remaining `issue update` flags**~~ - shipped: `tests/smoke/issue-update-audit.test.ts`.

---

## v0.4.0 *(shipped)*

### Features

- ~~**Idempotent module/cycle creation**~~ - shipped: `plane module ensure <name>` and `plane cycle ensure <name>` return existing resources by case-insensitive name or create them when missing.
- ~~**Bulk module/cycle assignment**~~ - shipped: `plane module add <issues> <module>` and `plane cycle add <issues> <cycle>` accept comma-separated issue refs.
- ~~**Page lookup improvements**~~ - shipped: `plane page search <query>` and `plane page get <page>` by UUID, exact name, or one unambiguous partial name.
- ~~**Discovery metadata for automation workflows**~~ - shipped: `discover issue-inputs` advertises ensure commands, bulk assignment, and comma-separated issue refs.

### Bug Fixes

- ~~**`cycle create` missing `project_id`**~~ - shipped: create payload now includes the resolved project ID.
- ~~**Project pages 404 compatibility**~~ - shipped: page listing now reports unsupported/API-version behavior clearly instead of a generic 404.

### Reliability

- ~~**Round-trip assertion on `issue update`**~~ - shipped: after PATCH, the CLI compares returned fields against requested fields and exits non-zero if Plane appears to have silently ignored any requested update.

---

## v0.4.1 *(shipped)*

### Bug Fixes

- ~~**Cycle membership endpoint compatibility**~~ - shipped: `cycle current`, `cycle issues`, `cycle add`, and `cycle remove` use Plane's `cycle-issues` membership endpoint. See [cycle-membership-endpoint-failures.md](../context/research/lessons-learned/cycle-membership-endpoint-failures.md).

---

## v0.4.2 *(shipped)*

Stability + clean-workflow release. Clears confirmed open bugs and the missing idempotent label command, and hardens CI / the release process.

### Bug Fixes

- ~~**Doubled identifier on `close` / `reopen` / `delete`**~~ - done: confirmation strings now print `PROJ-N` once, derived from the resolved sequence id instead of the raw argument. Reported 2026-04-02 in [ai-agent-usage-feedback.md](../context/research/lessons-learned/ai-agent-usage-feedback.md).
- ~~**`label_ids` returned label names instead of UUIDs**~~ - done: normalized `--json` output now exposes UUIDs in `label_ids` and names in `labels`.

### Features

- ~~**`plane label ensure <name> [color]`**~~ - done: idempotent label creation for agent workflows, mirroring `module ensure` / `cycle ensure`; advertised in `discover issue-inputs`.

### Workflow / Reliability

- ~~**CI runs lint + format:check**~~ - done: style/format drift is now caught on every push and PR, not only at release time.
- ~~**Smoke test reads the version from `package.json`**~~ - done: removes the hardcoded-version footgun on release.
- ~~**Automated release on tag push**~~ - done: pushing a `vX.Y.Z` tag builds, tests, verify-packs, creates the GitHub release, and uploads the `.tgz` asset automatically.
- ~~**Windows / PowerShell install docs**~~ - done: README documents the `plane.cmd` / execution-policy workaround for the blocked `plane.ps1`.

---

## v0.4.3 *(shipped)*

From the 2026-07-10 production-use gap report. See [production-use-gap-report.md](../context/research/lessons-learned/production-use-gap-report.md).

### Bug Fixes

- ~~**Ambiguous sequence refs resolve to the wrong issue**~~ - shipped: `findIssueBySeq` now aborts on duplicate `sequence_id`s, listing every candidate (UUID + state + title) and requiring a UUID instead of silently mutating the first match. Single-issue mutation confirmations also print the resolved UUID. **P1 / data-integrity.**
- ~~**Unknown `--fields` names fail silently**~~ - shipped: `issue get`/`list`/`mine` now emit a stderr warning naming unrecognized fields and listing the valid normalized names; stdout stays pure JSON.
- ~~**`members list` shows every member as "Viewer"**~~ - shipped: added a `getMemberRole` helper (nested → annotated → top-level) and render `-` when role is genuinely absent.

### Features

- ~~**`plane module update` / `plane cycle update`**~~ - shipped: full property set (`--name`, `--description`, `--status`, `--start`, `--target`/`--end`, `--lead`), with the same options added to `create` / `ensure`. Module `lead` (vs `lead_id`) is implemented against the documented name and flagged for a live check. **P1.**
- ~~**`--module` / `--cycle` on `issue create`**~~ - shipped: joins a module/cycle at creation; `--dry-run` previews the create plus each membership POST, and a post-create membership failure reports partial success with a non-zero exit and the created UUID.

### Polish

- ~~**Tracking columns in the `issue list` table**~~ - shipped: `--columns <list>` on `issue list`/`mine` (id, title, state, priority, due, start, assignee, labels, uuid, created, updated); the default table now includes `DUE`.

---

## Backlog *(planned, beyond v0.4.2)*

Deferred from field reports (see [plane-cli-roadmap-automation-feedback.md](../context/research/lessons-learned/plane-cli-roadmap-automation-feedback.md) and [production-use-gap-report.md](../context/research/lessons-learned/production-use-gap-report.md)). These are feature-sized and build on the stable, auto-released baseline:

- **`plane issue bulk-create --file <json|yaml>`** - bulk issue import with `--dry-run` / `--validate-only` preflight (reports missing labels/modules/cycles, invalid assignee/state/date) before mutating.
- **Missing-label automation** - `--create-labels`, `--ignore-missing-labels`, `--validate-only` on issue create.
- **`--description-file <path>` / stdin (`-`)** - avoid fragile heredoc quoting for long/multi-paragraph descriptions.
- **Richer machine-readable error envelope** - add `command`, `retryable`, and `suggestedFix` to `--json` error output.
- **Bulk assignment alternatives** - support `--issues` / `--cycle` flags or repeated positional refs alongside comma-separated issue refs.
- **`plane issue update --from-json <file|->`** - per-issue batch mutations with distinct values per ticket, resolving name→id maps once and reusing the session (write-side complement to `issue bulk-create`). From the 2026-07-10 report; see [production-use-gap-report.md](../context/research/lessons-learned/production-use-gap-report.md).
- **On-disk resolver cache** - cache project/state/member/label maps keyed by workspace+project, invalidated on 404/name-miss + TTL, to cut per-command latency (~5–6 s cold start today).
- **Workspace-level pages fallback + capability detection** - on project-pages 404, try the workspace-pages endpoint and advertise page capability in `discover` (the 404→friendly-message wrapper already shipped in v0.4.0).

---

Items beyond the current release are added as the project evolves. Feedback and suggestions welcome via [GitHub Issues](https://github.com/VidGuiCode/plane-cli/issues).
