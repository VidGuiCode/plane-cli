import { Command } from "commander";
import { loadConfig, saveConfig, requireActiveAccount, createClient, } from "../core/config-store.js";
import { unwrap } from "../core/api-client.js";
import { printInfo, printTable, printJson } from "../core/output.js";
export function createWorkspaceCommand() {
    const command = new Command("workspace")
        .description("Work with Plane workspaces")
        .action(() => command.help());
    command
        .command("list")
        .description("List available workspaces")
        .option("--json", "Output raw JSON")
        .action(async (opts) => {
        const config = loadConfig();
        const client = createClient(config);
        // Try the API endpoint first; fall back to locally stored account data
        try {
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
        catch {
            // Endpoint not available on this instance — show from saved accounts
        }
        const slugs = config.profiles.map((p) => p.defaultWorkspace).filter((s) => !!s);
        const unique = [...new Set(slugs)];
        if (unique.length === 0) {
            printInfo("No workspaces found. Run: plane login");
            return;
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
    });
    command
        .command("use <workspace>")
        .description("Set the active workspace by slug")
        .action((workspace) => {
        const config = loadConfig();
        requireActiveAccount(config);
        config.context.activeWorkspace = workspace;
        delete config.context.activeProject;
        delete config.context.activeProjectIdentifier;
        saveConfig(config);
        printInfo(`Active workspace set to "${workspace}".`);
    });
    return command;
}
//# sourceMappingURL=workspace.js.map