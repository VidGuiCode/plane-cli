import { Command } from "commander";
import { createClient, getActiveAccount, loadConfig } from "../core/config-store.js";
import { printJson, printInfo } from "../core/output.js";
import { exitWithError } from "../core/errors.js";
export function createProfileCommand() {
    return new Command("profile")
        .description("Show the current authenticated user profile")
        .option("--json", "Output raw JSON")
        .action(async (opts) => {
        try {
            const config = loadConfig();
            const client = createClient(config);
            const account = getActiveAccount(config);
            const user = await client.get("users/me/");
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
                        user: {
                            id: user.id,
                            email: user.email,
                            displayName: user.display_name,
                            firstName: user.first_name ?? null,
                            lastName: user.last_name ?? null,
                            isActive: user.is_active ?? null,
                            role: user.role ?? null,
                        },
                    },
                });
            }
            else {
                printInfo(`User:       ${user.display_name} (${user.email})`);
                printInfo(`ID:         ${user.id}`);
                printInfo(`Status:     ${user.is_active ? "Active" : "Inactive"}`);
                printInfo(`Role:       ${user.role}`);
            }
        }
        catch (err) {
            exitWithError(err, Boolean(opts.json));
        }
    });
}
//# sourceMappingURL=profile.js.map