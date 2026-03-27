import { Command } from "commander";
import { loadConfig, getActiveAccount } from "../core/config-store.js";
import { printInfo } from "../core/output.js";
export function createWhereCommand() {
    return new Command("where")
        .description("Show current account, workspace, and project context")
        .action(() => {
        const config = loadConfig();
        const account = getActiveAccount(config);
        printInfo(`Account:   ${account ? `${account.name}  (${account.baseUrl})` : "-"}`);
        printInfo(`Workspace: ${config.context.activeWorkspace ?? "-"}`);
        if (config.context.activeProject) {
            const id = config.context.activeProjectIdentifier ?? config.context.activeProject;
            printInfo(`Project:   ${id}`);
        }
        else {
            printInfo(`Project:   -`);
        }
    });
}
//# sourceMappingURL=where.js.map