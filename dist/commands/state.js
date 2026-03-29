import { Command } from "commander";
import { loadConfig, createClient, requireActiveWorkspace, requireActiveProject, } from "../core/config-store.js";
import { unwrap } from "../core/api-client.js";
import { printInfo, printTable, printJson } from "../core/output.js";
import { exitWithError } from "../core/errors.js";
import { resolveProject } from "../core/resolvers.js";
export function createStateCommand() {
    const command = new Command("state")
        .description("Work with Plane workflow states")
        .action(() => command.help());
    command
        .command("list")
        .description("List workflow states in the active (or specified) project")
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
            const res = await client.get(`workspaces/${ws}/projects/${projectId}/states/`);
            const states = unwrap(res);
            if (states.length === 0) {
                printInfo("No states found.");
                return;
            }
            if (opts.json) {
                printJson(states);
                return;
            }
            // Sort by group order
            const groupOrder = ["backlog", "unstarted", "started", "completed", "cancelled"];
            const sorted = [...states].sort((a, b) => groupOrder.indexOf(a.group) - groupOrder.indexOf(b.group));
            const rows = sorted.map((s) => [`  ${s.name}`, s.group, s.color]);
            printTable(rows, ["NAME", "GROUP", "COLOR"]);
        }
        catch (err) {
            exitWithError(err, Boolean(opts.json));
        }
    });
    return command;
}
//# sourceMappingURL=state.js.map