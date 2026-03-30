import { Command } from "commander";
import { spawn } from "node:child_process";
import { loadConfig, createClient, requireActiveWorkspace, requireActiveProject, requireActiveAccount, } from "../core/config-store.js";
import { unwrap, fetchAll } from "../core/api-client.js";
import { printInfo, printTable, printJson } from "../core/output.js";
import { ask } from "../core/prompt.js";
import { exitWithError, ValidationError } from "../core/errors.js";
import { isDryRunEnabled } from "../core/runtime.js";
import { stripHtml } from "../core/html.js";
import { resolveProject, resolveIssueRef, buildStateMap, resolveState, resolveMember, resolveLabel, } from "../core/resolvers.js";
export function createIssueCommand() {
    const command = new Command("issue")
        .description("Work with Plane issues")
        .action(() => command.help());
    // ── list ──────────────────────────────────────────────────────────────────
    command
        .command("list")
        .description("List issues in the active (or specified) project")
        .option("--workspace <slug>", "Workspace slug (overrides active context)")
        .option("--project <identifier-or-name>", "Project identifier or name (overrides active context)")
        .option("--state <name>", "Filter by state name")
        .option("--priority <value>", "Filter by priority: urgent | high | medium | low | none")
        .option("--assignee <name>", "Filter by assignee display name or email")
        .option("--json", "Output raw JSON")
        .option("--fields <names>", "Comma-separated fields for JSON output")
        .action(async (opts) => {
        try {
            const config = loadConfig();
            const client = createClient(config);
            const ws = opts.workspace ?? requireActiveWorkspace(config);
            const style = client.issuesSegment();
            let projectId;
            let identifier;
            if (opts.project) {
                const proj = await resolveProject(client, ws, opts.project);
                projectId = proj.id;
                identifier = proj.identifier;
            }
            else {
                const active = requireActiveProject(config);
                projectId = active.id;
                identifier = active.identifier;
            }
            // Build filter query string
            const params = new URLSearchParams();
            if (opts.state) {
                const stateRes = await client.get(`workspaces/${ws}/projects/${projectId}/states/`);
                const states = unwrap(stateRes);
                const match = states.find((s) => s.name.toLowerCase() === opts.state.toLowerCase());
                if (match)
                    params.set("state", match.id);
            }
            if (opts.priority)
                params.set("priority", opts.priority);
            if (opts.assignee) {
                const memberId = await resolveMember(client, ws, opts.assignee);
                params.set("assignee", memberId);
            }
            const qs = params.toString();
            const basePath = `workspaces/${ws}/projects/${projectId}/${style}/${qs ? `?${qs}` : ""}`;
            const [issues, stateMap] = await Promise.all([
                fetchAll(client, basePath),
                client
                    .get(`workspaces/${ws}/projects/${projectId}/states/`)
                    .then((r) => buildStateMap(unwrap(r))),
            ]);
            if (issues.length === 0) {
                printInfo("No issues found.");
                return;
            }
            if (opts.json) {
                const fields = opts.fields;
                const projected = fields
                    ? issues.map((issue) => projectIssue(issue, stateMap, identifier, fields, projectId))
                    : issues;
                printJson(projected);
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
        catch (err) {
            exitWithError(err, Boolean(opts.json));
        }
    });
    // ── get ───────────────────────────────────────────────────────────────────
    command
        .command("get <issue>")
        .description("Fetch a single issue. Accepts: 42 (active project), PROJ-42 (any project), or UUID")
        .option("--workspace <slug>", "Workspace slug (overrides active context)")
        .option("--project <identifier-or-name>", "Project identifier or name (overrides active context)")
        .option("--json", "Output raw JSON")
        .option("--fields <names>", "Comma-separated fields for JSON output")
        .action(async (issueRef, opts) => {
        try {
            const config = loadConfig();
            const client = createClient(config);
            const ws = opts.workspace ?? requireActiveWorkspace(config);
            const style = client.issuesSegment();
            let activeProjectId;
            let activeProjectIdentifier;
            if (opts.project) {
                const proj = await resolveProject(client, ws, opts.project);
                activeProjectId = proj.id;
                activeProjectIdentifier = proj.identifier;
            }
            else if (config.context.activeProject) {
                activeProjectId = config.context.activeProject;
                activeProjectIdentifier = config.context.activeProjectIdentifier;
            }
            const { issueId, projectId, identifier } = await resolveIssueRef(client, ws, activeProjectId, activeProjectIdentifier, style, issueRef);
            const [issue, stateRes] = await Promise.all([
                client.get(`workspaces/${ws}/projects/${projectId}/${style}/${issueId}/`),
                client.get(`workspaces/${ws}/projects/${projectId}/states/`),
            ]);
            const stateMap = buildStateMap(unwrap(stateRes));
            if (opts.json) {
                printJson(opts.fields ? projectIssue(issue, stateMap, identifier, opts.fields, projectId) : issue);
                return;
            }
            printInfo(`${identifier}-${issue.sequence_id}  ${issue.name}`);
            printInfo(`State:       ${resolveState(issue, stateMap)}`);
            printInfo(`Priority:    ${issue.priority ?? "-"}`);
            if (issue.description_html) {
                const text = stripHtml(issue.description_html);
                printInfo(`Description: ${text || "-"}`);
            }
            else {
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
            const labelNames = labels.map((l) => typeof l === "object" && "name" in l ? l.name : String(l));
            printInfo(`Labels:      ${labelNames.length > 0 ? labelNames.join(", ") : "-"}`);
            if (issue.due_date)
                printInfo(`Due:         ${issue.due_date}`);
            if (issue.start_date)
                printInfo(`Start:       ${issue.start_date}`);
            printInfo(`Created:     ${issue.created_at}`);
            printInfo(`Updated:     ${issue.updated_at}`);
        }
        catch (err) {
            exitWithError(err, Boolean(opts.json));
        }
    });
    // ── create ────────────────────────────────────────────────────────────────
    command
        .command("create")
        .description("Create an issue in the active (or specified) project")
        .option("--workspace <slug>", "Workspace slug (overrides active context)")
        .option("--project <identifier-or-name>", "Project identifier or name (overrides active context)")
        .option("--title <title>", "Issue title")
        .option("--description <description>", "Issue description")
        .option("--priority <priority>", "Priority: urgent | high | medium | low | none")
        .option("--assignee <name>", "Assignee display name or email (repeatable)", collect, [])
        .option("--label <name>", "Label name (repeatable)", collect, [])
        .option("--parent <ref>", "Parent issue ref (sequence number, PROJ-42, or UUID)")
        .option("--due <YYYY-MM-DD>", "Due date")
        .option("--start <YYYY-MM-DD>", "Start date")
        .option("--json", "Output raw JSON")
        .action(async (opts) => {
        try {
            const config = loadConfig();
            const client = createClient(config);
            const ws = opts.workspace ?? requireActiveWorkspace(config);
            const style = client.issuesSegment();
            let projectId;
            let identifier;
            if (opts.project) {
                const proj = await resolveProject(client, ws, opts.project);
                projectId = proj.id;
                identifier = proj.identifier;
            }
            else {
                const active = requireActiveProject(config);
                projectId = active.id;
                identifier = active.identifier;
            }
            const title = opts.title ?? (await ask("Title"));
            if (!title) {
                throw new ValidationError("Title is required.");
            }
            const description = opts.description ?? (await ask("Description (optional)"));
            const body = { name: title };
            if (description)
                body.description_html = `<p>${description}</p>`;
            if (opts.priority)
                body.priority = opts.priority;
            if (opts.due)
                body.due_date = opts.due;
            if (opts.start)
                body.start_date = opts.start;
            if (opts.assignee.length > 0) {
                const ids = await Promise.all(opts.assignee.map((a) => resolveMember(client, ws, a)));
                body.assignees = ids;
            }
            if (opts.label.length > 0) {
                const ids = await Promise.all(opts.label.map((l) => resolveLabel(client, ws, projectId, l)));
                body.label_ids = ids;
            }
            if (opts.parent) {
                const { issueId: parentId } = await resolveIssueRef(client, ws, projectId, identifier, style, opts.parent);
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
            const issue = await client.post(path, body);
            if (opts.json) {
                printJson(issue);
                return;
            }
            printInfo(`Created ${identifier}-${issue.sequence_id}: ${issue.name}`);
        }
        catch (err) {
            exitWithError(err, Boolean(opts.json));
        }
    });
    // ── update ────────────────────────────────────────────────────────────────
    command
        .command("update <issue>")
        .description("Update an existing issue")
        .option("--workspace <slug>", "Workspace slug (overrides active context)")
        .option("--project <identifier-or-name>", "Project identifier or name (overrides active context)")
        .option("--title <title>", "New title")
        .option("--description <description>", "New description")
        .option("--priority <priority>", "Priority: urgent | high | medium | low | none")
        .option("--state <state>", "State name or ID")
        .option("--assignee <name>", "Assignee display name or email (repeatable)", collect, [])
        .option("--label <name>", "Label name — replaces existing labels (repeatable)", collect, [])
        .option("--parent <ref>", "Parent issue ref (sequence number, PROJ-42, or UUID)")
        .option("--due <YYYY-MM-DD>", "Due date (use 'none' to clear)")
        .option("--start <YYYY-MM-DD>", "Start date (use 'none' to clear)")
        .option("--json", "Output raw JSON")
        .action(async (issueRef, opts) => {
        try {
            const config = loadConfig();
            const client = createClient(config);
            const ws = opts.workspace ?? requireActiveWorkspace(config);
            const style = client.issuesSegment();
            let activeProjectId;
            let activeProjectIdentifier;
            if (opts.project) {
                const proj = await resolveProject(client, ws, opts.project);
                activeProjectId = proj.id;
                activeProjectIdentifier = proj.identifier;
            }
            else if (config.context.activeProject) {
                activeProjectId = config.context.activeProject;
                activeProjectIdentifier = config.context.activeProjectIdentifier;
            }
            const { issueId, projectId, identifier } = await resolveIssueRef(client, ws, activeProjectId, activeProjectIdentifier, style, issueRef);
            const body = {};
            if (opts.title)
                body.name = opts.title;
            if (opts.description)
                body.description_html = `<p>${opts.description}</p>`;
            if (opts.priority)
                body.priority = opts.priority;
            if (opts.due)
                body.due_date = opts.due === "none" ? null : opts.due;
            if (opts.start)
                body.start_date = opts.start === "none" ? null : opts.start;
            if (opts.state) {
                const stateRes = await client.get(`workspaces/${ws}/projects/${projectId}/states/`);
                const states = unwrap(stateRes);
                const match = states.find((s) => s.id === opts.state || s.name.toLowerCase() === opts.state.toLowerCase());
                body.state = match ? match.id : opts.state;
            }
            if (opts.assignee.length > 0) {
                const ids = await Promise.all(opts.assignee.map((a) => resolveMember(client, ws, a)));
                body.assignees = ids;
            }
            if (opts.label.length > 0) {
                const ids = await Promise.all(opts.label.map((l) => resolveLabel(client, ws, projectId, l)));
                body.label_ids = ids;
            }
            if (opts.parent) {
                const { issueId: parentId } = await resolveIssueRef(client, ws, projectId, identifier, style, opts.parent);
                body.parent = parentId;
            }
            if (Object.keys(body).length === 0) {
                throw new ValidationError("Nothing to update. Use --title, --description, --priority, --state, --assignee, --label, --parent, --due, or --start.");
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
            const issue = await client.patch(path, body);
            if (opts.json) {
                printJson(issue);
                return;
            }
            printInfo(`Updated ${identifier}-${issue.sequence_id}: ${issue.name}`);
        }
        catch (err) {
            exitWithError(err, Boolean(opts.json));
        }
    });
    // ── delete ────────────────────────────────────────────────────────────────
    command
        .command("delete <issue>")
        .description("Delete an issue. Accepts: 42, PROJ-42, or UUID")
        .option("--workspace <slug>", "Workspace slug (overrides active context)")
        .option("--project <identifier-or-name>", "Project identifier or name (overrides active context)")
        .option("--json", "Output raw JSON")
        .action(async (issueRef, opts) => {
        try {
            const config = loadConfig();
            const client = createClient(config);
            const ws = opts.workspace ?? requireActiveWorkspace(config);
            const style = client.issuesSegment();
            let activeProjectId;
            let activeProjectIdentifier;
            if (opts.project) {
                const proj = await resolveProject(client, ws, opts.project);
                activeProjectId = proj.id;
                activeProjectIdentifier = proj.identifier;
            }
            else if (config.context.activeProject) {
                activeProjectId = config.context.activeProject;
                activeProjectIdentifier = config.context.activeProjectIdentifier;
            }
            const { issueId, projectId, identifier } = await resolveIssueRef(client, ws, activeProjectId, activeProjectIdentifier, style, issueRef);
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
        }
        catch (err) {
            exitWithError(err, Boolean(opts.json));
        }
    });
    // ── close ─────────────────────────────────────────────────────────────────
    command
        .command("close <issue>")
        .description("Move an issue to its first completed state")
        .option("--workspace <slug>", "Workspace slug (overrides active context)")
        .option("--project <identifier-or-name>", "Project identifier or name (overrides active context)")
        .option("--json", "Output raw JSON")
        .action(async (issueRef, opts) => {
        try {
            const config = loadConfig();
            const client = createClient(config);
            const ws = opts.workspace ?? requireActiveWorkspace(config);
            const style = client.issuesSegment();
            let activeProjectId;
            let activeProjectIdentifier;
            if (opts.project) {
                const proj = await resolveProject(client, ws, opts.project);
                activeProjectId = proj.id;
                activeProjectIdentifier = proj.identifier;
            }
            else if (config.context.activeProject) {
                activeProjectId = config.context.activeProject;
                activeProjectIdentifier = config.context.activeProjectIdentifier;
            }
            const { issueId, projectId, identifier } = await resolveIssueRef(client, ws, activeProjectId, activeProjectIdentifier, style, issueRef);
            const stateRes = await client.get(`workspaces/${ws}/projects/${projectId}/states/`);
            const states = unwrap(stateRes);
            const completed = states.find((s) => s.group === "completed");
            if (!completed)
                throw new ValidationError("No completed state found in this project.");
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
            const issue = await client.patch(path, body);
            if (opts.json) {
                printJson(issue);
                return;
            }
            printInfo(`Closed ${identifier ? `${identifier}-` : ""}${issueRef}.`);
        }
        catch (err) {
            exitWithError(err, Boolean(opts.json));
        }
    });
    // ── reopen ────────────────────────────────────────────────────────────────
    command
        .command("reopen <issue>")
        .description("Move an issue back to its first backlog (or unstarted) state")
        .option("--workspace <slug>", "Workspace slug (overrides active context)")
        .option("--project <identifier-or-name>", "Project identifier or name (overrides active context)")
        .option("--json", "Output raw JSON")
        .action(async (issueRef, opts) => {
        try {
            const config = loadConfig();
            const client = createClient(config);
            const ws = opts.workspace ?? requireActiveWorkspace(config);
            const style = client.issuesSegment();
            let activeProjectId;
            let activeProjectIdentifier;
            if (opts.project) {
                const proj = await resolveProject(client, ws, opts.project);
                activeProjectId = proj.id;
                activeProjectIdentifier = proj.identifier;
            }
            else if (config.context.activeProject) {
                activeProjectId = config.context.activeProject;
                activeProjectIdentifier = config.context.activeProjectIdentifier;
            }
            const { issueId, projectId, identifier } = await resolveIssueRef(client, ws, activeProjectId, activeProjectIdentifier, style, issueRef);
            const stateRes = await client.get(`workspaces/${ws}/projects/${projectId}/states/`);
            const states = unwrap(stateRes);
            const reopen = states.find((s) => s.group === "backlog") ??
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
            const issue = await client.patch(path, body);
            if (opts.json) {
                printJson(issue);
                return;
            }
            printInfo(`Reopened ${identifier ? `${identifier}-` : ""}${issueRef}.`);
        }
        catch (err) {
            exitWithError(err, Boolean(opts.json));
        }
    });
    // ── open ───────────────────────────────────────────────────────────────────
    command
        .command("open <issue>")
        .description("Open an issue in the default browser. Accepts: 42, PROJ-42, or UUID")
        .option("--workspace <slug>", "Workspace slug (overrides active context)")
        .option("--project <identifier-or-name>", "Project identifier or name (overrides active context)")
        .option("--json", "Output raw JSON")
        .action(async (issueRef, opts) => {
        try {
            const config = loadConfig();
            const client = createClient(config);
            const ws = opts.workspace ?? requireActiveWorkspace(config);
            const style = client.issuesSegment();
            // Get baseUrl from active account for constructing the web URL
            const account = requireActiveAccount(config);
            const baseUrl = account.baseUrl.replace(/\/$/, ""); // Remove trailing slash
            let activeProjectId;
            let activeProjectIdentifier;
            if (opts.project) {
                const proj = await resolveProject(client, ws, opts.project);
                activeProjectId = proj.id;
                activeProjectIdentifier = proj.identifier;
            }
            else if (config.context.activeProject) {
                activeProjectId = config.context.activeProject;
                activeProjectIdentifier = config.context.activeProjectIdentifier;
            }
            const { issueId, projectId, identifier } = await resolveIssueRef(client, ws, activeProjectId, activeProjectIdentifier, style, issueRef);
            // Fetch the issue to get its sequence_id for the URL
            const issue = await client.get(`workspaces/${ws}/projects/${projectId}/${style}/${issueId}/`);
            // Construct the Plane web URL
            // Format: {baseUrl}/{workspace}/projects/{project_identifier}/issues/{sequence_id}
            const url = `${baseUrl}/${ws}/projects/${identifier}/issues/${issue.sequence_id}`;
            // Open the URL in the default browser (cross-platform)
            const platform = process.platform;
            const command = platform === "darwin" ? "open" : platform === "win32" ? "start" : "xdg-open";
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
        }
        catch (err) {
            exitWithError(err, Boolean(opts.json));
        }
    });
    return command;
}
function collect(value, previous) {
    return [...previous, value];
}
// Maps raw API field names and common aliases → normalized field names in the projected output.
// Lets AI agents use either the raw Plane API names (snake_case) or the normalized names.
const FIELD_ALIASES = {
    name: "title",
    sequence_id: "sequence",
    state_id: "state",
    state_name: "state",
    project_id: "projectId",
    updated_at: "updatedAt",
    created_at: "createdAt",
    due_date: "dueDate",
    start_date: "startDate",
    label_ids: "labels",
};
function projectIssue(issue, stateMap, identifier, fieldsCsv, projectId) {
    const requested = fieldsCsv
        .split(",")
        .map((field) => field.trim())
        .filter(Boolean);
    const full = {
        id: issue.id,
        projectId,
        identifier: `${identifier}-${issue.sequence_id}`,
        sequence: issue.sequence_id,
        title: issue.name,
        state: resolveState(issue, stateMap),
        priority: issue.priority,
        assignees: issue.assignees ?? [],
        labels: (issue.labels ?? []).map((label) => typeof label === "object" && "name" in label ? label.name : String(label)),
        parent: issue.parent ?? null,
        dueDate: issue.due_date ?? null,
        startDate: issue.start_date ?? null,
        createdAt: issue.created_at,
        updatedAt: issue.updated_at,
        description: issue.description_stripped ?? issue.description_html ?? null,
    };
    return requested.reduce((acc, field) => {
        const key = FIELD_ALIASES[field] ?? field;
        if (key in full)
            acc[field] = full[key];
        return acc;
    }, {});
}
//# sourceMappingURL=issue.js.map