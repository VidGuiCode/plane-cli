import { Command } from "commander";
import { createClient, loadConfig, getActiveAccount } from "../core/config-store.js";
import { printInfo, printJson } from "../core/output.js";
import { exitWithError } from "../core/errors.js";
export function createWhereCommand() {
    return new Command("where")
        .description("Show current account, workspace, and project context")
        .option("--json", "Output raw JSON")
        .action(async (opts) => {
        try {
            const config = loadConfig();
            const account = getActiveAccount(config);
            const client = account ? createClient(config) : null;
            const user = client
                ? await client.get("users/me/")
                : null;
            if (opts.json) {
                printJson({
                    schemaVersion: 1,
                    kind: "context",
                    context: {
                        account: account
                            ? {
                                name: account.name,
                                baseUrl: account.baseUrl,
                                apiStyle: account.apiStyle,
                            }
                            : null,
                        workspace: config.context.activeWorkspace
                            ? { slug: config.context.activeWorkspace }
                            : null,
                        project: config.context.activeProject
                            ? {
                                id: config.context.activeProject,
                                identifier: config.context.activeProjectIdentifier ?? null,
                                name: null,
                            }
                            : null,
                        user: user
                            ? {
                                id: user.id,
                                email: user.email,
                                displayName: user.display_name,
                                firstName: user.first_name ?? null,
                                lastName: user.last_name ?? null,
                                isActive: user.is_active ?? null,
                                role: user.role ?? null,
                            }
                            : null,
                    },
                });
                return;
            }
            printInfo(`Account:   ${account ? `${account.name}  (${account.baseUrl})` : "-"}`);
            printInfo(`Workspace: ${config.context.activeWorkspace ?? "-"}`);
            if (config.context.activeProject) {
                const id = config.context.activeProjectIdentifier ?? config.context.activeProject;
                printInfo(`Project:   ${id}`);
            }
            else {
                printInfo(`Project:   -`);
            }
        }
        catch (err) {
            exitWithError(err, Boolean(opts.json));
        }
    });
}
//# sourceMappingURL=where.js.map