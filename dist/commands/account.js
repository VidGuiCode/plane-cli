import { Command } from "commander";
import { loadConfig, saveConfig, requireActiveAccount } from "../core/config-store.js";
import { printInfo, printTable, printJson } from "../core/output.js";
import { exitWithError, ValidationError } from "../core/errors.js";
import { isDryRunEnabled } from "../core/runtime.js";
export function createAccountCommand() {
    const command = new Command("account")
        .description("Manage saved Plane accounts")
        .action(() => command.help());
    command
        .command("list")
        .description("List saved accounts")
        .option("--json", "Output raw JSON")
        .action((opts) => {
        const config = loadConfig();
        if (config.profiles.length === 0) {
            printInfo("No accounts saved. Run: plane login");
            return;
        }
        if (opts.json) {
            printJson(config.profiles);
            return;
        }
        const rows = config.profiles.map((p) => [
            p.name === config.context.activeProfile ? `* ${p.name}` : `  ${p.name}`,
            p.baseUrl,
            p.apiStyle,
            p.defaultWorkspace ?? "",
        ]);
        printTable(rows, ["ACCOUNT", "URL", "STYLE", "WORKSPACE"]);
    });
    command
        .command("use <account>")
        .description("Switch the active account")
        .option("--json", "Output raw JSON")
        .action((accountName, opts) => {
        try {
            const config = loadConfig();
            const found = config.profiles.find((p) => p.name === accountName);
            if (!found) {
                throw new ValidationError(`Account "${accountName}" not found. Run: plane account list`);
            }
            const nextContext = {
                activeProfile: accountName,
                activeWorkspace: found.defaultWorkspace ?? null,
                activeProject: null,
                activeProjectIdentifier: null,
            };
            if (isDryRunEnabled()) {
                printJson({
                    dryRun: true,
                    action: "account.use",
                    account: { name: found.name, baseUrl: found.baseUrl, apiStyle: found.apiStyle },
                    nextContext,
                });
                return;
            }
            config.context.activeProfile = accountName;
            if (found.defaultWorkspace) {
                config.context.activeWorkspace = found.defaultWorkspace;
            }
            else {
                delete config.context.activeWorkspace;
            }
            delete config.context.activeProject;
            delete config.context.activeProjectIdentifier;
            saveConfig(config);
            if (opts.json) {
                printJson({
                    success: true,
                    action: "account.use",
                    account: { name: found.name, baseUrl: found.baseUrl, apiStyle: found.apiStyle },
                    context: nextContext,
                });
                return;
            }
            printInfo(`Switched to account "${accountName}".`);
        }
        catch (err) {
            exitWithError(err, Boolean(opts.json));
        }
    });
    command
        .command("remove <account>")
        .description("Remove a saved account")
        .option("--json", "Output raw JSON")
        .action((accountName, opts) => {
        try {
            const config = loadConfig();
            const idx = config.profiles.findIndex((p) => p.name === accountName);
            if (idx < 0) {
                throw new ValidationError(`Account "${accountName}" not found. Run: plane account list`);
            }
            const removed = config.profiles[idx];
            const clearsActive = config.context.activeProfile === accountName;
            const nextContext = clearsActive
                ? {
                    activeProfile: null,
                    activeWorkspace: null,
                    activeProject: null,
                    activeProjectIdentifier: null,
                }
                : {
                    activeProfile: config.context.activeProfile ?? null,
                    activeWorkspace: config.context.activeWorkspace ?? null,
                    activeProject: config.context.activeProject ?? null,
                    activeProjectIdentifier: config.context.activeProjectIdentifier ?? null,
                };
            if (isDryRunEnabled()) {
                printJson({
                    dryRun: true,
                    action: "account.remove",
                    account: { name: removed.name, baseUrl: removed.baseUrl, apiStyle: removed.apiStyle },
                    nextContext,
                });
                return;
            }
            config.profiles.splice(idx, 1);
            if (clearsActive) {
                delete config.context.activeProfile;
                delete config.context.activeWorkspace;
                delete config.context.activeProject;
                delete config.context.activeProjectIdentifier;
            }
            saveConfig(config);
            if (opts.json) {
                printJson({
                    success: true,
                    action: "account.remove",
                    account: { name: removed.name, baseUrl: removed.baseUrl, apiStyle: removed.apiStyle },
                    context: nextContext,
                });
                return;
            }
            printInfo(`Account "${accountName}" removed.`);
        }
        catch (err) {
            exitWithError(err, Boolean(opts.json));
        }
    });
    command
        .command("show")
        .description("Show details of the active account")
        .option("--json", "Output raw JSON")
        .action((opts) => {
        try {
            const config = loadConfig();
            const account = requireActiveAccount(config);
            if (opts.json) {
                printJson(account);
                return;
            }
            printInfo(`Name:      ${account.name}`);
            printInfo(`URL:       ${account.baseUrl}`);
            printInfo(`API style: ${account.apiStyle}`);
            printInfo(`Workspace: ${account.defaultWorkspace ?? "-"}`);
        }
        catch (err) {
            exitWithError(err, Boolean(opts.json));
        }
    });
    return command;
}
//# sourceMappingURL=account.js.map