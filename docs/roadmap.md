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

## v0.4.1 *(ready)*

### Bug Fixes

- ~~**Cycle membership endpoint compatibility**~~ - ready: `cycle current`, `cycle issues`, `cycle add`, and `cycle remove` use Plane's `cycle-issues` membership endpoint. See [cycle-membership-endpoint-failures.md](../context/research/lessons-learned/cycle-membership-endpoint-failures.md).

### Candidate Features

- **`plane label ensure`** - idempotent label creation for agent workflows.
- **`plane issue import`** - JSON/YAML bulk issue import with preflight validation.
- **Bulk assignment alternatives** - consider supporting `--issues` / `--cycle` flags or repeated positional refs in addition to comma-separated issue refs.

---

Items beyond v0.4.1 will be added as the project evolves. Feedback and suggestions welcome via [GitHub Issues](https://github.com/VidGuiCode/plane-cli/issues).
