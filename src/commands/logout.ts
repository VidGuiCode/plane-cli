import { Command } from "commander";
import { loadConfig, saveConfig } from "../core/config-store.js";
import { printInfo, printJson } from "../core/output.js";
import { ask } from "../core/prompt.js";
import { exitWithError, ValidationError } from "../core/errors.js";
import { isDryRunEnabled } from "../core/runtime.js";

export function createLogoutCommand(): Command {
  return new Command("logout")
    .description("Remove a saved account")
    .argument("[account]", "Account name to remove (defaults to active account)")
    .option("--json", "Output raw JSON")
    .action(async (accountArg?: string, opts?: { json?: boolean }) => {
      try {
        const config = loadConfig();

        const targetName = accountArg ?? config.context.activeProfile;
        if (!targetName) {
          throw new ValidationError("No active account. Run: plane login");
        }

        const idx = config.profiles.findIndex((p) => p.name === targetName);
        if (idx < 0) {
          throw new ValidationError(`Account "${targetName}" not found. Run: plane account list`);
        }

        const clearsActive = config.context.activeProfile === targetName;
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
            action: "logout",
            account: targetName,
            context: nextContext,
          });
          return;
        }

        if (clearsActive) {
          const confirm = await ask(`Remove active account "${targetName}"? (y/n)`, "n");
          if (confirm.toLowerCase() !== "y") {
            if (opts?.json) {
              printJson({ success: false, action: "logout", aborted: true, account: targetName });
              return;
            }
            printInfo("Aborted.");
            return;
          }
        }

        config.profiles.splice(idx, 1);

        if (clearsActive) {
          delete config.context.activeProfile;
          delete config.context.activeWorkspace;
          delete config.context.activeProject;
          delete config.context.activeProjectIdentifier;
        }

        saveConfig(config);
        if (opts?.json) {
          printJson({ success: true, action: "logout", account: targetName, context: nextContext });
          return;
        }
        printInfo(`Account "${targetName}" removed.`);
      } catch (err) {
        exitWithError(err, Boolean(opts?.json));
      }
    });
}
