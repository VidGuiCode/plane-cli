import { Command } from "commander";
import { spawn } from "node:child_process";
import {
  loadConfig,
  createClient,
  requireActiveWorkspace,
  requireActiveProject,
  requireActiveAccount,
} from "../core/config-store.js";
import { unwrap, fetchAll } from "../core/api-client.js";
import { printInfo, printTable, printJson } from "../core/output.js";
import { ask } from "../core/prompt.js";
import { exitWithError, ValidationError } from "../core/errors.js";
import { isDryRunEnabled } from "../core/runtime.js";
import { stripHtml } from "../core/html.js";
import {
  resolveProject,
  resolveIssueRef,
  buildStateMap,
  resolveState,
  resolveMember,
  resolveLabel,
  resolveCurrentUserId,
  normalizeIssue,
  projectIssueFields,
} from "../core/resolvers.js";
import type { PlaneIssue, PlaneState } from "../core/types.js";

export function createIssueCommand(): Command {
  const command = new Command("issue")
    .description("Work with Plane issues")
    .action(() => command.help());

  // ── list ──────────────────────────────────────────────────────────────────

  command
    .command("list")
    .description("List issues in the active (or specified) project")
    .option("--workspace <slug>", "Workspace slug (overrides active context)")
    .option(
      "--project <identifier-or-name>",
      "Project identifier or name (overrides active context)",
    )
    .option("--state <name>", "Filter by state name")
    .option("--priority <value>", "Filter by priority: urgent | high | medium | low | none")
    .option("--assignee <name>", "Filter by assignee display name, email, or 'me'")
    .option("--updated-since <date>", "Filter issues updated on or after this date (YYYY-MM-DD)")
    .option("--json", "Output raw JSON")
    .option("--fields <names>", "Comma-separated fields for JSON output")
    .action(
      async (opts: {
        workspace?: string;
        project?: string;
        state?: string;
        priority?: string;
        assignee?: string;
        updatedSince?: string;
        json?: boolean;
        fields?: string;
      }) => {
        try {
          const config = loadConfig();
          const client = createClient(config);
          const ws = opts.workspace ?? requireActiveWorkspace(config);

          let projectId: string;
          let identifier: string;

          if (opts.project) {
            const proj = await resolveProject(client, ws, opts.project);
            projectId = proj.id;
            identifier = proj.identifier;
          } else {
            const active = requireActiveProject(config);
            projectId = active.id;
            identifier = active.identifier;
          }

          // Resolve assignee
          let assigneeId: string | undefined;
          if (opts.assignee) {
            assigneeId =
              opts.assignee.toLowerCase() === "me"
                ? await resolveCurrentUserId(client)
                : await resolveMember(client, ws, opts.assignee);
          }

          await listIssuesCore(client, ws, projectId, identifier, {
            state: opts.state,
            priority: opts.priority,
            assigneeId,
            updatedSince: opts.updatedSince,
            json: opts.json,
            fields: opts.fields,
          });
        } catch (err) {
          exitWithError(err, Boolean(opts.json));
        }
      },
    );

  // ── mine ─────────────────────────────────────────────────────────────────

  command
    .command("mine")
    .description("List issues assigned to you (shortcut for: issue list --assignee me)")
    .option("--workspace <slug>", "Workspace slug (overrides active context)")
    .option(
      "--project <identifier-or-name>",
      "Project identifier or name (overrides active context)",
    )
    .option("--state <name>", "Filter by state name")
    .option("--priority <value>", "Filter by priority: urgent | high | medium | low | none")
    .option("--updated-since <date>", "Filter issues updated on or after this date (YYYY-MM-DD)")
    .option("--json", "Output raw JSON")
    .option("--fields <names>", "Comma-separated fields for JSON output")
    .action(
      async (opts: {
        workspace?: string;
        project?: string;
        state?: string;
        priority?: string;
        updatedSince?: string;
        json?: boolean;
        fields?: string;
      }) => {
        try {
          const config = loadConfig();
          const client = createClient(config);
          const ws = opts.workspace ?? requireActiveWorkspace(config);

          let projectId: string;
          let identifier: string;

          if (opts.project) {
            const proj = await resolveProject(client, ws, opts.project);
            projectId = proj.id;
            identifier = proj.identifier;
          } else {
            const active = requireActiveProject(config);
            projectId = active.id;
            identifier = active.identifier;
          }

          const assigneeId = await resolveCurrentUserId(client);

          await listIssuesCore(client, ws, projectId, identifier, {
            state: opts.state,
            priority: opts.priority,
            assigneeId,
            updatedSince: opts.updatedSince,
            json: opts.json,
            fields: opts.fields,
          });
        } catch (err) {
          exitWithError(err, Boolean(opts.json));
        }
      },
    );

  // ── get ───────────────────────────────────────────────────────────────────

  command
    .command("get <issue>")
    .alias("view")
    .description(
      "Fetch a single issue. Accepts: 42 (active project), PROJ-42 (any project), or UUID",
    )
    .option("--workspace <slug>", "Workspace slug (overrides active context)")
    .option(
      "--project <identifier-or-name>",
      "Project identifier or name (overrides active context)",
    )
    .option("--json", "Output raw JSON")
    .option("--fields <names>", "Comma-separated fields for JSON output")
    .action(
      async (
        issueRef: string,
        opts: { workspace?: string; project?: string; json?: boolean; fields?: string },
      ) => {
        try {
          const config = loadConfig();
          const client = createClient(config);
          const ws = opts.workspace ?? requireActiveWorkspace(config);
          const style = client.issuesSegment();

          let activeProjectId: string | undefined;
          let activeProjectIdentifier: string | undefined;

          if (opts.project) {
            const proj = await resolveProject(client, ws, opts.project);
            activeProjectId = proj.id;
            activeProjectIdentifier = proj.identifier;
          } else if (config.context.activeProject) {
            activeProjectId = config.context.activeProject;
            activeProjectIdentifier = config.context.activeProjectIdentifier;
          }

          const { issueId, projectId, identifier } = await resolveIssueRef(
            client,
            ws,
            activeProjectId,
            activeProjectIdentifier,
            style,
            issueRef,
          );

          const [issue, stateRes] = await Promise.all([
            client.get<PlaneIssue>(`workspaces/${ws}/projects/${projectId}/${style}/${issueId}/`),
            client.get<unknown>(`workspaces/${ws}/projects/${projectId}/states/`),
          ]);
          const stateMap = buildStateMap(unwrap<PlaneState>(stateRes));

          if (opts.json) {
            const normalized = normalizeIssue(issue, stateMap, identifier, projectId);
            printJson(opts.fields ? projectIssueFields(normalized, opts.fields) : normalized);
            return;
          }

          printInfo(`${identifier}-${issue.sequence_id}  ${issue.name}`);
          printInfo(`State:       ${resolveState(issue, stateMap)}`);
          printInfo(`Priority:    ${issue.priority ?? "-"}`);

          if (issue.description_html) {
            const text = stripHtml(issue.description_html);
            printInfo(`Description: ${text || "-"}`);
          } else {
            printInfo(`Description: ${issue.description_stripped ?? "-"}`);
          }

          // Parent
          if (issue.parent) {
            printInfo(`Parent:      ${issue.parent}`);
          }

          // Assignees
          const assignees = issue.assignees ?? [];
          printInfo(`Assignees:   ${assignees.length > 0 ? assignees.join(", ") : "-"}`);

          // Labels
          const labels = issue.labels ?? [];
          const labelNames = labels.map((l) =>
            typeof l === "object" && "name" in l ? l.name : String(l),
          );
          printInfo(`Labels:      ${labelNames.length > 0 ? labelNames.join(", ") : "-"}`);

          if (issue.due_date) printInfo(`Due:         ${issue.due_date}`);
          if (issue.start_date) printInfo(`Start:       ${issue.start_date}`);
          printInfo(`Created:     ${issue.created_at}`);
          printInfo(`Updated:     ${issue.updated_at}`);
        } catch (err) {
          exitWithError(err, Boolean(opts.json));
        }
      },
    );

  // ── create ────────────────────────────────────────────────────────────────

  command
    .command("create")
    .description("Create an issue in the active (or specified) project")
    .option("--workspace <slug>", "Workspace slug (overrides active context)")
    .option(
      "--project <identifier-or-name>",
      "Project identifier or name (overrides active context)",
    )
    .option("--title <title>", "Issue title")
    .option("--description <description>", "Issue description")
    .option("--priority <priority>", "Priority: urgent | high | medium | low | none")
    .option("--assignee <name>", "Assignee display name or email (repeatable)", collect, [])
    .option("--label <name>", "Label name (repeatable)", collect, [])
    .option("--parent <ref>", "Parent issue ref (sequence number, PROJ-42, or UUID)")
    .option("--due <YYYY-MM-DD>", "Due date")
    .option("--start <YYYY-MM-DD>", "Start date")
    .option("--json", "Output raw JSON")
    .action(
      async (opts: {
        workspace?: string;
        project?: string;
        title?: string;
        description?: string;
        priority?: string;
        assignee: string[];
        label: string[];
        parent?: string;
        due?: string;
        start?: string;
        json?: boolean;
      }) => {
        try {
          const config = loadConfig();
          const client = createClient(config);
          const ws = opts.workspace ?? requireActiveWorkspace(config);
          const style = client.issuesSegment();

          let projectId: string;
          let identifier: string;

          if (opts.project) {
            const proj = await resolveProject(client, ws, opts.project);
            projectId = proj.id;
            identifier = proj.identifier;
          } else {
            const active = requireActiveProject(config);
            projectId = active.id;
            identifier = active.identifier;
          }

          const title = opts.title ?? (await ask("Title"));
          if (!title) {
            throw new ValidationError("Title is required.");
          }

          const description = opts.description ?? (await ask("Description (optional)", ""));

          const body: Record<string, unknown> = { name: title };
          if (description) body.description_html = `<p>${description}</p>`;
          if (opts.priority) body.priority = opts.priority;
          if (opts.due) body.due_date = opts.due;
          if (opts.start) body.start_date = opts.start;

          if (opts.assignee.length > 0) {
            const ids = await Promise.all(
              opts.assignee.map((a) =>
                a.toLowerCase() === "me"
                  ? resolveCurrentUserId(client)
                  : resolveMember(client, ws, a),
              ),
            );
            body.assignees = ids;
          }

          if (opts.label.length > 0) {
            const ids = await Promise.all(
              opts.label.map((l) => resolveLabel(client, ws, projectId, l)),
            );
            body.label_ids = ids;
          }

          if (opts.parent) {
            const { issueId: parentId } = await resolveIssueRef(
              client,
              ws,
              projectId,
              identifier,
              style,
              opts.parent,
            );
            body.parent = parentId;
          }

          const path = `workspaces/${ws}/projects/${projectId}/${style}/`;
          if (isDryRunEnabled()) {
            printJson({
              dryRun: true,
              method: "POST",
              path,
              body,
              context: {
                workspace: ws,
                projectId,
                projectIdentifier: identifier,
              },
            });
            return;
          }

          const issue = await client.post<PlaneIssue>(path, body);
          if (opts.json) {
            printJson(issue);
            return;
          }
          printInfo(`Created ${identifier}-${issue.sequence_id}: ${issue.name}`);
        } catch (err) {
          exitWithError(err, Boolean(opts.json));
        }
      },
    );

  // ── update ────────────────────────────────────────────────────────────────

  command
    .command("update <issue>")
    .description("Update an existing issue")
    .option("--workspace <slug>", "Workspace slug (overrides active context)")
    .option(
      "--project <identifier-or-name>",
      "Project identifier or name (overrides active context)",
    )
    .option("--title <title>", "New title")
    .option("--name <name>", "New title (alias for --title)")
    .option("--description <description>", "New description")
    .option("--priority <priority>", "Priority: urgent | high | medium | low | none")
    .option("--state <state>", "State name or ID")
    .option("--assignee <name>", "Assignee display name or email (repeatable)", collect, [])
    .option("--label <name>", "Label name — replaces existing labels (repeatable)", collect, [])
    .option("--parent <ref>", "Parent issue ref (sequence number, PROJ-42, or UUID)")
    .option("--due <YYYY-MM-DD>", "Due date (use 'none' to clear)")
    .option("--start <YYYY-MM-DD>", "Start date (use 'none' to clear)")
    .option("--json", "Output raw JSON")
    .action(
      async (
        issueRef: string,
        opts: {
          workspace?: string;
          project?: string;
          title?: string;
          name?: string;
          description?: string;
          priority?: string;
          state?: string;
          assignee: string[];
          label: string[];
          parent?: string;
          due?: string;
          start?: string;
          json?: boolean;
        },
      ) => {
        try {
          const config = loadConfig();
          const client = createClient(config);
          const ws = opts.workspace ?? requireActiveWorkspace(config);
          const style = client.issuesSegment();

          let activeProjectId: string | undefined;
          let activeProjectIdentifier: string | undefined;

          if (opts.project) {
            const proj = await resolveProject(client, ws, opts.project);
            activeProjectId = proj.id;
            activeProjectIdentifier = proj.identifier;
          } else if (config.context.activeProject) {
            activeProjectId = config.context.activeProject;
            activeProjectIdentifier = config.context.activeProjectIdentifier;
          }

          const { issueId, projectId, identifier } = await resolveIssueRef(
            client,
            ws,
            activeProjectId,
            activeProjectIdentifier,
            style,
            issueRef,
          );

          const body: Record<string, unknown> = {};
          const titleValue = opts.title ?? opts.name;
          if (titleValue) body.name = titleValue;
          if (opts.description) body.description_html = `<p>${opts.description}</p>`;
          if (opts.priority) body.priority = opts.priority;
          if (opts.due) body.due_date = opts.due === "none" ? null : opts.due;
          if (opts.start) body.start_date = opts.start === "none" ? null : opts.start;

          if (opts.state) {
            const stateRes = await client.get<unknown>(
              `workspaces/${ws}/projects/${projectId}/states/`,
            );
            const states = unwrap<PlaneState>(stateRes);
            const match = states.find(
              (s) => s.id === opts.state || s.name.toLowerCase() === opts.state!.toLowerCase(),
            );
            body.state = match ? match.id : opts.state;
          }

          if (opts.assignee.length > 0) {
            const ids = await Promise.all(
              opts.assignee.map((a) =>
                a.toLowerCase() === "me"
                  ? resolveCurrentUserId(client)
                  : resolveMember(client, ws, a),
              ),
            );
            body.assignees = ids;
          }

          if (opts.label.length > 0) {
            const ids = await Promise.all(
              opts.label.map((l) => resolveLabel(client, ws, projectId, l)),
            );
            body.label_ids = ids;
          }

          if (opts.parent) {
            const { issueId: parentId } = await resolveIssueRef(
              client,
              ws,
              projectId,
              identifier,
              style,
              opts.parent,
            );
            body.parent = parentId;
          }

          if (Object.keys(body).length === 0) {
            throw new ValidationError(
              "Nothing to update. Use --title (or --name), --description, --priority, --state, --assignee, --label, --parent, --due, or --start.",
            );
          }

          const path = `workspaces/${ws}/projects/${projectId}/${style}/${issueId}/`;
          if (isDryRunEnabled()) {
            printJson({
              dryRun: true,
              method: "PATCH",
              path,
              body,
              context: {
                workspace: ws,
                projectId,
                projectIdentifier: identifier,
                issueId,
              },
            });
            return;
          }

          const issue = await client.patch<PlaneIssue>(path, body);
          if (opts.json) {
            printJson(issue);
            return;
          }
          printInfo(`Updated ${identifier}-${issue.sequence_id}: ${issue.name}`);
        } catch (err) {
          exitWithError(err, Boolean(opts.json));
        }
      },
    );

  // ── delete ────────────────────────────────────────────────────────────────

  command
    .command("delete <issue>")
    .description("Delete an issue. Accepts: 42, PROJ-42, or UUID")
    .option("--workspace <slug>", "Workspace slug (overrides active context)")
    .option(
      "--project <identifier-or-name>",
      "Project identifier or name (overrides active context)",
    )
    .option("--json", "Output raw JSON")
    .action(
      async (issueRef: string, opts: { workspace?: string; project?: string; json?: boolean }) => {
        try {
          const config = loadConfig();
          const client = createClient(config);
          const ws = opts.workspace ?? requireActiveWorkspace(config);
          const style = client.issuesSegment();

          let activeProjectId: string | undefined;
          let activeProjectIdentifier: string | undefined;
          if (opts.project) {
            const proj = await resolveProject(client, ws, opts.project);
            activeProjectId = proj.id;
            activeProjectIdentifier = proj.identifier;
          } else if (config.context.activeProject) {
            activeProjectId = config.context.activeProject;
            activeProjectIdentifier = config.context.activeProjectIdentifier;
          }

          const { issueId, projectId, identifier } = await resolveIssueRef(
            client,
            ws,
            activeProjectId,
            activeProjectIdentifier,
            style,
            issueRef,
          );

          const path = `workspaces/${ws}/projects/${projectId}/${style}/${issueId}/`;
          if (isDryRunEnabled()) {
            printJson({
              dryRun: true,
              method: "DELETE",
              path,
              context: {
                workspace: ws,
                projectId,
                projectIdentifier: identifier,
                issueId,
              },
            });
            return;
          }

          await client.delete(path);
          if (opts.json) {
            printJson({ deleted: true, issueId, projectId, identifier });
            return;
          }
          printInfo(`Deleted ${identifier ? `${identifier}-` : ""}${issueRef}.`);
        } catch (err) {
          exitWithError(err, Boolean(opts.json));
        }
      },
    );

  // ── close ─────────────────────────────────────────────────────────────────

  command
    .command("close <issue>")
    .description("Move an issue to its first completed state")
    .option("--workspace <slug>", "Workspace slug (overrides active context)")
    .option(
      "--project <identifier-or-name>",
      "Project identifier or name (overrides active context)",
    )
    .option("--json", "Output raw JSON")
    .action(
      async (issueRef: string, opts: { workspace?: string; project?: string; json?: boolean }) => {
        try {
          const config = loadConfig();
          const client = createClient(config);
          const ws = opts.workspace ?? requireActiveWorkspace(config);
          const style = client.issuesSegment();

          let activeProjectId: string | undefined;
          let activeProjectIdentifier: string | undefined;
          if (opts.project) {
            const proj = await resolveProject(client, ws, opts.project);
            activeProjectId = proj.id;
            activeProjectIdentifier = proj.identifier;
          } else if (config.context.activeProject) {
            activeProjectId = config.context.activeProject;
            activeProjectIdentifier = config.context.activeProjectIdentifier;
          }

          const { issueId, projectId, identifier } = await resolveIssueRef(
            client,
            ws,
            activeProjectId,
            activeProjectIdentifier,
            style,
            issueRef,
          );

          const stateRes = await client.get<unknown>(
            `workspaces/${ws}/projects/${projectId}/states/`,
          );
          const states = unwrap<PlaneState>(stateRes);
          const completed = states.find((s) => s.group === "completed");
          if (!completed) throw new ValidationError("No completed state found in this project.");

          const path = `workspaces/${ws}/projects/${projectId}/${style}/${issueId}/`;
          const body = { state: completed.id };
          if (isDryRunEnabled()) {
            printJson({
              dryRun: true,
              method: "PATCH",
              path,
              body,
              context: {
                workspace: ws,
                projectId,
                projectIdentifier: identifier,
                issueId,
              },
            });
            return;
          }

          const issue = await client.patch<PlaneIssue>(path, body);
          if (opts.json) {
            printJson(issue);
            return;
          }
          printInfo(`Closed ${identifier ? `${identifier}-` : ""}${issueRef}.`);
        } catch (err) {
          exitWithError(err, Boolean(opts.json));
        }
      },
    );

  // ── reopen ────────────────────────────────────────────────────────────────

  command
    .command("reopen <issue>")
    .description("Move an issue back to its first backlog (or unstarted) state")
    .option("--workspace <slug>", "Workspace slug (overrides active context)")
    .option(
      "--project <identifier-or-name>",
      "Project identifier or name (overrides active context)",
    )
    .option("--json", "Output raw JSON")
    .action(
      async (issueRef: string, opts: { workspace?: string; project?: string; json?: boolean }) => {
        try {
          const config = loadConfig();
          const client = createClient(config);
          const ws = opts.workspace ?? requireActiveWorkspace(config);
          const style = client.issuesSegment();

          let activeProjectId: string | undefined;
          let activeProjectIdentifier: string | undefined;
          if (opts.project) {
            const proj = await resolveProject(client, ws, opts.project);
            activeProjectId = proj.id;
            activeProjectIdentifier = proj.identifier;
          } else if (config.context.activeProject) {
            activeProjectId = config.context.activeProject;
            activeProjectIdentifier = config.context.activeProjectIdentifier;
          }

          const { issueId, projectId, identifier } = await resolveIssueRef(
            client,
            ws,
            activeProjectId,
            activeProjectIdentifier,
            style,
            issueRef,
          );

          const stateRes = await client.get<unknown>(
            `workspaces/${ws}/projects/${projectId}/states/`,
          );
          const states = unwrap<PlaneState>(stateRes);
          const reopen =
            states.find((s) => s.group === "backlog") ??
            states.find((s) => s.group === "unstarted");
          if (!reopen)
            throw new ValidationError("No backlog or unstarted state found in this project.");

          const path = `workspaces/${ws}/projects/${projectId}/${style}/${issueId}/`;
          const body = { state: reopen.id };
          if (isDryRunEnabled()) {
            printJson({
              dryRun: true,
              method: "PATCH",
              path,
              body,
              context: {
                workspace: ws,
                projectId,
                projectIdentifier: identifier,
                issueId,
              },
            });
            return;
          }

          const issue = await client.patch<PlaneIssue>(path, body);
          if (opts.json) {
            printJson(issue);
            return;
          }
          printInfo(`Reopened ${identifier ? `${identifier}-` : ""}${issueRef}.`);
        } catch (err) {
          exitWithError(err, Boolean(opts.json));
        }
      },
    );

  // ── open ───────────────────────────────────────────────────────────────────

  command
    .command("open <issue>")
    .description("Open an issue in the default browser. Accepts: 42, PROJ-42, or UUID")
    .option("--workspace <slug>", "Workspace slug (overrides active context)")
    .option(
      "--project <identifier-or-name>",
      "Project identifier or name (overrides active context)",
    )
    .option("--json", "Output raw JSON")
    .action(
      async (issueRef: string, opts: { workspace?: string; project?: string; json?: boolean }) => {
        try {
          const config = loadConfig();
          const client = createClient(config);
          const ws = opts.workspace ?? requireActiveWorkspace(config);
          const style = client.issuesSegment();

          // Get baseUrl from active account for constructing the web URL
          const account = requireActiveAccount(config);
          const baseUrl = account.baseUrl.replace(/\/$/, ""); // Remove trailing slash

          let activeProjectId: string | undefined;
          let activeProjectIdentifier: string | undefined;
          if (opts.project) {
            const proj = await resolveProject(client, ws, opts.project);
            activeProjectId = proj.id;
            activeProjectIdentifier = proj.identifier;
          } else if (config.context.activeProject) {
            activeProjectId = config.context.activeProject;
            activeProjectIdentifier = config.context.activeProjectIdentifier;
          }

          const { issueId, projectId, identifier } = await resolveIssueRef(
            client,
            ws,
            activeProjectId,
            activeProjectIdentifier,
            style,
            issueRef,
          );

          // Fetch the issue to get its sequence_id for the URL
          const issue = await client.get<PlaneIssue>(
            `workspaces/${ws}/projects/${projectId}/${style}/${issueId}/`,
          );

          // Construct the Plane web URL
          // Format: {baseUrl}/{workspace}/projects/{project_identifier}/issues/{sequence_id}
          const url = `${baseUrl}/${ws}/projects/${identifier}/issues/${issue.sequence_id}`;

          // Open the URL in the default browser (cross-platform)
          const platform = process.platform;
          const command =
            platform === "darwin" ? "open" : platform === "win32" ? "start" : "xdg-open";
          const args = platform === "win32" ? ["", url] : [url]; // Windows start command needs an empty title arg

          if (isDryRunEnabled()) {
            printJson({
              dryRun: true,
              action: "issue.open",
              url,
              context: { workspace: ws, projectId, issueId, identifier },
            });
            return;
          }

          spawn(command, args, { shell: true, detached: true, stdio: "ignore" }).unref();

          if (opts.json) {
            printJson({ success: true, action: "issue.open", url, issueId, projectId, identifier });
            return;
          }

          printInfo(`Opened ${identifier}-${issue.sequence_id} in browser: ${url}`);
        } catch (err) {
          exitWithError(err, Boolean(opts.json));
        }
      },
    );

  return command;
}

function collect(value: string, previous: string[]): string[] {
  return [...previous, value];
}

async function listIssuesCore(
  client: import("../core/api-client.js").PlaneApiClient,
  ws: string,
  projectId: string,
  identifier: string,
  opts: {
    state?: string;
    priority?: string;
    assigneeId?: string;
    updatedSince?: string;
    json?: boolean;
    fields?: string;
  },
): Promise<void> {
  const style = client.issuesSegment();

  // Build filter query string
  const params = new URLSearchParams();
  if (opts.state) {
    const stateRes = await client.get<unknown>(
      `workspaces/${ws}/projects/${projectId}/states/`,
    );
    const states = unwrap<PlaneState>(stateRes);
    const match = states.find((s) => s.name.toLowerCase() === opts.state!.toLowerCase());
    if (match) params.set("state", match.id);
  }
  if (opts.priority) params.set("priority", opts.priority);
  if (opts.assigneeId) params.set("assignee", opts.assigneeId);

  const qs = params.toString();
  const basePath = `workspaces/${ws}/projects/${projectId}/${style}/${qs ? `?${qs}` : ""}`;

  const [allIssues, stateMap] = await Promise.all([
    fetchAll<PlaneIssue>(client, basePath),
    client
      .get<unknown>(`workspaces/${ws}/projects/${projectId}/states/`)
      .then((r) => buildStateMap(unwrap<PlaneState>(r))),
  ]);

  let issues = allIssues;
  if (opts.updatedSince) {
    const since = new Date(opts.updatedSince);
    if (isNaN(since.getTime())) {
      throw new ValidationError(
        `Invalid date "${opts.updatedSince}". Use YYYY-MM-DD format.`,
      );
    }
    issues = allIssues.filter((issue) => new Date(issue.updated_at) >= since);
  }

  if (issues.length === 0) {
    printInfo("No issues found.");
    return;
  }

  if (opts.json) {
    const normalized = issues.map((issue) =>
      normalizeIssue(issue, stateMap, identifier, projectId),
    );
    printJson(
      opts.fields
        ? normalized.map((n) => projectIssueFields(n, opts.fields!))
        : normalized,
    );
    return;
  }

  const rows = issues.map((issue) => [
    `${identifier}-${issue.sequence_id}`,
    issue.name,
    resolveState(issue, stateMap),
    issue.priority ?? "",
  ]);
  printTable(rows, ["ID", "TITLE", "STATE", "PRIORITY"]);
}

