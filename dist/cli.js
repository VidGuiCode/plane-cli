#!/usr/bin/env node
import { createRequire } from "node:module";
import { Command } from "commander";
import { createCompletionCommand } from "./commands/completion.js";
import { createLoginCommand } from "./commands/login.js";
import { createLogoutCommand } from "./commands/logout.js";
import { createAccountCommand } from "./commands/account.js";
import { createWhereCommand } from "./commands/where.js";
import { createMembersCommand } from "./commands/members.js";
import { createWorkspaceCommand } from "./commands/workspace.js";
import { createProjectCommand } from "./commands/project.js";
import { createIssueCommand } from "./commands/issue.js";
import { createModuleCommand } from "./commands/module.js";
import { createLabelCommand } from "./commands/label.js";
import { createCommentCommand } from "./commands/comment.js";
import { createCycleCommand } from "./commands/cycle.js";
import { createPageCommand } from "./commands/page.js";
import { createStateCommand } from "./commands/state.js";
import { createDiscoverCommand } from "./commands/discover.js";
import { createProfileCommand } from "./commands/profile.js";
import { createUpgradeCommand, fetchLatestVersion, isNewer } from "./commands/upgrade.js";
import { configureHelp } from "./core/help.js";
const require = createRequire(import.meta.url);
const pkg = require("../package.json");
const SPLASH = `
        ██████████
        ██████████   plane-cli
    ████    ██████   Unofficial CLI for Plane
    ████    ██████   v${pkg.version}
        ████
        ████
`;
const program = new Command();
program
    .name("plane")
    .description("Unofficial CLI for Plane")
    .option("--dry-run", "Resolve and validate a mutating command without sending it")
    .option("--no-interactive", "Fail instead of prompting for missing input")
    .option("--compact", "Output compact JSON without indentation (for AI/agents)")
    .version(pkg.version)
    .helpCommand(true) // Commander.js v13: action() suppresses implicit help command; re-enable it
    .action(async () => {
    console.log(SPLASH);
    // Silent update check — 1.5s timeout so it never blocks
    const latest = await Promise.race([
        fetchLatestVersion(),
        new Promise((resolve) => setTimeout(() => resolve(null), 1500)),
    ]);
    if (latest && isNewer(latest, pkg.version)) {
        console.log(`  Update available v${latest}  ·  run: plane upgrade\n`);
    }
    console.log(`  AI start: plane discover context\n`);
    program.help();
});
program.addCommand(createLoginCommand());
program.addCommand(createLogoutCommand());
program.addCommand(createCompletionCommand(program));
program.addCommand(createAccountCommand());
program.addCommand(createWhereCommand());
program.addCommand(createDiscoverCommand());
program.addCommand(createMembersCommand());
program.addCommand(createWorkspaceCommand());
program.addCommand(createProjectCommand());
program.addCommand(createIssueCommand());
program.addCommand(createModuleCommand());
program.addCommand(createLabelCommand());
program.addCommand(createCommentCommand());
program.addCommand(createCycleCommand());
program.addCommand(createPageCommand());
program.addCommand(createStateCommand());
program.addCommand(createUpgradeCommand());
program.addCommand(createProfileCommand());
// Apply after all commands are registered so the recursion covers every subcommand
configureHelp(program);
program.parseAsync(process.argv);
//# sourceMappingURL=cli.js.map