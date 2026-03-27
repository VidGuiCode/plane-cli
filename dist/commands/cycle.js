import { Command } from "commander";
import { loadConfig, createClient, requireActiveWorkspace, requireActiveProject, } from "../core/config-store.js";
import { PlaneApiError, unwrap, fetchAll } from "../core/api-client.js";
import { printInfo, printError, printTable, printJson } from "../core/output.js";
import { resolveProject, resolveIssueRef, resolveCycle, buildStateMap, resolveState, } from "../core/resolvers.js";
export function createCycleCommand() {
    const command = new Command("cycle")
        .description("Work with Plane cycles (sprints)")
        .action(() => command.help());
    // ── list ──────────────────────────────────────────────────────────────────
    command
        .command("list")
        .description("List cycles in the active (or specified) project")
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
            const cycles = await fetchAll(client, `workspaces/${ws}/projects/${projectId}/cycles/`);
            if (cycles.length === 0) {
                printInfo("No cycles found.");
                return;
            }
            if (opts.json) {
                printJson(cycles);
                return;
            }
            const rows = cycles.map((c) => [
                `  ${c.name}`,
                c.status ?? "",
                c.start_date ?? "",
                c.end_date ?? "",
            ]);
            printTable(rows, ["NAME", "STATUS", "START", "END"]);
        }
        catch (err) {
            printError(err instanceof PlaneApiError ? err.message : String(err));
            process.exit(1);
        }
    });
    // ── issues ────────────────────────────────────────────────────────────────
    command
        .command("issues <cycle>")
        .description("List issues in a cycle (name or UUID)")
        .option("--workspace <slug>", "Workspace slug (overrides active context)")
        .option("--project <identifier>", "Project identifier (overrides active context)")
        .option("--json", "Output raw JSON")
        .action(async (cycleRef, opts) => {
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
            const cycle = await resolveCycle(client, ws, projectId, cycleRef);
            const [issues, stateMap] = await Promise.all([
                fetchAll(client, `workspaces/${ws}/projects/${projectId}/cycles/${cycle.id}/issues/`),
                client
                    .get(`workspaces/${ws}/projects/${projectId}/states/`)
                    .then((r) => buildStateMap(unwrap(r))),
            ]);
            if (issues.length === 0) {
                printInfo(`No issues in cycle "${cycle.name}".`);
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
    // ── add ───────────────────────────────────────────────────────────────────
    command
        .command("add <issue> <cycle>")
        .description("Add an issue to a cycle. Issue: 42, PROJ-42, or UUID. Cycle: name or UUID")
        .option("--workspace <slug>", "Workspace slug (overrides active context)")
        .option("--project <identifier>", "Project identifier (overrides active context)")
        .action(async (issueRef, cycleRef, opts) => {
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
            const cycle = await resolveCycle(client, ws, projectId, cycleRef);
            await client.post(`workspaces/${ws}/projects/${projectId}/cycles/${cycle.id}/issues/`, { issues: [issueId] });
            printInfo(`Issue added to cycle "${cycle.name}".`);
        }
        catch (err) {
            printError(err instanceof PlaneApiError ? err.message : String(err));
            process.exit(1);
        }
    });
    // ── remove ────────────────────────────────────────────────────────────────
    command
        .command("remove <issue> <cycle>")
        .description("Remove an issue from a cycle")
        .option("--workspace <slug>", "Workspace slug (overrides active context)")
        .option("--project <identifier>", "Project identifier (overrides active context)")
        .action(async (issueRef, cycleRef, opts) => {
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
            const cycle = await resolveCycle(client, ws, projectId, cycleRef);
            await client.delete(`workspaces/${ws}/projects/${projectId}/cycles/${cycle.id}/issues/${issueId}/`);
            printInfo(`Issue removed from cycle "${cycle.name}".`);
        }
        catch (err) {
            printError(err instanceof PlaneApiError ? err.message : String(err));
            process.exit(1);
        }
    });
    return command;
}
//# sourceMappingURL=cycle.js.map