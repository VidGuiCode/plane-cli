import { Command } from "commander";
import { loadConfig, createClient, requireActiveWorkspace, requireActiveProject, } from "../core/config-store.js";
import { PlaneApiError, unwrap, fetchAll } from "../core/api-client.js";
import { printInfo, printError, printTable, printJson } from "../core/output.js";
import { resolveProject, resolveIssueRef, resolveModule, buildStateMap, resolveState, } from "../core/resolvers.js";
export function createModuleCommand() {
    const command = new Command("module")
        .description("Work with Plane modules")
        .action(() => command.help());
    command
        .command("list")
        .description("List modules in the active (or specified) project")
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
            const modules = await fetchAll(client, `workspaces/${ws}/projects/${projectId}/modules/`);
            if (modules.length === 0) {
                printInfo("No modules found.");
                return;
            }
            if (opts.json) {
                printJson(modules);
                return;
            }
            const rows = modules.map((m) => [`  ${m.id}`, m.name, m.status ?? ""]);
            printTable(rows, ["ID", "NAME", "STATUS"]);
        }
        catch (err) {
            printError(err instanceof PlaneApiError ? err.message : String(err));
            process.exit(1);
        }
    });
    // ── add ───────────────────────────────────────────────────────────────────
    command
        .command("add <issue> <module>")
        .description("Add an issue to a module. Issue: 42, PROJ-42, or UUID. Module: name or UUID")
        .option("--workspace <slug>", "Workspace slug (overrides active context)")
        .option("--project <identifier>", "Project identifier (overrides active context)")
        .action(async (issueRef, moduleRef, opts) => {
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
            const mod = await resolveModule(client, ws, projectId, moduleRef);
            await client.post(`workspaces/${ws}/projects/${projectId}/modules/${mod.id}/module-issues/`, { issues: [issueId] });
            printInfo(`Issue added to module "${mod.name}".`);
        }
        catch (err) {
            printError(err instanceof PlaneApiError ? err.message : String(err));
            process.exit(1);
        }
    });
    // ── issues ────────────────────────────────────────────────────────────────
    command
        .command("issues <module>")
        .description("List issues in a module (name or UUID)")
        .option("--workspace <slug>", "Workspace slug (overrides active context)")
        .option("--project <identifier>", "Project identifier (overrides active context)")
        .option("--json", "Output raw JSON")
        .action(async (moduleRef, opts) => {
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
            const mod = await resolveModule(client, ws, projectId, moduleRef);
            const [issues, stateMap] = await Promise.all([
                fetchAll(client, `workspaces/${ws}/projects/${projectId}/modules/${mod.id}/module-issues/`),
                client
                    .get(`workspaces/${ws}/projects/${projectId}/states/`)
                    .then((r) => buildStateMap(unwrap(r))),
            ]);
            if (issues.length === 0) {
                printInfo(`No issues in module "${mod.name}".`);
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
    // ── remove ────────────────────────────────────────────────────────────────
    command
        .command("remove <issue> <module>")
        .description("Remove an issue from a module")
        .option("--workspace <slug>", "Workspace slug (overrides active context)")
        .option("--project <identifier>", "Project identifier (overrides active context)")
        .action(async (issueRef, moduleRef, opts) => {
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
            const mod = await resolveModule(client, ws, projectId, moduleRef);
            await client.delete(`workspaces/${ws}/projects/${projectId}/modules/${mod.id}/module-issues/${issueId}/`);
            printInfo(`Issue removed from module "${mod.name}".`);
        }
        catch (err) {
            printError(err instanceof PlaneApiError ? err.message : String(err));
            process.exit(1);
        }
    });
    return command;
}
//# sourceMappingURL=module.js.map