import { Command } from "commander";
import { loadConfig, saveConfig } from "../core/config-store.js";
import { printInfo, printError } from "../core/output.js";
import { ask } from "../core/prompt.js";
export function createLogoutCommand() {
    return new Command("logout")
        .description("Remove a saved account")
        .argument("[account]", "Account name to remove (defaults to active account)")
        .action(async (accountArg) => {
        const config = loadConfig();
        const targetName = accountArg ?? config.context.activeProfile;
        if (!targetName) {
            printError("No active account. Run: plane login");
            process.exit(1);
        }
        const idx = config.profiles.findIndex((p) => p.name === targetName);
        if (idx < 0) {
            printError(`Account "${targetName}" not found. Run: plane account list`);
            process.exit(1);
        }
        if (targetName === config.context.activeProfile) {
            const confirm = await ask(`Remove active account "${targetName}"? (y/n)`, "n");
            if (confirm.toLowerCase() !== "y") {
                printInfo("Aborted.");
                return;
            }
        }
        config.profiles.splice(idx, 1);
        if (config.context.activeProfile === targetName) {
            delete config.context.activeProfile;
            delete config.context.activeWorkspace;
            delete config.context.activeProject;
            delete config.context.activeProjectIdentifier;
        }
        saveConfig(config);
        printInfo(`Account "${targetName}" removed.`);
    });
}
//# sourceMappingURL=logout.js.map