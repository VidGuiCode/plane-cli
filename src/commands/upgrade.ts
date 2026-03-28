import { Command } from "commander";
import { createRequire } from "node:module";
import { spawnSync } from "node:child_process";
import { printInfo, printError } from "../core/output.js";

const require = createRequire(import.meta.url);
const pkg = require("../../package.json") as { version: string };

const REPO_RAW = "https://raw.githubusercontent.com/VidGuiCode/plane-cli/main/package.json";
const INSTALL_CMD = "github:VidGuiCode/plane-cli";

export async function fetchLatestVersion(): Promise<string | null> {
  try {
    const res = await fetch(REPO_RAW);
    if (!res.ok) return null;
    const data = (await res.json()) as { version?: string };
    return data.version ?? null;
  } catch {
    return null;
  }
}

export function isNewer(remote: string, current: string): boolean {
  const parse = (v: string) => v.replace(/^v/, "").split(".").map(Number);
  const [rMaj = 0, rMin = 0, rPatch = 0] = parse(remote);
  const [cMaj = 0, cMin = 0, cPatch = 0] = parse(current);
  if (rMaj !== cMaj) return rMaj > cMaj;
  if (rMin !== cMin) return rMin > cMin;
  return rPatch > cPatch;
}

export function createUpgradeCommand(): Command {
  return new Command("upgrade")
    .description("Check for updates and upgrade to the latest version")
    .action(async () => {
      printInfo("Checking for updates...");

      const latest = await fetchLatestVersion();
      if (!latest) {
        printError("Could not reach GitHub to check for updates.");
        process.exit(1);
      }

      printInfo(`Current version : v${pkg.version}`);
      printInfo(`Latest version  : v${latest}`);

      if (!isNewer(latest, pkg.version)) {
        printInfo("Already on the latest version.");
        return;
      }

      printInfo(`Upgrading...    npm install -g ${INSTALL_CMD}`);
      console.log("");

      const result = spawnSync("npm", ["install", "-g", INSTALL_CMD], {
        stdio: "inherit",
        shell: true,
      });

      if (result.status !== 0) {
        printError(`Upgrade failed. Try running manually: npm install -g ${INSTALL_CMD}`);
        process.exit(1);
      }

      console.log("");
      printInfo(`Upgraded to v${latest}.`);
    });
}
