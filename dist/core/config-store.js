import os from "node:os";
import path from "node:path";
import fs from "node:fs";
import { PlaneApiClient } from "./api-client.js";
import { printError } from "./output.js";
export const DEFAULT_CONFIG = {
    profiles: [],
    context: {},
};
export function getConfigDir() {
    return path.join(os.homedir(), ".plane-cli");
}
export function getConfigPath() {
    return path.join(getConfigDir(), "config.json");
}
export function loadConfig() {
    const configPath = getConfigPath();
    if (!fs.existsSync(configPath)) {
        return { profiles: [], context: {} };
    }
    try {
        return JSON.parse(fs.readFileSync(configPath, "utf-8"));
    }
    catch {
        return { profiles: [], context: {} };
    }
}
export function saveConfig(config) {
    const dir = getConfigDir();
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(getConfigPath(), JSON.stringify(config, null, 2), "utf-8");
}
export function getActiveAccount(config) {
    return config.profiles.find((p) => p.name === config.context.activeProfile);
}
export function requireActiveAccount(config) {
    const account = getActiveAccount(config);
    if (!account) {
        printError("No active account. Run: plane login");
        process.exit(1);
    }
    return account;
}
// Backward-compat alias
export const requireActiveProfile = requireActiveAccount;
export function requireActiveWorkspace(config) {
    const ws = process.env.PLANE_WORKSPACE ?? config.context.activeWorkspace;
    if (!ws) {
        printError("No active workspace. Run: plane workspace use <slug>");
        process.exit(1);
    }
    return ws;
}
export function requireActiveProject(config) {
    const id = config.context.activeProject;
    if (!id) {
        printError("No active project. Run: plane project use <identifier>");
        process.exit(1);
    }
    return { id, identifier: config.context.activeProjectIdentifier ?? "" };
}
export function createClient(config) {
    const envUrl = process.env.PLANE_BASE_URL;
    const envToken = process.env.PLANE_API_TOKEN;
    // Pure CI path: both env vars set — no config file needed
    if (envUrl && envToken) {
        return new PlaneApiClient({
            baseUrl: envUrl,
            token: envToken,
            apiStyle: process.env.PLANE_API_STYLE ?? "issues",
        });
    }
    const account = requireActiveAccount(config);
    return new PlaneApiClient({
        baseUrl: envUrl ?? account.baseUrl,
        token: envToken ?? account.token,
        apiStyle: account.apiStyle,
    });
}
//# sourceMappingURL=config-store.js.map