import { Command } from "commander";
import {
  loadConfig,
  createClient,
  requireActiveWorkspace,
  requireActiveProject,
} from "../core/config-store.js";
import { PlaneApiError, unwrap } from "../core/api-client.js";
import { printInfo, printError, printTable, printJson } from "../core/output.js";
import { resolveProject } from "../core/resolvers.js";
import type { PlaneState } from "../core/types.js";

export function createStateCommand(): Command {
  const command = new Command("state")
    .description("Work with Plane workflow states")
    .action(() => command.help());

  command
    .command("list")
    .description("List workflow states in the active (or specified) project")
    .option("--workspace <slug>", "Workspace slug (overrides active context)")
    .option("--project <identifier>", "Project identifier (overrides active context)")
    .option("--json", "Output raw JSON")
    .action(async (opts: { workspace?: string; project?: string; json?: boolean }) => {
      try {
        const config = loadConfig();
        const client = createClient(config);
        const ws = opts.workspace ?? requireActiveWorkspace(config);

        let projectId: string;
        if (opts.project) {
          const proj = await resolveProject(client, ws, opts.project);
          projectId = proj.id;
        } else {
          projectId = requireActiveProject(config).id;
        }

        const res = await client.get<unknown>(
          `workspaces/${ws}/projects/${projectId}/states/`,
        );
        const states = unwrap<PlaneState>(res);

        if (states.length === 0) {
          printInfo("No states found.");
          return;
        }

        if (opts.json) { printJson(states); return; }

        // Sort by group order
        const groupOrder = ["backlog", "unstarted", "started", "completed", "cancelled"];
        const sorted = [...states].sort(
          (a, b) => groupOrder.indexOf(a.group) - groupOrder.indexOf(b.group),
        );

        const rows = sorted.map((s) => [`  ${s.name}`, s.group, s.color]);
        printTable(rows, ["NAME", "GROUP", "COLOR"]);
      } catch (err) {
        printError(err instanceof PlaneApiError ? err.message : String(err));
        process.exit(1);
      }
    });

  return command;
}
