# Setup

[Documentation](README.md) · [Commands](commands.md) · [Automation](automation.md)

## Install and upgrade

Use Node.js 20 or later with npm. The [install command](../README.md#install) installs the GitHub release tarball globally as `plane`. Run `plane upgrade` for an existing installation or reinstall using the command from the [release you want](https://github.com/VidGuiCode/plane-cli/releases).

On Linux and macOS, use a user-level Node.js installation or set npm's global prefix to a directory you own if you get a permissions error.

On Windows, npm creates both `plane.ps1` and `plane.cmd`. If PowerShell blocks scripts, run `plane.cmd where` or substitute `plane.cmd` in any example. If you prefer the PowerShell shim and your environment allows it, `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` enables local scripts for your user account.

## Connect to Plane

Run `plane login` and enter the Plane instance URL and API token when prompted. Login selects or asks for a workspace and tries to detect the instance's `work-items` or `issues` API style. You can set the style explicitly with `plane login --api-style work-items` or `plane login --api-style issues`.

| To | Run |
| --- | --- |
| Inspect the current selection | `plane where` |
| Switch accounts | `plane account list`, then `plane account use <account>` |
| Switch workspaces | `plane workspace list`, then `plane workspace use <slug>` |
| Switch projects | `plane project list`, then `plane project use <identifier>` |

`project use` accepts a project identifier, name, or UUID. For a one-off override, use `--workspace <slug>` and `--project <identifier-or-name-or-uuid>` on commands that expose those options. After changing workspaces, select a project from the new workspace.

## Store or remove credentials

Plane CLI saves accounts, API tokens, and context in `~/.plane-cli/config.json`. Keep this file private. `PLANE_CONFIG` selects a different location. In CI and containers, use [environment-based authentication](automation.md#authentication-for-ci) to run commands without saving a token with `plane login`.

Run `plane logout` to remove the active saved account or `plane logout <account>` to remove a named account. Use `npm uninstall -g plane-cli` to remove the command.
