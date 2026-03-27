import { Command } from "commander";
import { loadConfig, saveConfig } from "../core/config-store.js";
import { PlaneApiClient, PlaneApiError, unwrap } from "../core/api-client.js";
import { printError } from "../core/output.js";
import { ask, pickOne } from "../core/prompt.js";
export function createLoginCommand() {
    return new Command("login")
        .description("Connect to a Plane instance and save credentials")
        .option("--url <url>", "Plane base URL (non-interactive)")
        .option("--token <token>", "API token (non-interactive)")
        .action(async (opts) => {
        try {
            const config = loadConfig();
            let baseUrl;
            let token;
            if (opts.url || opts.token) {
                // Non-interactive fast path — both flags required together
                if (!opts.url || !opts.token) {
                    printError("Provide both --url and --token for non-interactive login.");
                    process.exit(1);
                }
                baseUrl = opts.url;
                token = opts.token;
            }
            else if (config.profiles.length > 0) {
                const ref = config.profiles[0];
                const sameInstance = await ask(`Same Plane instance as "${ref.baseUrl}"? (y/n)`, "y");
                if (sameInstance.toLowerCase() !== "n") {
                    baseUrl = ref.baseUrl;
                    const sameCredentials = await ask(`Same credentials as account "${ref.name}"? (y/n)`, "y");
                    if (sameCredentials.toLowerCase() !== "n") {
                        token = ref.token;
                    }
                    else {
                        token = await ask("API token");
                    }
                }
                else {
                    baseUrl = await ask("Plane base URL (e.g. https://plane.yourcompany.com)");
                    token = await ask("API token");
                }
            }
            else {
                baseUrl = await ask("Plane base URL (e.g. https://plane.yourcompany.com)");
                token = await ask("API token");
            }
            if (!baseUrl) {
                printError("Base URL is required.");
                process.exit(1);
            }
            if (!token) {
                printError("Token is required.");
                process.exit(1);
            }
            const tempClient = new PlaneApiClient({ baseUrl, token, apiStyle: "issues" });
            console.log("Connecting to Plane...");
            try {
                await tempClient.get("users/me/");
            }
            catch (err) {
                printError(err instanceof PlaneApiError
                    ? `Failed to connect: ${err.message}`
                    : "Failed to connect. Check your base URL and token.");
                process.exit(1);
            }
            let workspaces = [];
            try {
                const res = await tempClient.get("workspaces/");
                workspaces = unwrap(res);
            }
            catch {
                // Workspace list not available — ask manually
            }
            let workspaceSlug;
            if (workspaces.length === 1) {
                workspaceSlug = workspaces[0].slug;
                console.log(`Found workspace: ${workspaces[0].name} (${workspaceSlug})`);
            }
            else if (workspaces.length > 1) {
                if (opts.url && opts.token) {
                    // Non-interactive: pick first workspace
                    workspaceSlug = workspaces[0].slug;
                    console.log(`Using workspace: ${workspaces[0].name} (${workspaceSlug})`);
                }
                else {
                    console.log("Multiple workspaces found:");
                    const idx = await pickOne("Select workspace", workspaces.map((w) => `${w.name} (${w.slug})`));
                    workspaceSlug = workspaces[idx].slug;
                }
            }
            else {
                workspaceSlug = await ask("Workspace slug (found in your Plane URL)");
                if (!workspaceSlug) {
                    printError("Workspace slug is required.");
                    process.exit(1);
                }
            }
            const apiStyle = await detectApiStyle(tempClient, workspaceSlug);
            let accountName = workspaceSlug;
            if (config.profiles.some((p) => p.name === workspaceSlug)) {
                accountName = await ask("Account name", workspaceSlug);
            }
            const account = {
                name: accountName,
                baseUrl,
                token,
                apiStyle,
                defaultWorkspace: workspaceSlug,
            };
            const existing = config.profiles.findIndex((p) => p.name === accountName);
            if (existing >= 0) {
                config.profiles[existing] = account;
            }
            else {
                config.profiles.push(account);
            }
            config.context.activeProfile = accountName;
            config.context.activeWorkspace = workspaceSlug;
            delete config.context.activeProject;
            delete config.context.activeProjectIdentifier;
            saveConfig(config);
            console.log(`\nAccount "${accountName}" saved.`);
            console.log(`Active workspace: ${workspaceSlug}`);
            console.log(`API style: ${apiStyle}`);
        }
        catch (err) {
            printError(`Login failed: ${err instanceof Error ? err.message : err}`);
            process.exit(1);
        }
    });
}
async function detectApiStyle(client, workspaceSlug) {
    try {
        const res = await client.get(`workspaces/${workspaceSlug}/projects/?per_page=1`);
        const projects = unwrap(res);
        if (projects.length > 0) {
            const projectId = projects[0].id;
            try {
                await client.get(`workspaces/${workspaceSlug}/projects/${projectId}/issues/?per_page=1`);
                return "issues";
            }
            catch {
                return "work-items";
            }
        }
    }
    catch {
        // Cannot detect — fall back to self-hosted default
    }
    return "issues";
}
//# sourceMappingURL=login.js.map