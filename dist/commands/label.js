import { Command } from "commander";
import { loadConfig, createClient, requireActiveWorkspace, requireActiveProject, } from "../core/config-store.js";
import { PlaneApiError, fetchAll } from "../core/api-client.js";
import { printInfo, printError, printTable, printJson } from "../core/output.js";
import { resolveProject, resolveIssueRef, resolveLabel } from "../core/resolvers.js";
export function createLabelCommand() {
    const command = new Command("label")
        .description("Work with Plane labels")
        .action(() => command.help());
    // ── list ──────────────────────────────────────────────────────────────────
    command
        .command("list")
        .description("List labels in the active (or specified) project")
        .option("--workspace <slug>", "Workspace slug (overrides active context)")
        .option("--project <identifier>", "Project identifier (overrides active context)")
        .option("--json", "Output raw JSON")
        .action(async (opts) => {
        try {
            const config = loadConfig();
            const client = createClient(config);
            const ws = opts.workspace ?? requireActiveWorkspace(config);
            let projectId;
            if (opts.project) {
                const proj = await resolveProject(client, ws, opts.project);
                projectId = proj.id;
            }
            else {
                projectId = requireActiveProject(config).id;
            }
            const labels = await fetchAll(client, `workspaces/${ws}/projects/${projectId}/labels/`);
            if (labels.length === 0) {
                printInfo("No labels found.");
                return;
            }
            if (opts.json) {
                printJson(labels);
                return;
            }
            const rows = labels.map((l) => [`  ${l.id}`, l.name, l.color ?? ""]);
            printTable(rows, ["ID", "NAME", "COLOR"]);
        }
        catch (err) {
            printError(err instanceof PlaneApiError ? err.message : String(err));
            process.exit(1);
        }
    });
    // ── create ────────────────────────────────────────────────────────────────
    command
        .command("create <name> <color>")
        .description("Create a label in the active (or specified) project. Color: hex code e.g. #ff0000")
        .option("--workspace <slug>", "Workspace slug (overrides active context)")
        .option("--project <identifier>", "Project identifier (overrides active context)")
        .action(async (name, color, opts) => {
        try {
            const config = loadConfig();
            const client = createClient(config);
            const ws = opts.workspace ?? requireActiveWorkspace(config);
            let projectId;
            if (opts.project) {
                const proj = await resolveProject(client, ws, opts.project);
                projectId = proj.id;
            }
            else {
                projectId = requireActiveProject(config).id;
            }
            await client.post(`workspaces/${ws}/projects/${projectId}/labels/`, {
                name,
                color,
            });
            printInfo(`Label "${name}" created.`);
        }
        catch (err) {
            printError(err instanceof PlaneApiError ? err.message : String(err));
            process.exit(1);
        }
    });
    // ── delete ────────────────────────────────────────────────────────────────
    command
        .command("delete <label>")
        .description("Delete a label by name or UUID")
        .option("--workspace <slug>", "Workspace slug (overrides active context)")
        .option("--project <identifier>", "Project identifier (overrides active context)")
        .action(async (labelRef, opts) => {
        try {
            const config = loadConfig();
            const client = createClient(config);
            const ws = opts.workspace ?? requireActiveWorkspace(config);
            let projectId;
            if (opts.project) {
                const proj = await resolveProject(client, ws, opts.project);
                projectId = proj.id;
            }
            else {
                projectId = requireActiveProject(config).id;
            }
            const labelId = await resolveLabel(client, ws, projectId, labelRef);
            await client.delete(`workspaces/${ws}/projects/${projectId}/labels/${labelId}/`);
            printInfo(`Label "${labelRef}" deleted.`);
        }
        catch (err) {
            printError(err instanceof PlaneApiError ? err.message : String(err));
            process.exit(1);
        }
    });
    // ── add ───────────────────────────────────────────────────────────────────
    command
        .command("add <issue> <label>")
        .description("Add a label to an issue. Issue: 42, PROJ-42, or UUID. Label: name or UUID")
        .option("--workspace <slug>", "Workspace slug (overrides active context)")
        .option("--project <identifier>", "Project identifier (overrides active context)")
        .action(async (issueRef, labelRef, opts) => {
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
            const { issueId, projectId } = await resolveIssueRef(client, ws, activeProjectId, activeProjectIdentifier, style, issueRef);
            const labelId = await resolveLabel(client, ws, projectId, labelRef);
            const issue = await client.get(`workspaces/${ws}/projects/${projectId}/${style}/${issueId}/`);
            const current = (issue.label_ids ??
                issue.labels ??
                []);
            if (!current.includes(labelId)) {
                current.push(labelId);
                await client.patch(`workspaces/${ws}/projects/${projectId}/${style}/${issueId}/`, { label_ids: current });
            }
            printInfo("Label added.");
        }
        catch (err) {
            printError(err instanceof PlaneApiError ? err.message : String(err));
            process.exit(1);
        }
    });
    // ── remove ────────────────────────────────────────────────────────────────
    command
        .command("remove <issue> <label>")
        .description("Remove a label from an issue. Issue: 42, PROJ-42, or UUID. Label: name or UUID")
        .option("--workspace <slug>", "Workspace slug (overrides active context)")
        .option("--project <identifier>", "Project identifier (overrides active context)")
        .action(async (issueRef, labelRef, opts) => {
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
            const { issueId, projectId } = await resolveIssueRef(client, ws, activeProjectId, activeProjectIdentifier, style, issueRef);
            const labelId = await resolveLabel(client, ws, projectId, labelRef);
            const issue = await client.get(`workspaces/${ws}/projects/${projectId}/${style}/${issueId}/`);
            const current = (issue.label_ids ??
                issue.labels ??
                []);
            const updated = current.filter((l) => l !== labelId);
            await client.patch(`workspaces/${ws}/projects/${projectId}/${style}/${issueId}/`, { label_ids: updated });
            printInfo("Label removed.");
        }
        catch (err) {
            printError(err instanceof PlaneApiError ? err.message : String(err));
            process.exit(1);
        }
    });
    // ── update ─────────────────────────────────────────────────────────────────
    command
        .command("update <label>")
        .description("Update a label's name or color")
        .option("--name <new_name>", "New name for the label")
        .option("--color <hex>", "New color (e.g., #ff0000)")
        .option("--workspace <slug>", "Workspace slug (overrides active context)")
        .option("--project <identifier>", "Project identifier (overrides active context)")
        .action(async (labelRef, opts) => {
        try {
            if (!opts.name && !opts.color) {
                printError("At least one of --name or --color must be provided");
                process.exit(1);
            }
            const config = loadConfig();
            const client = createClient(config);
            const ws = opts.workspace ?? requireActiveWorkspace(config);
            let projectId;
            if (opts.project) {
                const proj = await resolveProject(client, ws, opts.project);
                projectId = proj.id;
            }
            else {
                projectId = requireActiveProject(config).id;
            }
            const labelId = await resolveLabel(client, ws, projectId, labelRef);
            const body = {};
            if (opts.name)
                body.name = opts.name;
            if (opts.color)
                body.color = opts.color;
            await client.patch(`workspaces/${ws}/projects/${projectId}/labels/${labelId}/`, body);
            printInfo(`Label "${labelRef}" updated.`);
        }
        catch (err) {
            printError(err instanceof PlaneApiError ? err.message : String(err));
            process.exit(1);
        }
    });
    return command;
}
//# sourceMappingURL=label.js.map