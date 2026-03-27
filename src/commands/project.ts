import { Command } from "commander";
import {
  loadConfig,
  saveConfig,
  createClient,
  requireActiveWorkspace,
  requireActiveProject,
} from "../core/config-store.js";
import { PlaneApiError, unwrap } from "../core/api-client.js";
import { printInfo, printError, printTable, printJson } from "../core/output.js";
import type { PlaneProject } from "../core/types.js";

export function createProjectCommand(): Command {
  const command = new Command("project")
    .description("Work with Plane projects")
    .action(() => command.help());

  command
    .command("list")
    .description("List projects in the active (or specified) workspace")
    .option("--workspace <slug>", "Workspace slug (overrides active context)")
    .option("--json", "Output raw JSON")
    .action(async (opts: { workspace?: string; json?: boolean }) => {
      try {
        const config = loadConfig();
        const client = createClient(config);
        const ws = opts.workspace ?? requireActiveWorkspace(config);

        const res = await client.get<unknown>(`workspaces/${ws}/projects/`);
        const projects = unwrap<PlaneProject>(res);

        if (projects.length === 0) {
          printInfo("No projects found.");
          return;
        }

        if (opts.json) { printJson(projects); return; }

        const rows = projects.map((p) => [
          p.id === config.context.activeProject ? `* ${p.identifier}` : `  ${p.identifier}`,
          p.name,
          `${p.total_members} members`,
          p.total_modules > 0 ? `${p.total_modules} modules` : "",
        ]);
        printTable(rows, ["PROJECT", "NAME", "MEMBERS", "MODULES"]);
      } catch (err) {
        printError(err instanceof PlaneApiError ? err.message : String(err));
        process.exit(1);
      }
    });

  command
    .command("use <project>")
    .description("Set the active project by identifier or name (e.g. CYL)")
    .action(async (project: string) => {
      try {
        const config = loadConfig();
        const client = createClient(config);
        const ws = requireActiveWorkspace(config);

        const res = await client.get<unknown>(`workspaces/${ws}/projects/`);
        const projects = unwrap<PlaneProject>(res);

        const match = projects.find(
          (p) =>
            p.identifier.toLowerCase() === project.toLowerCase() ||
            p.name.toLowerCase() === project.toLowerCase(),
        );

        if (!match) {
          printError(`Project "${project}" not found. Run: plane project list`);
          process.exit(1);
        }

        config.context.activeProject = match.id;
        config.context.activeProjectIdentifier = match.identifier;
        saveConfig(config);
        printInfo(`Active project set to "${match.name}" (${match.identifier}).`);
      } catch (err) {
        printError(err instanceof PlaneApiError ? err.message : String(err));
        process.exit(1);
      }
    });

  command
    .command("show")
    .description("Show details of the active project")
    .action(async () => {
      try {
        const config = loadConfig();
        const client = createClient(config);
        const ws = requireActiveWorkspace(config);
        const { id: projectId, identifier } = requireActiveProject(config);

        const project = await client.get<PlaneProject>(
          `workspaces/${ws}/projects/${projectId}/`,
        );
        printInfo(`${identifier}  ${project.name}`);
        printInfo(`Description: ${project.description || "-"}`);
        printInfo(`Members:     ${project.total_members}`);
        printInfo(`Modules:     ${project.total_modules}`);
        printInfo(`Cycles:      ${project.total_cycles}`);
      } catch (err) {
        printError(err instanceof PlaneApiError ? err.message : String(err));
        process.exit(1);
      }
    });

  return command;
}
