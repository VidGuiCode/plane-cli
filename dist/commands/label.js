import { Command } from "commander";
import { loadConfig, createClient, requireActiveWorkspace, requireActiveProject, } from "../core/config-store.js";
import { fetchAll } from "../core/api-client.js";
import { printInfo, printTable, printJson } from "../core/output.js";
import { resolveProject, resolveIssueRef, resolveLabel } from "../core/resolvers.js";
import { exitWithError, ValidationError } from "../core/errors.js";
import { isDryRunEnabled } from "../core/runtime.js";
export function createLabelCommand() {
    const command = new Command("label")
        .description("Work with Plane labels")
        .action(() => command.help());
    // ── list ──────────────────────────────────────────────────────────────────
    command
        .command("list")
        .description("List labels in the active (or specified) project")
        .option("--workspace <slug>", "Workspace slug (overrides active context)")
        .option("--project <identifier-or-name>", "Project identifier or name (overrides active context)")
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
            exitWithError(err, Boolean(opts.json));
        }
    });
    // ── create ────────────────────────────────────────────────────────────────
    command
        .command("create <name> <color>")
        .description("Create a label in the active (or specified) project. Color: hex code e.g. #ff0000")
        .option("--workspace <slug>", "Workspace slug (overrides active context)")
        .option("--project <identifier-or-name>", "Project identifier or name (overrides active context)")
        .option("--json", "Output raw JSON")
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
            const path = `workspaces/${ws}/projects/${projectId}/labels/`;
            const body = { name, color };
            if (isDryRunEnabled()) {
                printJson({
                    dryRun: true,
                    method: "POST",
                    path,
                    body,
                    context: { workspace: ws, projectId },
                });
                return;
            }
            const label = await client.post(path, body);
            if (opts.json) {
                printJson(label);
                return;
            }
            printInfo(`Label "${name}" created.`);
        }
        catch (err) {
            exitWithError(err, Boolean(opts.json));
        }
    });
    // ── delete ────────────────────────────────────────────────────────────────
    command
        .command("delete <label>")
        .description("Delete a label by name or UUID")
        .option("--workspace <slug>", "Workspace slug (overrides active context)")
        .option("--project <identifier-or-name>", "Project identifier or name (overrides active context)")
        .option("--json", "Output raw JSON")
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
            const path = `workspaces/${ws}/projects/${projectId}/labels/${labelId}/`;
            if (isDryRunEnabled()) {
                printJson({
                    dryRun: true,
                    method: "DELETE",
                    path,
                    context: { workspace: ws, projectId, labelId },
                });
                return;
            }
            await client.delete(path);
            if (opts.json) {
                printJson({ success: true, action: "label.delete", labelId, projectId, workspace: ws });
                return;
            }
            printInfo(`Label "${labelRef}" deleted.`);
        }
        catch (err) {
            exitWithError(err, Boolean(opts.json));
        }
    });
    // ── add ───────────────────────────────────────────────────────────────────
    command
        .command("add <issue> <label>")
        .description("Add a label to an issue. Issue: 42, PROJ-42, or UUID. Label: name (case-insensitive) or UUID")
        .option("--workspace <slug>", "Workspace slug (overrides active context)")
        .option("--project <identifier-or-name>", "Project identifier or name (overrides active context)")
        .option("--json", "Output raw JSON")
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
                const path = `workspaces/${ws}/projects/${projectId}/${style}/${issueId}/`;
                const body = { labels: current };
                if (isDryRunEnabled()) {
                    printJson({
                        dryRun: true,
                        method: "PATCH",
                        path,
                        body,
                        context: { workspace: ws, projectId, issueId, labelId },
                    });
                    return;
                }
                const updated = await client.patch(path, body);
                if (opts.json) {
                    printJson(updated);
                    return;
                }
            }
            else if (opts.json) {
                printJson({
                    success: true,
                    action: "label.add",
                    noop: true,
                    issueId,
                    labelId,
                    projectId,
                });
                return;
            }
            printInfo("Label added.");
        }
        catch (err) {
            exitWithError(err, Boolean(opts.json));
        }
    });
    // ── remove ────────────────────────────────────────────────────────────────
    command
        .command("remove <issue> <label>")
        .description("Remove a label from an issue. Issue: 42, PROJ-42, or UUID. Label: name (case-insensitive) or UUID")
        .option("--workspace <slug>", "Workspace slug (overrides active context)")
        .option("--project <identifier-or-name>", "Project identifier or name (overrides active context)")
        .option("--json", "Output raw JSON")
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
            const path = `workspaces/${ws}/projects/${projectId}/${style}/${issueId}/`;
            const body = { labels: updated };
            if (isDryRunEnabled()) {
                printJson({
                    dryRun: true,
                    method: "PATCH",
                    path,
                    body,
                    context: { workspace: ws, projectId, issueId, labelId },
                });
                return;
            }
            const result = await client.patch(path, body);
            if (opts.json) {
                printJson(result);
                return;
            }
            printInfo("Label removed.");
        }
        catch (err) {
            exitWithError(err, Boolean(opts.json));
        }
    });
    // ── update ─────────────────────────────────────────────────────────────────
    command
        .command("update <label>")
        .description("Update a label's name or color")
        .option("--name <new_name>", "New name for the label")
        .option("--color <hex>", "New color (e.g., #ff0000)")
        .option("--workspace <slug>", "Workspace slug (overrides active context)")
        .option("--project <identifier-or-name>", "Project identifier or name (overrides active context)")
        .option("--json", "Output raw JSON")
        .action(async (labelRef, opts) => {
        try {
            if (!opts.name && !opts.color) {
                throw new ValidationError("At least one of --name or --color must be provided");
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
            const path = `workspaces/${ws}/projects/${projectId}/labels/${labelId}/`;
            if (isDryRunEnabled()) {
                printJson({
                    dryRun: true,
                    method: "PATCH",
                    path,
                    body,
                    context: { workspace: ws, projectId, labelId },
                });
                return;
            }
            const label = await client.patch(path, body);
            if (opts.json) {
                printJson(label);
                return;
            }
            printInfo(`Label "${labelRef}" updated.`);
        }
        catch (err) {
            exitWithError(err, Boolean(opts.json));
        }
    });
    return command;
}
//# sourceMappingURL=label.js.map