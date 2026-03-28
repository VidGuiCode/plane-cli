import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import type { PlaneConfig, PlaneAccount } from "./types.js";
import { PlaneApiClient } from "./api-client.js";
import { printError } from "./output.js";

export const DEFAULT_CONFIG: PlaneConfig = {
  profiles: [],
  context: {},
};

export function getConfigDir(): string {
  return path.join(os.homedir(), ".plane-cli");
}

export function getConfigPath(): string {
  if (process.env.PLANE_CONFIG) {
    return process.env.PLANE_CONFIG;
  }
  return path.join(getConfigDir(), "config.json");
}

export function loadConfig(): PlaneConfig {
  const configPath = getConfigPath();
  if (!fs.existsSync(configPath)) {
    return { profiles: [], context: {} };
  }
  try {
    return JSON.parse(fs.readFileSync(configPath, "utf-8")) as PlaneConfig;
  } catch {
    return { profiles: [], context: {} };
  }
}

export function saveConfig(config: PlaneConfig): void {
  const dir = getConfigDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2), "utf-8");
}

export function getActiveAccount(config: PlaneConfig): PlaneAccount | undefined {
  return config.profiles.find((p) => p.name === config.context.activeProfile);
}

export function requireActiveAccount(config: PlaneConfig): PlaneAccount {
  const account = getActiveAccount(config);
  if (!account) {
    printError("No active account. Run: plane login");
    process.exit(1);
  }
  return account;
}

// Backward-compat alias
export const requireActiveProfile = requireActiveAccount;

export function requireActiveWorkspace(config: PlaneConfig): string {
  const ws = process.env.PLANE_WORKSPACE ?? config.context.activeWorkspace;
  if (!ws) {
    printError("No active workspace. Run: plane workspace use <slug>");
    process.exit(1);
  }
  return ws;
}

export function requireActiveProject(config: PlaneConfig): { id: string; identifier: string } {
  const id = config.context.activeProject;
  if (!id) {
    printError("No active project. Run: plane project use <identifier>");
    process.exit(1);
  }
  return { id, identifier: config.context.activeProjectIdentifier ?? "" };
}

export function createClient(config: PlaneConfig): PlaneApiClient {
  const envUrl = process.env.PLANE_BASE_URL;
  const envToken = process.env.PLANE_API_TOKEN;

  // Pure CI path: both env vars set — no config file needed
  if (envUrl && envToken) {
    return new PlaneApiClient({
      baseUrl: envUrl,
      token: envToken,
      apiStyle: (process.env.PLANE_API_STYLE as "issues" | "work-items" | undefined) ?? "issues",
    });
  }

  const account = requireActiveAccount(config);
  return new PlaneApiClient({
    baseUrl: envUrl ?? account.baseUrl,
    token: envToken ?? account.token,
    apiStyle: account.apiStyle,
  });
}
