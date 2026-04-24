import { Command } from "commander";
import { spawn } from "node:child_process";
import { loadConfig, createClient, requireActiveWorkspace, requireActiveProject, requireActiveAccount, } from "../core/config-store.js";
import { unwrap, fetchAll } from "../core/api-client.js";
import { printInfo, printTable, printJson } from "../core/output.js";
import { ask } from "../core/prompt.js";
import { exitWithError, ValidationError } from "../core/errors.js";
import { isDryRunEnabled } from "../core/runtime.js";
import { stripHtml } from "../core/html.js";
import { resolveProject, resolveIssueRef, buildStateMap, resolveState, resolveMember, resolveLabel, resolveCurrentUserId, normalizeIssue, projectIssueFields, UUID_RE, } from "../core/resolvers.js";
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
        .option("--state <names>", "Filter by state name(s), comma-separated (e.g. Todo,InProgress)")
        .option("--priority <values>", "Filter by priority, comma-separated: urgent | high | medium | low | none")
        .option("--assignee <names>", "Filter by assignee(s), comma-separated display names/emails or 'me'")
        .option("--updated-since <date>", "Filter issues updated on or after this date (YYYY-MM-DD)")
        .option("--json", "Output raw JSON")
        .option("--fields <names>", "Comma-separated fields for JSON output")
        .action(async (opts) => {
        try {
            const config = loadConfig();
            const client = createClient(config);
            const ws = opts.workspace ?? requireActiveWorkspace(config);
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
            // Resolve assignee(s)
            let assigneeIds;
            if (opts.assignee) {
                const names = opts.assignee
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean);
                assigneeIds = await Promise.all(names.map((n) => n.toLowerCase() === "me"
                    ? resolveCurrentUserId(client)
                    : resolveMember(client, ws, n)));
            }
            await listIssuesCore(client, ws, projectId, identifier, {
                states: opts.state
                    ?.split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                priorities: opts.priority
                    ?.split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                assigneeIds,
                updatedSince: opts.updatedSince,
                json: opts.json,
                fields: opts.fields,
            });
        }
        catch (err) {
            exitWithError(err, Boolean(opts.json));
        }
    });
    // ── mine ─────────────────────────────────────────────────────────────────
    command
        .command("mine")
        .description("List issues assigned to you (shortcut for: issue list --assignee me)")
        .option("--workspace <slug>", "Workspace slug (overrides active context)")
        .option("--project <identifier-or-name>", "Project identifier or name (overrides active context)")
        .option("--state <names>", "Filter by state name(s), comma-separated")
        .option("--priority <values>", "Filter by priority, comma-separated: urgent | high | medium | low | none")
        .option("--updated-since <date>", "Filter issues updated on or after this date (YYYY-MM-DD)")
        .option("--json", "Output raw JSON")
        .option("--fields <names>", "Comma-separated fields for JSON output")
        .action(async (opts) => {
        try {
            const config = loadConfig();
            const client = createClient(config);
            const ws = opts.workspace ?? requireActiveWorkspace(config);
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
            const myId = await resolveCurrentUserId(client);
            await listIssuesCore(client, ws, projectId, identifier, {
                states: opts.state
                    ?.split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                priorities: opts.priority
                    ?.split(",")
                    .map((s) => s.trim())
                    .filter(Boolean),
                assigneeIds: [myId],
                updatedSince: opts.updatedSince,
                json: opts.json,
                fields: opts.fields,
            });
        }
        catch (err) {
            exitWithError(err, Boolean(opts.json));
        }
    });
    // ── get ───────────────────────────────────────────────────────────────────
    command
        .command("get <issue>")
        .alias("view")
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
            if (issue.target_date)
                printInfo(`Due:         ${issue.target_date}`);
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
        .option("--label <name>", "Label name (case-insensitive, repeatable)", collect, [])
        .option("--label-id <uuid>", "Label UUID (repeatable, alternative to --label, skips name resolution)", collect, [])
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
            const description = opts.description ?? (await ask("Description (optional)", ""));
            const body = { name: title };
            if (description)
                body.description_html = `<p>${description}</p>`;
            if (opts.priority)
                body.priority = opts.priority;
            if (opts.due)
                body.target_date = opts.due;
            if (opts.start)
                body.start_date = opts.start;
            if (opts.assignee.length > 0) {
                const ids = await Promise.all(opts.assignee.map((a) => a.toLowerCase() === "me"
                    ? resolveCurrentUserId(client)
                    : resolveMember(client, ws, a)));
                body.assignees = ids;
            }
            for (const lid of opts.labelId) {
                if (!UUID_RE.test(lid)) {
                    throw new ValidationError(`--label-id requires a UUID; got "${lid}". Use --label for name resolution.`);
                }
            }
            if (opts.label.length > 0 || opts.labelId.length > 0) {
                const resolved = await Promise.all(opts.label.map((l) => resolveLabel(client, ws, projectId, l)));
                body.labels = [...new Set([...resolved, ...opts.labelId])];
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
        .description("Update one or more issues. Accepts comma-separated refs: PROJ-1,2,3")
        .option("--workspace <slug>", "Workspace slug (overrides active context)")
        .option("--project <identifier-or-name>", "Project identifier or name (overrides active context)")
        .option("--title <title>", "New title")
        .option("--name <name>", "New title (alias for --title)")
        .option("--description <description>", "New description")
        .option("--priority <priority>", "Priority: urgent | high | medium | low | none")
        .option("--state <state>", "State name or ID")
        .option("--assignee <name>", "Assignee display name or email (repeatable)", collect, [])
        .option("--label <name>", "Label name (case-insensitive, repeatable) — replaces existing labels", collect, [])
        .option("--label-id <uuid>", "Label UUID (repeatable, alternative to --label, skips name resolution)", collect, [])
        .option("--parent <ref>", "Parent issue ref (sequence number, PROJ-42, or UUID) — single-issue only")
        .option("--due <YYYY-MM-DD>", "Due date (use 'none' to clear)")
        .option("--start <YYYY-MM-DD>", "Start date (use 'none' to clear)")
        .option("--json", "Output raw JSON")
        .action(async (issueRefArg, opts) => {
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
            const refs = issueRefArg
                .split(",")
                .map((r) => r.trim())
                .filter(Boolean);
            const isBulk = refs.length > 1;
            if (isBulk && opts.parent) {
                throw new ValidationError("--parent cannot be used with bulk updates (multiple issue refs).");
            }
            // Resolve all refs up-front — fail before sending any API calls
            const resolved = await Promise.all(refs.map((ref) => resolveIssueRef(client, ws, activeProjectId, activeProjectIdentifier, style, ref)));
            // Build non-project-specific parts of the body
            const baseBody = {};
            const titleValue = opts.title ?? opts.name;
            if (titleValue)
                baseBody.name = titleValue;
            if (opts.description)
                baseBody.description_html = `<p>${opts.description}</p>`;
            if (opts.priority)
                baseBody.priority = opts.priority;
            if (opts.due)
                baseBody.target_date = opts.due === "none" ? null : opts.due;
            if (opts.start)
                baseBody.start_date = opts.start === "none" ? null : opts.start;
            // Resolve assignees (workspace-scoped, same for all issues)
            if (opts.assignee.length > 0) {
                const ids = await Promise.all(opts.assignee.map((a) => a.toLowerCase() === "me"
                    ? resolveCurrentUserId(client)
                    : resolveMember(client, ws, a)));
                baseBody.assignees = ids;
            }
            // Resolve state and labels per unique project (handles cross-project bulk)
            const uniqueProjectIds = [...new Set(resolved.map((r) => r.projectId))];
            const stateIdByProject = new Map();
            if (opts.state) {
                await Promise.all(uniqueProjectIds.map(async (pid) => {
                    const stateRes = await client.get(`workspaces/${ws}/projects/${pid}/states/`);
                    const states = unwrap(stateRes);
                    const match = states.find((s) => s.id === opts.state || s.name.toLowerCase() === opts.state.toLowerCase());
                    stateIdByProject.set(pid, match ? match.id : opts.state);
                }));
            }
            for (const lid of opts.labelId) {
                if (!UUID_RE.test(lid)) {
                    throw new ValidationError(`--label-id requires a UUID; got "${lid}". Use --label for name resolution.`);
                }
            }
            const labelIdsByProject = new Map();
            if (opts.label.length > 0 || opts.labelId.length > 0) {
                await Promise.all(uniqueProjectIds.map(async (pid) => {
                    const resolvedNames = await Promise.all(opts.label.map((l) => resolveLabel(client, ws, pid, l)));
                    labelIdsByProject.set(pid, [...new Set([...resolvedNames, ...opts.labelId])]);
                }));
            }
            // Resolve parent (single-issue only)
            if (opts.parent) {
                const { issueId: parentId } = await resolveIssueRef(client, ws, resolved[0].projectId, resolved[0].identifier, style, opts.parent);
                baseBody.parent = parentId;
            }
            if (Object.keys(baseBody).length === 0 &&
                !opts.state &&
                opts.label.length === 0 &&
                opts.labelId.length === 0) {
                throw new ValidationError("Nothing to update. Use --title (or --name), --description, --priority, --state, --assignee, --label, --label-id, --parent, --due, or --start.");
            }
            // Dry-run: print all payloads and exit
            if (isDryRunEnabled()) {
                const dryRunPayloads = resolved.map(({ issueId, projectId, identifier }) => {
                    const body = { ...baseBody };
                    if (stateIdByProject.has(projectId))
                        body.state = stateIdByProject.get(projectId);
                    if (labelIdsByProject.has(projectId))
                        body.labels = labelIdsByProject.get(projectId);
                    return {
                        dryRun: true,
                        method: "PATCH",
                        path: `workspaces/${ws}/projects/${projectId}/${style}/${issueId}/`,
                        body,
                        context: { workspace: ws, projectId, projectIdentifier: identifier, issueId },
                    };
                });
                printJson(isBulk ? dryRunPayloads : dryRunPayloads[0]);
                return;
            }
            // Patch all issues in parallel
            const updated = await Promise.all(resolved.map(({ issueId, projectId }) => {
                const body = { ...baseBody };
                if (stateIdByProject.has(projectId))
                    body.state = stateIdByProject.get(projectId);
                if (labelIdsByProject.has(projectId))
                    body.labels = labelIdsByProject.get(projectId);
                return client.patch(`workspaces/${ws}/projects/${projectId}/${style}/${issueId}/`, body);
            }));
            if (opts.json) {
                printJson(isBulk ? updated : updated[0]);
                return;
            }
            if (isBulk) {
                const rows = updated.map((issue, i) => [
                    `${resolved[i].identifier}-${issue.sequence_id}`,
                    issue.name,
                ]);
                printTable(rows, ["ID", "TITLE"]);
            }
            else {
                const issue = updated[0];
                printInfo(`Updated ${resolved[0].identifier}-${issue.sequence_id}: ${issue.name}`);
            }
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
    // ── move ─────────────────────────────────────────────────────────────────
    command
        .command("move <issue>")
        .description("Move (or copy) an issue to a different project")
        .requiredOption("--to-project <identifier-or-name>", "Target project identifier or name")
        .option("--copy", "Copy the issue without deleting the original")
        .option("--workspace <slug>", "Workspace slug (overrides active context)")
        .option("--project <identifier-or-name>", "Source project identifier or name (overrides active context)")
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
            const { issueId, projectId: srcProjectId, identifier: srcIdentifier, } = await resolveIssueRef(client, ws, activeProjectId, activeProjectIdentifier, style, issueRef);
            const targetProject = await resolveProject(client, ws, opts.toProject);
            const tgtProjectId = targetProject.id;
            const tgtIdentifier = targetProject.identifier;
            if (srcProjectId === tgtProjectId) {
                throw new ValidationError("Source and target projects are the same.");
            }
            // Fetch full source issue
            const source = await client.get(`workspaces/${ws}/projects/${srcProjectId}/${style}/${issueId}/`);
            // Map state from source to target by group (best-effort)
            const [srcStates, tgtStates] = await Promise.all([
                client
                    .get(`workspaces/${ws}/projects/${srcProjectId}/states/`)
                    .then((r) => unwrap(r)),
                client
                    .get(`workspaces/${ws}/projects/${tgtProjectId}/states/`)
                    .then((r) => unwrap(r)),
            ]);
            const srcStateId = typeof source.state === "string"
                ? source.state
                : source.state?.id;
            const srcStateGroup = srcStates.find((s) => s.id === srcStateId)?.group ?? "backlog";
            const mappedState = tgtStates.find((s) => s.group === srcStateGroup) ??
                tgtStates.find((s) => s.group === "backlog") ??
                tgtStates.find((s) => s.group === "unstarted") ??
                tgtStates[0];
            if (!mappedState) {
                throw new ValidationError(`Target project "${tgtIdentifier}" has no states. Configure states before moving issues.`);
            }
            const newBody = {
                name: source.name,
                state: mappedState.id,
                priority: source.priority ?? "none",
            };
            if (source.description_html)
                newBody.description_html = source.description_html;
            if (source.target_date)
                newBody.target_date = source.target_date;
            if (source.start_date)
                newBody.start_date = source.start_date;
            // assignees and labels are workspace/project-scoped IDs — omit to avoid ID mismatches
            // users can re-assign after move
            const createPath = `workspaces/${ws}/projects/${tgtProjectId}/${style}/`;
            const deletePath = `workspaces/${ws}/projects/${srcProjectId}/${style}/${issueId}/`;
            if (isDryRunEnabled()) {
                printJson({
                    dryRun: true,
                    action: opts.copy ? "issue.copy" : "issue.move",
                    steps: [
                        { method: "POST", path: createPath, body: newBody },
                        ...(opts.copy ? [] : [{ method: "DELETE", path: deletePath }]),
                    ],
                    context: {
                        source: `${srcIdentifier}-${source.sequence_id}`,
                        targetProject: tgtIdentifier,
                        stateMapping: `${srcStateGroup} → ${mappedState.name}`,
                    },
                });
                return;
            }
            const newIssue = await client.post(createPath, newBody);
            if (!opts.copy) {
                await client.delete(deletePath);
            }
            if (opts.json) {
                printJson({
                    action: opts.copy ? "copied" : "moved",
                    source: `${srcIdentifier}-${source.sequence_id}`,
                    result: `${tgtIdentifier}-${newIssue.sequence_id}`,
                    issue: newIssue,
                });
                return;
            }
            const verb = opts.copy ? "Copied" : "Moved";
            printInfo(`${verb} ${srcIdentifier}-${source.sequence_id} → ${tgtIdentifier}-${newIssue.sequence_id}: ${newIssue.name}`);
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
async function listIssuesCore(client, ws, projectId, identifier, opts) {
    const style = client.issuesSegment();
    const basePath = `workspaces/${ws}/projects/${projectId}/${style}/`;
    const [allIssues, stateList] = await Promise.all([
        fetchAll(client, basePath),
        client
            .get(`workspaces/${ws}/projects/${projectId}/states/`)
            .then((r) => unwrap(r)),
    ]);
    const stateMap = buildStateMap(stateList);
    // Build state-name → ID set for filter matching
    let stateFilterIds;
    if (opts.states && opts.states.length > 0) {
        const lowerNames = new Set(opts.states.map((s) => s.toLowerCase()));
        stateFilterIds = new Set(stateList.filter((s) => lowerNames.has(s.name.toLowerCase())).map((s) => s.id));
    }
    let issues = allIssues;
    if (stateFilterIds) {
        issues = issues.filter((issue) => {
            const stateId = typeof issue.state === "string"
                ? issue.state
                : (issue.state?.id ?? "");
            return stateFilterIds.has(stateId);
        });
    }
    if (opts.priorities && opts.priorities.length > 0) {
        const prioritySet = new Set(opts.priorities.map((p) => p.toLowerCase()));
        issues = issues.filter((issue) => prioritySet.has((issue.priority ?? "none").toLowerCase()));
    }
    if (opts.assigneeIds && opts.assigneeIds.length > 0) {
        const assigneeSet = new Set(opts.assigneeIds);
        issues = issues.filter((issue) => (issue.assignees ?? []).some((a) => assigneeSet.has(a)));
    }
    if (opts.updatedSince) {
        const since = new Date(opts.updatedSince);
        if (isNaN(since.getTime())) {
            throw new ValidationError(`Invalid date "${opts.updatedSince}". Use YYYY-MM-DD format.`);
        }
        issues = issues.filter((issue) => new Date(issue.updated_at) >= since);
    }
    if (issues.length === 0) {
        printInfo("No issues found.");
        return;
    }
    if (opts.json) {
        const normalized = issues.map((issue) => normalizeIssue(issue, stateMap, identifier, projectId));
        printJson(opts.fields ? normalized.map((n) => projectIssueFields(n, opts.fields)) : normalized);
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
//# sourceMappingURL=issue.js.map