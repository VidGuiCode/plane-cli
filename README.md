# plane-cli

Unofficial CLI for Plane — manage your workspace, projects, and issues from any terminal or IDE.

> Built with AI assistance (vibe coding). See [Vibe coding](#vibe-coding).

---

## What this is

`plane-cli` is an open-source command-line client for [Plane](https://plane.so). It works with self-hosted Plane instances and Plane Cloud through the public API using personal access tokens. It lets you read and write Plane data — issues, cycles, modules, pages, states, labels, comments — directly from your terminal, without opening a browser.

It is designed for two kinds of use:

- **Humans** — work with Plane from any terminal on Windows, Linux, or Mac
- **AI and automation** — any tool that can run shell commands (Claude Code, Cursor, scripts, CI pipelines) can call `plane-cli` to interact with Plane data without extra server setup

It does not use your browser login session. Authentication is token-based.

---

## What this is not

**Not a replacement for prime-cli.**
[prime-cli](https://github.com/makeplane/prime-cli-releases) is the official Plane tool for *server operations* — deploying Plane, managing Docker/Kubernetes instances, backups, health checks. `plane-cli` does none of that. It only talks to the Plane API on behalf of a user.

**Not an MCP server.**
Plane has an [official MCP server](https://github.com/makeplane/plane-mcp-server) that lets AI assistants connect to Plane as a tool provider. MCP requires a running server process and a client that speaks the MCP protocol. `plane-cli` is simpler: it is just a binary. Any AI agent that can run shell commands can use it directly from an IDE or terminal — no protocol, no server, no additional setup.

**Not the Plane web app.**
The web app is the right choice for visual workflows. `plane-cli` is optimized for scripting, automation, and keyboard-driven work.

---

## Install

Requires Node.js 20+.

```bash
npm install -g github:VidGuiCode/plane-cli#v0.1.4
```

Works on Windows, Linux, and Mac.

---

## Quick start

```bash
plane login                    # connect to your Plane instance
plane where                    # verify active account, workspace, and project
plane issue list               # list issues in the active project
plane issue create             # create a new issue interactively
```

---

## Commands

### Auth

```bash
plane login                          # connect to a Plane instance (interactive or --url/--token flags)
plane logout                         # disconnect the active account
```

### Account

```bash
plane account list                   # list saved accounts
plane account use <name>             # switch the active account
plane account show                   # show the active account details
plane account remove <name>          # remove a saved account
```

### Context

```bash
plane where                          # show active account, workspace, and project
```

### Workspace

```bash
plane workspace list                 # list available workspaces
plane workspace use <slug>           # set the active workspace
```

### Project

```bash
plane project list                   # list projects in the active workspace
plane project use <identifier>       # set the active project
plane project show                   # show active project details
```

### Members

```bash
plane members list                   # list workspace members
```

### Issues

```bash
plane issue list                     # list issues in the active project
plane issue get <ref>                # fetch a single issue (42, PROJ-42, or UUID)
plane issue create                   # create a new issue
plane issue update <ref>             # update an existing issue
plane issue delete <ref>             # delete an issue
plane issue close <ref>              # move to the first completed state
plane issue reopen <ref>             # move back to the first backlog/unstarted state
```

Issue refs are flexible: `42` (active project), `PROJ-42` (any project), or a full UUID.

`issue list` supports filters: `--state`, `--priority`, `--assignee`

`issue create` and `issue update` accept: `--title`, `--description`, `--priority`, `--state`, `--assignee`, `--label`, `--parent`, `--due`, `--start`

### Cycles

```bash
plane cycle list                     # list cycles in the active project
plane cycle issues <cycle>           # list issues in a cycle (name or UUID)
plane cycle add <issue> <cycle>      # add an issue to a cycle
plane cycle remove <issue> <cycle>   # remove an issue from a cycle
```

### Modules

```bash
plane module list                    # list modules in the active project
plane module issues <module>         # list issues in a module (name or UUID)
plane module add <issue> <module>    # add an issue to a module
plane module remove <issue> <module> # remove an issue from a module
```

### Labels

```bash
plane label list                     # list labels in the active project
plane label create <name> <color>    # create a label (color: hex e.g. #ff0000)
plane label delete <label>           # delete a label by name or UUID
plane label add <issue> <label>      # add a label to an issue
plane label remove <issue> <label>   # remove a label from an issue
```

### Comments

```bash
plane comment list <issue>           # list comments with IDs for an issue
plane comment add <issue>            # add a comment (interactive or --message)
plane comment delete <id> <issue>    # delete a comment by UUID
```

### Pages

```bash
plane page list                      # list pages in the active project
plane page get <id>                  # show a page's content
```

### States

```bash
plane state list                     # list workflow states with group and color
```

### Upgrade

```bash
plane upgrade                        # check for updates and upgrade to the latest version
```

All commands accept `--workspace <slug>` and `--project <identifier>` flags to override active context without switching permanently. Most list commands accept `--json` for raw JSON output.

---

## Using with AI agents

`plane-cli` is well suited for AI agents running inside an IDE (Claude Code, Cursor, Copilot Workspace, etc.). Because it is a plain binary, any agent that can run shell commands has full read/write access to your Plane workspace — no MCP setup, no protocol overhead.

```bash
# An agent can do things like:
plane issue list --json                        # read all issues as JSON
plane issue create --title "Fix login bug" --priority high
plane issue close PROJ-42
plane cycle issues "Sprint 3" --json
```

### CI / environment variables

For use in pipelines or containers where no config file is available:

```bash
export PLANE_BASE_URL=https://plane.example.com
export PLANE_API_TOKEN=your-token
export PLANE_WORKSPACE=your-workspace-slug

plane issue list
```

| Variable | Purpose |
|---|---|
| `PLANE_BASE_URL` | Plane instance URL |
| `PLANE_API_TOKEN` | API token |
| `PLANE_WORKSPACE` | Active workspace slug |
| `PLANE_API_STYLE` | `issues` or `work-items` (default: `issues`) |

When both `PLANE_BASE_URL` and `PLANE_API_TOKEN` are set, no config file is needed.

---

## Configuration

Credentials are stored in `~/.plane-cli/config.json`. Each account holds:

- A name (used to switch between accounts)
- Plane base URL and API token
- API style (`issues` for many self-hosted installs, `work-items` for Plane Cloud)
- Active workspace and project context

Multiple accounts are supported — useful when working with more than one Plane instance.

---

## Development

Bun is used for local development. Node.js is used for the published build.

```bash
bun install
bun run dev -- --help
bun run build
bun test
```

---

## Vibe coding

This project was built with AI assistance — architecture, tooling decisions, and implementation were developed through human-AI collaboration. The code works and the design is intentional, but it was not written line by line without AI involvement.

This is disclosed upfront so there is no confusion about how the project was built. Contributions are welcome regardless of how they are written.

---

## License

[MIT](LICENSE) — use freely, modify freely, redistribute freely.
