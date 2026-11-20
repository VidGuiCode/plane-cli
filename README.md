# Plane CLI

```text
    ██████████
    ██████████
████    ██████
████    ██████
    ████
    ████
```

**Manage Plane work from your terminal.** List your assigned issues, update work in bulk, and automate project workflows on Plane Cloud or a self-hosted instance.

[Quick start](#quick-start) · [Commands](docs/commands.md) · [Automation](docs/automation.md) · [Roadmap](docs/roadmap.md)

**Node.js 20+** · **Windows, macOS, Linux** · **Unofficial**

## Install

Install the `plane` command from a [GitHub release](https://github.com/VidGuiCode/plane-cli/releases).

```bash
npm install -g https://github.com/VidGuiCode/plane-cli/releases/download/v0.5.0/plane-cli-0.5.0.tgz
plane --version
```

If PowerShell blocks `plane.ps1`, run `plane.cmd` instead. See [setup](docs/setup.md) for install troubleshooting, credentials, and upgrades.

## Quick start

Have your Plane instance URL and API token ready. After login, list your projects and replace `PROJ` with a project identifier from the list.

```bash
plane login
plane project list
plane project use PROJ
plane where
plane issue mine
```

The CLI saves your active account, workspace, and project for future commands. Use `plane issue get PROJ-42` to open an issue in the terminal or `plane issue create` to create one interactively.

## Everyday workflows

| To | Run |
| --- | --- |
| See your issues and their due dates | `plane issue mine --columns id,title,due` |
| See the active cycle and its issues | `plane cycle current` |
| Find a project page | `plane page search "Release plan"` |
| Get issue data as JSON | `plane issue list --json --fields identifier,title,state` |
| Preview a batch of issue updates | `plane issue update --from-json updates.json --dry-run` |

Run `plane <command> --help` for options. For batch input examples, CI configuration, and coding agent workflows, see the [automation guide](docs/automation.md).

## Project links

[Documentation](docs/README.md) · [Contributing](CONTRIBUTING.md) · [Changelog](CHANGELOG.md) · [MIT license](LICENSE)

Plane CLI is developed with AI assistance. Contributions are welcome.
