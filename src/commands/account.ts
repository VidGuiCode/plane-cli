import { Command } from "commander";
import { loadConfig, saveConfig, requireActiveAccount } from "../core/config-store.js";
import { printInfo, printError, printTable, printJson } from "../core/output.js";

export function createAccountCommand(): Command {
  const command = new Command("account")
    .description("Manage saved Plane accounts")
    .action(() => command.help());

  command
    .command("list")
    .description("List saved accounts")
    .option("--json", "Output raw JSON")
    .action((opts: { json?: boolean }) => {
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
    .action((accountName: string) => {
      const config = loadConfig();
      const found = config.profiles.find((p) => p.name === accountName);
      if (!found) {
        printError(`Account "${accountName}" not found. Run: plane account list`);
        process.exit(1);
      }
      config.context.activeProfile = accountName;
      if (found.defaultWorkspace) {
        config.context.activeWorkspace = found.defaultWorkspace;
      }
      delete config.context.activeProject;
      delete config.context.activeProjectIdentifier;
      saveConfig(config);
      printInfo(`Switched to account "${accountName}".`);
    });

  command
    .command("remove <account>")
    .description("Remove a saved account")
    .action((accountName: string) => {
      const config = loadConfig();
      const idx = config.profiles.findIndex((p) => p.name === accountName);
      if (idx < 0) {
        printError(`Account "${accountName}" not found. Run: plane account list`);
        process.exit(1);
      }
      config.profiles.splice(idx, 1);
      if (config.context.activeProfile === accountName) {
        delete config.context.activeProfile;
        delete config.context.activeWorkspace;
        delete config.context.activeProject;
        delete config.context.activeProjectIdentifier;
      }
      saveConfig(config);
      printInfo(`Account "${accountName}" removed.`);
    });

  command
    .command("show")
    .description("Show details of the active account")
    .action(() => {
      const config = loadConfig();
      const account = requireActiveAccount(config);
      printInfo(`Name:      ${account.name}`);
      printInfo(`URL:       ${account.baseUrl}`);
      printInfo(`API style: ${account.apiStyle}`);
      printInfo(`Workspace: ${account.defaultWorkspace ?? "-"}`);
    });

  return command;
}
