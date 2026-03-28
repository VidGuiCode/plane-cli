import type { Command, Help } from "commander";

const RULE = 52; // chars of rule content after the 2-char indent

const HELP_CONFIG = {
  formatHelp(cmd: Command, helper: Help): string {
    const lines: string[] = [""];

    // Usage + description
    lines.push(`  ${helper.commandUsage(cmd)}`);
    const desc = helper.commandDescription(cmd);
    if (desc) lines.push(`  ${desc}`);
    lines.push("");

    // Arguments
    const args = helper.visibleArguments(cmd);
    if (args.length > 0) {
      rule(lines, "Arguments");
      const tw = Math.max(...args.map((a) => helper.argumentTerm(a).length));
      for (const a of args) {
        lines.push(`    ${helper.argumentTerm(a).padEnd(tw)}   ${helper.argumentDescription(a)}`);
      }
      lines.push("");
    }

    // Subcommands
    const cmds = helper.visibleCommands(cmd);
    if (cmds.length > 0) {
      rule(lines, "Commands");
      const tw = Math.max(...cmds.map((c) => helper.subcommandTerm(c).length));
      for (const sub of cmds) {
        lines.push(
          `    ${helper.subcommandTerm(sub).padEnd(tw)}   ${helper.subcommandDescription(sub)}`,
        );
      }
      lines.push("");
    }

    // Options
    const opts = helper.visibleOptions(cmd);
    if (opts.length > 0) {
      rule(lines, "Options");
      const tw = Math.max(...opts.map((o) => helper.optionTerm(o).length));
      for (const opt of opts) {
        lines.push(`    ${helper.optionTerm(opt).padEnd(tw)}   ${helper.optionDescription(opt)}`);
      }
      lines.push("");
    }

    lines.push("");
    return lines.join("\n");
  },
};

/** Apply custom help formatter to a command and all its subcommands recursively. */
export function configureHelp(cmd: Command): void {
  cmd.configureHelp(HELP_CONFIG);
  for (const sub of cmd.commands) {
    configureHelp(sub);
  }
}

function rule(lines: string[], label: string): void {
  const prefix = `── ${label} `;
  lines.push(`  ${prefix}${"─".repeat(Math.max(0, RULE - prefix.length))}`);
  lines.push("");
}
