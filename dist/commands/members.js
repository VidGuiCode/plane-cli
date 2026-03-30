import { Command } from "commander";
import { loadConfig, createClient, requireActiveWorkspace } from "../core/config-store.js";
import { fetchAll } from "../core/api-client.js";
import { printInfo, printTable, printJson } from "../core/output.js";
import { exitWithError } from "../core/errors.js";
import { getMemberDisplayName, getMemberEmail } from "../core/resolvers.js";
const ROLE_NAMES = {
    5: "Owner",
    10: "Admin",
    15: "Member",
    20: "Viewer",
};
export function createMembersCommand() {
    const command = new Command("members")
        .description("Work with workspace members")
        .action(() => command.help());
    command
        .command("list")
        .description("List members of the active workspace")
        .option("--workspace <slug>", "Workspace slug (overrides active context)")
        .option("--json", "Output raw JSON")
        .action(async (opts) => {
        try {
            const config = loadConfig();
            const client = createClient(config);
            const ws = opts.workspace ?? requireActiveWorkspace(config);
            const members = await fetchAll(client, `workspaces/${ws}/members/`);
            if (members.length === 0) {
                printInfo("No members found.");
                return;
            }
            if (opts.json) {
                printJson(members);
                return;
            }
            const rows = members.map((m) => [
                `  ${getMemberDisplayName(m)}`,
                getMemberEmail(m) ?? "",
                ROLE_NAMES[m.role] ?? String(m.role),
            ]);
            printTable(rows, ["NAME", "EMAIL", "ROLE"]);
        }
        catch (err) {
            exitWithError(err, Boolean(opts.json));
        }
    });
    return command;
}
//# sourceMappingURL=members.js.map