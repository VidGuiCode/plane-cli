import { Command } from "commander";
import { loadConfig, saveConfig, createClient, requireActiveWorkspace, requireActiveProject, } from "../core/config-store.js";
import { unwrap } from "../core/api-client.js";
import { printInfo, printTable, printJson } from "../core/output.js";
import { exitWithError, ValidationError } from "../core/errors.js";
import { isDryRunEnabled, isNonInteractiveMode } from "../core/runtime.js";
import { ask } from "../core/prompt.js";
export function createProjectCommand() {
    const command = new Command("project")
        .description("Work with Plane projects")
        .action(() => command.help());
    command
        .command("list")
        .description("List projects in the active (or specified) workspace")
        .option("--workspace <slug>", "Workspace slug (overrides active context)")
        .option("--json", "Output raw JSON")
        .action(async (opts) => {
        try {
            const config = loadConfig();
            const client = createClient(config);
            const ws = opts.workspace ?? requireActiveWorkspace(config);
            const res = await client.get(`workspaces/${ws}/projects/`);
            const projects = unwrap(res);
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
        }
        catch (err) {
            exitWithError(err, Boolean(opts.json));
        }
    });
    command
        .command("use <project>")
        .description("Set the active project by identifier or name (e.g. CYL)")
        .option("--json", "Output raw JSON")
        .action(async (project, opts) => {
        try {
            const config = loadConfig();
            const client = createClient(config);
            const ws = requireActiveWorkspace(config);
            const res = await client.get(`workspaces/${ws}/projects/`);
            const projects = unwrap(res);
            const match = projects.find((p) => p.identifier.toLowerCase() === project.toLowerCase() ||
                p.name.toLowerCase() === project.toLowerCase());
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
        }
        catch (err) {
            exitWithError(err, Boolean(opts.json));
        }
    });
    command
        .command("show")
        .description("Show details of the active project")
        .option("--json", "Output raw JSON")
        .action(async (opts) => {
        try {
            const config = loadConfig();
            const client = createClient(config);
            const ws = requireActiveWorkspace(config);
            const { id: projectId, identifier } = requireActiveProject(config);
            const project = await client.get(`workspaces/${ws}/projects/${projectId}/`);
            if (opts.json) {
                printJson(project);
                return;
            }
            printInfo(`${identifier}  ${project.name}`);
            printInfo(`Description: ${project.description || "-"}`);
            printInfo(`Members:     ${project.total_members}`);
            printInfo(`Modules:     ${project.total_modules}`);
            printInfo(`Cycles:      ${project.total_cycles}`);
        }
        catch (err) {
            exitWithError(err, Boolean(opts.json));
        }
    });
    // ── create ─────────────────────────────────────────────────────────────────
    command
        .command("create <name>")
        .description("Create a new project in the active workspace")
        .option("--identifier <id>", "Project identifier (2-12 uppercase letters/digits, must be unique)")
        .option("--description <text>", "Project description")
        .option("--network <type>", "Network visibility: 0=public, 2=private (default: 2)")
        .option("--workspace <slug>", "Workspace slug (overrides active context)")
        .option("--json", "Output raw JSON")
        .action(async (name, opts) => {
        try {
            const config = loadConfig();
            const client = createClient(config);
            const ws = opts.workspace ?? requireActiveWorkspace(config);
            const identifier = opts.identifier ??
                (await ask("Project identifier (e.g. PROJ)", name
                    .toUpperCase()
                    .replace(/[^A-Z0-9]/g, "")
                    .slice(0, 12)));
            if (!identifier) {
                throw new ValidationError("--identifier is required");
            }
            const network = opts.network !== undefined ? parseInt(opts.network, 10) : 2;
            if (network !== 0 && network !== 2) {
                throw new ValidationError("--network must be 0 (public) or 2 (private)");
            }
            const body = {
                name,
                identifier: identifier.toUpperCase(),
                network,
            };
            if (opts.description)
                body.description = opts.description;
            const path = `workspaces/${ws}/projects/`;
            if (isDryRunEnabled()) {
                printJson({ dryRun: true, method: "POST", path, body });
                return;
            }
            const project = await client.post(path, body);
            if (opts.json) {
                printJson(project);
                return;
            }
            printInfo(`Project "${project.name}" (${project.identifier}) created.`);
            // Offer to set as active project in interactive mode
            if (!isNonInteractiveMode()) {
                const answer = await ask("Set as active project? [Y/n]", "y");
                if (answer.toLowerCase() !== "n") {
                    config.context.activeProject = project.id;
                    config.context.activeProjectIdentifier = project.identifier;
                    saveConfig(config);
                    printInfo(`Active project set to "${project.name}" (${project.identifier}).`);
                }
            }
        }
        catch (err) {
            exitWithError(err, Boolean(opts.json));
        }
    });
    // ── update ─────────────────────────────────────────────────────────────────
    command
        .command("update")
        .description("Update the active project's name, description, or network visibility")
        .option("--name <name>", "New project name")
        .option("--description <text>", "New project description")
        .option("--network <type>", "Network visibility: 0=public, 2=private")
        .option("--workspace <slug>", "Workspace slug (overrides active context)")
        .option("--json", "Output raw JSON")
        .action(async (opts) => {
        try {
            if (!opts.name && opts.description === undefined && opts.network === undefined) {
                throw new ValidationError("At least one of --name, --description, or --network must be provided.");
            }
            const config = loadConfig();
            const client = createClient(config);
            const ws = opts.workspace ?? requireActiveWorkspace(config);
            const { id: projectId, identifier } = requireActiveProject(config);
            const body = {};
            if (opts.name)
                body.name = opts.name;
            if (opts.description !== undefined)
                body.description = opts.description;
            if (opts.network !== undefined) {
                const network = parseInt(opts.network, 10);
                if (network !== 0 && network !== 2) {
                    throw new ValidationError("--network must be 0 (public) or 2 (private)");
                }
                body.network = network;
            }
            const path = `workspaces/${ws}/projects/${projectId}/`;
            if (isDryRunEnabled()) {
                printJson({
                    dryRun: true,
                    method: "PATCH",
                    path,
                    body,
                    context: { workspace: ws, projectId, identifier },
                });
                return;
            }
            const project = await client.patch(path, body);
            if (opts.json) {
                printJson(project);
                return;
            }
            printInfo(`Project "${identifier}" updated.`);
        }
        catch (err) {
            exitWithError(err, Boolean(opts.json));
        }
    });
    return command;
}
//# sourceMappingURL=project.js.map