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

## v0.2.6 *(shipped)*

### Bug fixes

- ~~**`--no-interactive` errors on optional fields**~~ — fixed: optional fields default to empty in non-interactive mode (#8)

### Polish

- ~~**`--name` alias for `--title` on `issue update`**~~ — shipped (#9)
- ~~**`view` alias for `get`**~~ — shipped on `issue get` and `page get` (#10)
- ~~**Preserve description formatting in compact/text output**~~ — shipped: `stripHtml` preserves paragraphs, line breaks, and list structure (#11)
- ~~**Richer cycle/module detail output**~~ — shipped: progress counters, richer tables and discovery output (#12)

---

## v0.3.0 *(shipped)*

### Features

- ~~**`plane project create`**~~ — shipped: `plane project create <name> --identifier <ID> --description "..." --network 0|2`
- ~~**`plane project update`**~~ — shipped: update active project name, description, and network visibility
- ~~**`plane issue move`**~~ — shipped: `plane issue move <issue> --to-project <identifier>`; uses copy+delete (state mapped by group); `--copy` skips the delete
- ~~**Bulk operations**~~ — shipped: `plane issue update PROJ-1,2,3 --state Done` resolves all refs first, then patches in parallel
- ~~**Multi-filter**~~ — shipped: `--state`, `--priority`, and `--assignee` on `issue list` and `issue mine` accept comma-separated values; filtering is applied in-memory

---

## v0.3.1 *(shipped)*

### Bug fixes

- ~~**`--label` flag silently dropped on `issue create` / `issue update`**~~ — shipped: request body now sends `labels` (not `label_ids`); the wrong key was being silently ignored by the Plane v1 issues API. Same fix applied to `label add` / `label remove` (#19). See [context/research/lessons-learned/bug-label-flag-silently-dropped.md](../context/research/lessons-learned/bug-label-flag-silently-dropped.md).

### Polish

- ~~**`--label-id <uuid>`**~~ — shipped: alternative to `--label <name>` on `issue create` / `issue update`, skips name resolution
- ~~**Document case-insensitive label matching in `--help`**~~ — shipped on `issue create`, `issue update`, `label add`, `label remove`

---

## v0.3.2 *(shipped)*

### Bug fixes

- ~~**`--due` flag silent no-op on `issue update`**~~ — shipped: request body now sends `target_date` (not `due_date`); the Plane v1 issues API silently ignored the wrong key. Same class of bug as the v0.3.1 `--label` drop. Fix applied on create, update, and move payloads. Also fixed the read/display path (`issue get` now shows the due date) and the `--json` `dueDate` alias (previously always `null`). See [context/research/lessons-learned/bug-due-flag-silent-noop-on-update.md](../context/research/lessons-learned/bug-due-flag-silent-noop-on-update.md).

### Test coverage

- ~~**Live round-trip test for `--due`**~~ — shipped: `tests/smoke/due-date-roundtrip.test.ts`, gated on `PLANE_CLI_LIVE_TESTS=1`, covers create / update / clear (`--due none`).
- ~~**Silent-drop audit harness for remaining `issue update` flags**~~ — shipped: `tests/smoke/issue-update-audit.test.ts` round-trips `--priority`, `--description`, `--assignee me`, `--state` (opt-in via `PLANE_TEST_STATE`), and `--parent` (opt-in via `PLANE_TEST_PARENT`). Same gating pattern.

### Deferred to v0.3.3

- **Round-trip assertion on `issue update`** — after the PATCH, compare the returned issue's requested fields to what was requested; exit non-zero on mismatch, at runtime (not just in tests). Deferred to avoid scope creep in the bug-fix release.

---

Items beyond v0.3.2 will be added as the project evolves. Feedback and suggestions welcome via [GitHub Issues](https://github.com/VidGuiCode/plane-cli/issues).
