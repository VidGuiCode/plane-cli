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

## v0.4.4 *(shipped)* — close the v0.4.3 loop

Small, low-risk patch: settled the two verification items left open by v0.4.3 (implemented offline, never confirmed against a live instance) plus one agent-facing nicety. **Effort: S.** Both verifications were run live against a real work-items instance.

### Bug Fixes / Verification

- ~~**Confirm module `lead` and member-role field names on a live instance**~~ - shipped: live-verified against a real work-items instance. Module `lead` (not `lead_id`) is the correct write key — `PATCH { lead }` persists, `PATCH { lead_id }` is silently ignored. The workspace `members/` endpoint returns role as a top-level `role` field, which `getMemberRole` already reads. Both v0.4.3 mappings were correct; no behavior change (code comment updated to reflect live confirmation). See [production-use-gap-report.md](../context/research/lessons-learned/production-use-gap-report.md).

### Polish

- ~~**Advertise page (un)support in `discover`**~~ - shipped: `discover context` / `issue-inputs` now emit an additive `capabilities.pages` (`{ supported, reason }`) via a lightweight, non-fatal probe of the project-pages endpoint so agents skip the surface instead of probing. See [pages-support-root-cause.md](../context/research/lessons-learned/pages-support-root-cause.md).

---

## v0.4.5 *(included in v0.4.6)* — pages on commercial editions

The v0.4.5 work targeted the project-page operations documented at the time for Plane Cloud and Commercial/Airgapped self-hosted editions on the token-authenticated `/api/v1` API. These included list, create, retrieve, archive, and unarchive. The Community self-hosted instance tested during that work returned 404. Mocked-transport tests cover the documented API shapes. Live verification against a Cloud or Commercial instance is pending.

### Features

- ~~**`plane page archive <page>` / `plane page unarchive <page>`**~~ — implemented on the commercial pages API (`POST`/`DELETE …/pages/{id}/archive/`, 204 responses) and advertised in `discover` via the `operations` array.
- ~~**`page create` request body**~~ — always sends the required `description_html` field (default `<p></p>`) and accepts `--access <0|1>` (public/private).

### Error Messages

- ~~**`page update` / `page delete` diagnostics**~~ — v0.4.5 added diagnostics for 404/405 responses based on the API documentation available at the time. The v0.4.6 changes supersede that handling with documented `PUT` support and endpoint-specific diagnostics. See [makeplane/plane#8598](https://github.com/makeplane/plane/issues/8598) for the original request.

### Polish

- ~~**`capabilities.pages` reports baseline operations**~~ — `operations` lists `list`, `get`, `create`, and `archive` when the page probe succeeds and returns `[]` when support is unavailable or unknown.

---

## v0.4.6 *(shipped)* — rewrite workflow gaps

Addresses the reported rewrite workflow limitations. Plane documents `PUT` for project-page updates with optional `name` and `description_html`. Supplying content replaces the page body. [Plane API reference](https://developers.plane.so/api-reference/page/update-project-page)

### Features / Bug Fixes

- ~~**Preserve explicit rich-text input**~~ — `--description-html` on issue create/update and `--content-html` on page create/update preserve supplied HTML. Text and HTML inputs are mutually exclusive, and updates accept empty content. Regression tests check outgoing headings and lists, empty values, and ignored clears.
- ~~**Clear issue parents**~~ — `plane issue update <ref> --parent none` sends `parent: null`. Tests cover assigning and clearing parents, returned values, and the existing bulk-parent restriction.
- ~~**Project UUID references**~~ — `project use` and `--project` accept a project UUID copied from a browser URL, alongside identifier and name matching.

### Compatibility / Verification

- ~~**Page-update methods and diagnostics**~~ — the CLI defaults to `PUT` and supports explicit `--method PATCH` for compatible instances. Dry-run output and errors show the selected method. Errors also identify the endpoint and HTTP status for 404 and 405 responses. Tests cover both methods, failure handling, and the absence of automatic fallback. A live check confirmed page updates via `PUT` on one configured Plane instance.

---

## v0.5.0 *(release prep)* — batch issue updates

The 2026-07-10 gap report described a batch of roughly 60 updates exceeding a two-minute shell timeout when each issue update launched a separate process. This release handles distinct updates in one process.

### Features

- ~~**`plane issue update --from-json <file|->`**~~ — validates all input before writing, reuses lookups across rows, and reports success or failure for each issue in input order. Dry runs preview the resolved requests, and any failed row gives the command a nonzero exit status. [Batch input and output](../README.md#update-issues-from-json-v050)

---

## Resolver latency *(planned after v0.5.0)*

- **On-disk resolver cache** — share project, state, member, and label lookups across separate commands. The design needs to cover cache location, expiry, invalidation on 404 or a missing name, and a way to opt out.

---

## v0.6.0 *(planned)* — author from files

Create many issues from a spec file without pre-existing labels or fragile heredoc quoting. Builds on the v0.5.0 batch work. **Effort: L.** The preflight validation is shared across all three items.

### Features

- **`plane issue bulk-create --file <json|yaml>`** - bulk issue import with `--dry-run` / `--validate-only` preflight that reports missing labels/modules/cycles and invalid assignee/state/date before mutating.
- **Missing-label automation** - `--create-labels`, `--ignore-missing-labels`, `--validate-only` on issue create / bulk-create; shares the preflight validation.
- **`--description-file <path>` / stdin (`-`)** - long/multi-paragraph descriptions on issue create/update without heredoc quoting; also feeds bulk specs.

---

## Later *(unscheduled)*

Real but lower-impact; slot into a minor/patch when a workflow needs them.

- **Richer machine-readable error envelope** - add `command`, `retryable`, and `suggestedFix` to `--json` error output so agents can branch on failures. Output-contract change — coordinate with consumers.
- **Bulk assignment alternatives** - `--issues` / repeated positional refs alongside comma-separated refs on module/cycle add.

### Wontfix

- ~~**Workspace-level pages fallback**~~ — on the Community self-hosted instance tested for ROADMAP-175, the versioned endpoint returned 404 and the web app's internal endpoint returned 401 with an API key. The CLI's documented project-page support for Plane Cloud and Commercial is included in v0.4.6.

---

Semver: patch bumps (`0.0.1`) for fixes/polish, minor bumps (`0.1.0`) for new commands or input patterns. This is a **proposed sequence, not a commitment** — items may shift between releases or be dropped based on usage and feedback. Suggestions welcome via [GitHub Issues](https://github.com/VidGuiCode/plane-cli/issues).
