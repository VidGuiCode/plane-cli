# Roadmap

Planned improvements and features for upcoming releases. This is a living document — items may shift between releases or be dropped based on usage and feedback.

---

## v0.2.5

### Features

- **`--assignee me`** — resolve the special token `me` to the current authenticated user so `plane issue list --assignee me` works without knowing your own email
- **`plane issue mine`** — shortcut for listing issues assigned to the current user
- **`plane cycle current`** — show the active/in-progress cycle and its issues
- **`plane issue list --updated-since <date>`** — filter issues by last-updated date, useful for "what changed today" in CI and AI workflows

### Reliability

- **Post-pack release verification** — install the `.tgz` into a temp directory and run smoke tests against the installed binary before publishing, to catch version mismatches or broken dist files before they reach users

### Output consistency

- **Normalize `--json` passthrough output** on `issue list`, `cycle issues`, and `module issues` to return camelCase resolved fields (state name, identifier string) instead of raw API shapes, closing the gap between `--json` and `--json --fields`

### Error messages

- **Better diagnostics on auth failures and 404s** — surface which part of the resolution failed (workspace / project / issue number) so failures are actionable rather than cryptic

---

Items beyond v0.2.5 will be added as the project evolves. Feedback and suggestions welcome via [GitHub Issues](https://github.com/VidGuiCode/plane-cli/issues).
