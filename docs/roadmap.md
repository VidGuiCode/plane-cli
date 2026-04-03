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

Items beyond v0.3.0 will be added as the project evolves. Feedback and suggestions welcome via [GitHub Issues](https://github.com/VidGuiCode/plane-cli/issues).
