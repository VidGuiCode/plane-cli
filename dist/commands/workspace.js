import { Command } from "commander";
import { loadConfig, saveConfig, requireActiveAccount, createClient, } from "../core/config-store.js";
import { unwrap } from "../core/api-client.js";
import { printInfo, printTable, printJson } from "../core/output.js";
import { exitWithError, ValidationError } from "../core/errors.js";
import { isDryRunEnabled } from "../core/runtime.js";
export function createWorkspaceCommand() {
    const command = new Command("workspace")
        .description("Work with Plane workspaces")
        .action(() => command.help());
    command
        .command("list")
        .description("List available workspaces")
        .option("--json", "Output raw JSON")
        .action(async (opts) => {
        try {
            const config = loadConfig();
            const client = createClient(config);
            // Try the API endpoint first; fall back to locally stored account data
            const res = await client.get("workspaces/");
            const workspaces = unwrap(res);
            if (workspaces.length > 0) {
                if (opts.json) {
                    printJson(workspaces);
                    return;
                }
                const rows = workspaces.map((w) => [
                    w.slug === config.context.activeWorkspace ? `* ${w.slug}` : `  ${w.slug}`,
                    w.name,
                ]);
                printTable(rows, ["WORKSPACE", "NAME"]);
                return;
            }
        }
        catch (err) {
            const config = loadConfig();
            if (opts.json) {
                // allow fallback below if possible; otherwise preserve structured error on failure
            }
            const slugs = config.profiles
                .map((p) => p.defaultWorkspace)
                .filter((s) => !!s);
            const unique = [...new Set(slugs)];
            if (unique.length === 0) {
                exitWithError(err, Boolean(opts.json));
            }
            if (opts.json) {
                printJson(unique.map((slug) => ({ slug })));
                return;
            }
            const rows = unique.map((slug) => [
                slug === config.context.activeWorkspace ? `* ${slug}` : `  ${slug}`,
                "",
            ]);
            printTable(rows, ["WORKSPACE", "NAME"]);
        }
    });
    command
        .command("use <workspace>")
        .description("Set the active workspace by slug")
        .option("--json", "Output raw JSON")
        .action((workspace, opts) => {
        try {
            const config = loadConfig();
            requireActiveAccount(config);
            if (!workspace.trim()) {
                throw new ValidationError("Workspace slug is required.");
            }
            const nextContext = {
                activeProfile: config.context.activeProfile ?? null,
                activeWorkspace: workspace,
                activeProject: null,
                activeProjectIdentifier: null,
            };
            if (isDryRunEnabled()) {
                printJson({
                    dryRun: true,
                    action: "workspace.use",
                    nextContext,
                });
                return;
            }
            config.context.activeWorkspace = workspace;
            delete config.context.activeProject;
            delete config.context.activeProjectIdentifier;
            saveConfig(config);
            if (opts.json) {
                printJson({ success: true, action: "workspace.use", context: nextContext });
                return;
            }
            printInfo(`Active workspace set to "${workspace}".`);
        }
        catch (err) {
            exitWithError(err, Boolean(opts.json));
        }
    });
    return command;
}
//# sourceMappingURL=workspace.js.map