import { Command } from "commander";
import { loadConfig, createClient, requireActiveWorkspace, requireActiveProject, } from "../core/config-store.js";
import { PlaneApiError, unwrap, fetchAll } from "../core/api-client.js";
import { printInfo, printError, printTable, printJson } from "../core/output.js";
import { ask } from "../core/prompt.js";
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
        .option("--project <identifier>", "Project identifier (overrides active context)")
        .option("--state <name>", "Filter by state name")
        .option("--priority <value>", "Filter by priority: urgent | high | medium | low | none")
        .option("--assignee <name>", "Filter by assignee display name or email")
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
                printJson(issues);
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
            printError(err instanceof PlaneApiError ? err.message : String(err));
            process.exit(1);
        }
    });
    // ── get ───────────────────────────────────────────────────────────────────
    command
        .command("get <issue>")
        .description("Fetch a single issue. Accepts: 42 (active project), PROJ-42 (any project), or UUID")
        .option("--workspace <slug>", "Workspace slug (overrides active context)")
        .option("--project <identifier>", "Project identifier (overrides active context)")
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
            const [issue, stateRes] = await Promise.all([
                client.get(`workspaces/${ws}/projects/${projectId}/${style}/${issueId}/`),
                client.get(`workspaces/${ws}/projects/${projectId}/states/`),
            ]);
            const stateMap = buildStateMap(unwrap(stateRes));
            if (opts.json) {
                printJson(issue);
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
            printError(err instanceof PlaneApiError ? err.message : String(err));
            process.exit(1);
        }
    });
    // ── create ────────────────────────────────────────────────────────────────
    command
        .command("create")
        .description("Create an issue in the active (or specified) project")
        .option("--workspace <slug>", "Workspace slug (overrides active context)")
        .option("--project <identifier>", "Project identifier (overrides active context)")
        .option("--title <title>", "Issue title")
        .option("--description <description>", "Issue description")
        .option("--priority <priority>", "Priority: urgent | high | medium | low | none")
        .option("--assignee <name>", "Assignee display name or email (repeatable)", collect, [])
        .option("--label <name>", "Label name (repeatable)", collect, [])
        .option("--parent <ref>", "Parent issue ref (sequence number, PROJ-42, or UUID)")
        .option("--due <YYYY-MM-DD>", "Due date")
        .option("--start <YYYY-MM-DD>", "Start date")
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
                printError("Title is required.");
                process.exit(1);
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
            const issue = await client.post(`workspaces/${ws}/projects/${projectId}/${style}/`, body);
            printInfo(`Created ${identifier}-${issue.sequence_id}: ${issue.name}`);
        }
        catch (err) {
            printError(err instanceof PlaneApiError ? err.message : String(err));
            process.exit(1);
        }
    });
    // ── update ────────────────────────────────────────────────────────────────
    command
        .command("update <issue>")
        .description("Update an existing issue")
        .option("--workspace <slug>", "Workspace slug (overrides active context)")
        .option("--project <identifier>", "Project identifier (overrides active context)")
        .option("--title <title>", "New title")
        .option("--description <description>", "New description")
        .option("--priority <priority>", "Priority: urgent | high | medium | low | none")
        .option("--state <state>", "State name or ID")
        .option("--assignee <name>", "Assignee display name or email (repeatable)", collect, [])
        .option("--label <name>", "Label name — replaces existing labels (repeatable)", collect, [])
        .option("--parent <ref>", "Parent issue ref (sequence number, PROJ-42, or UUID)")
        .option("--due <YYYY-MM-DD>", "Due date (use 'none' to clear)")
        .option("--start <YYYY-MM-DD>", "Start date (use 'none' to clear)")
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
                const match = states.find((s) => s.id === opts.state ||
                    s.name.toLowerCase() === opts.state.toLowerCase());
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
                printError("Nothing to update. Use --title, --description, --priority, --state, --assignee, --label, --parent, --due, or --start.");
                process.exit(1);
            }
            const issue = await client.patch(`workspaces/${ws}/projects/${projectId}/${style}/${issueId}/`, body);
            printInfo(`Updated ${identifier}-${issue.sequence_id}: ${issue.name}`);
        }
        catch (err) {
            printError(err instanceof PlaneApiError ? err.message : String(err));
            process.exit(1);
        }
    });
    // ── delete ────────────────────────────────────────────────────────────────
    command
        .command("delete <issue>")
        .description("Delete an issue. Accepts: 42, PROJ-42, or UUID")
        .option("--workspace <slug>", "Workspace slug (overrides active context)")
        .option("--project <identifier>", "Project identifier (overrides active context)")
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
            await client.delete(`workspaces/${ws}/projects/${projectId}/${style}/${issueId}/`);
            printInfo(`Deleted ${identifier ? `${identifier}-` : ""}${issueRef}.`);
        }
        catch (err) {
            printError(err instanceof PlaneApiError ? err.message : String(err));
            process.exit(1);
        }
    });
    // ── close ─────────────────────────────────────────────────────────────────
    command
        .command("close <issue>")
        .description("Move an issue to its first completed state")
        .option("--workspace <slug>", "Workspace slug (overrides active context)")
        .option("--project <identifier>", "Project identifier (overrides active context)")
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
                throw new Error("No completed state found in this project.");
            await client.patch(`workspaces/${ws}/projects/${projectId}/${style}/${issueId}/`, { state: completed.id });
            printInfo(`Closed ${identifier ? `${identifier}-` : ""}${issueRef}.`);
        }
        catch (err) {
            printError(err instanceof PlaneApiError ? err.message : String(err));
            process.exit(1);
        }
    });
    // ── reopen ────────────────────────────────────────────────────────────────
    command
        .command("reopen <issue>")
        .description("Move an issue back to its first backlog (or unstarted) state")
        .option("--workspace <slug>", "Workspace slug (overrides active context)")
        .option("--project <identifier>", "Project identifier (overrides active context)")
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
            const reopen = states.find((s) => s.group === "backlog") ?? states.find((s) => s.group === "unstarted");
            if (!reopen)
                throw new Error("No backlog or unstarted state found in this project.");
            await client.patch(`workspaces/${ws}/projects/${projectId}/${style}/${issueId}/`, { state: reopen.id });
            printInfo(`Reopened ${identifier ? `${identifier}-` : ""}${issueRef}.`);
        }
        catch (err) {
            printError(err instanceof PlaneApiError ? err.message : String(err));
            process.exit(1);
        }
    });
    return command;
}
function collect(value, previous) {
    return [...previous, value];
}
//# sourceMappingURL=issue.js.map