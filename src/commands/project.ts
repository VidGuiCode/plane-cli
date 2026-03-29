import { Command } from "commander";
import {
  loadConfig,
  saveConfig,
  createClient,
  requireActiveWorkspace,
  requireActiveProject,
} from "../core/config-store.js";
import { unwrap } from "../core/api-client.js";
import { printInfo, printTable, printJson } from "../core/output.js";
import { exitWithError, ValidationError } from "../core/errors.js";
import { isDryRunEnabled } from "../core/runtime.js";
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

        if (opts.json) {
          printJson(projects);
          return;
        }

        const rows = projects.map((p) => [
          p.id === config.context.activeProject ? `* ${p.identifier}` : `  ${p.identifier}`,
          p.name,
          `${p.total_members} members`,
          p.total_modules > 0 ? `${p.total_modules} modules` : "",
        ]);
        printTable(rows, ["PROJECT", "NAME", "MEMBERS", "MODULES"]);
      } catch (err) {
        exitWithError(err, Boolean(opts.json));
      }
    });

  command
    .command("use <project>")
    .description("Set the active project by identifier or name (e.g. CYL)")
    .option("--json", "Output raw JSON")
    .action(async (project: string, opts: { json?: boolean }) => {
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
          throw new ValidationError(`Project "${project}" not found. Run: plane project list`);
        }

        const nextContext = {
          activeProfile: config.context.activeProfile ?? null,
          activeWorkspace: ws,
          activeProject: match.id,
          activeProjectIdentifier: match.identifier,
        };

        if (isDryRunEnabled()) {
          printJson({
            dryRun: true,
            action: "project.use",
            project: {
              id: match.id,
              identifier: match.identifier,
              name: match.name,
            },
            nextContext,
          });
          return;
        }

        config.context.activeProject = match.id;
        config.context.activeProjectIdentifier = match.identifier;
        saveConfig(config);

        if (opts.json) {
          printJson({
            success: true,
            action: "project.use",
            project: {
              id: match.id,
              identifier: match.identifier,
              name: match.name,
            },
            context: nextContext,
          });
          return;
        }

        printInfo(`Active project set to "${match.name}" (${match.identifier}).`);
      } catch (err) {
        exitWithError(err, Boolean(opts.json));
      }
    });

  command
    .command("show")
    .description("Show details of the active project")
    .option("--json", "Output raw JSON")
    .action(async (opts: { json?: boolean }) => {
      try {
        const config = loadConfig();
        const client = createClient(config);
        const ws = requireActiveWorkspace(config);
        const { id: projectId, identifier } = requireActiveProject(config);

        const project = await client.get<PlaneProject>(`workspaces/${ws}/projects/${projectId}/`);
        if (opts.json) {
          printJson(project);
          return;
        }
        printInfo(`${identifier}  ${project.name}`);
        printInfo(`Description: ${project.description || "-"}`);
        printInfo(`Members:     ${project.total_members}`);
        printInfo(`Modules:     ${project.total_modules}`);
        printInfo(`Cycles:      ${project.total_cycles}`);
      } catch (err) {
        exitWithError(err, Boolean(opts.json));
      }
    });

  return command;
}
