import { Command } from "commander";
import { loadConfig, createClient, requireActiveWorkspace, requireActiveProject, } from "../core/config-store.js";
import { PlaneApiError, fetchAll } from "../core/api-client.js";
import { printInfo, printError, printTable, printJson } from "../core/output.js";
import { resolveProject } from "../core/resolvers.js";
import { stripHtml } from "../core/html.js";
import { ask } from "../core/prompt.js";
export function createPageCommand() {
    const command = new Command("page")
        .description("Work with Plane pages")
        .action(() => command.help());
    // ── list ──────────────────────────────────────────────────────────────────
    command
        .command("list")
        .description("List pages in the active (or specified) project")
        .option("--workspace <slug>", "Workspace slug (overrides active context)")
        .option("--project <identifier>", "Project identifier (overrides active context)")
        .option("--json", "Output raw JSON")
        .action(async (opts) => {
        try {
            const config = loadConfig();
            const client = createClient(config);
            const ws = opts.workspace ?? requireActiveWorkspace(config);
            let projectId;
            if (opts.project) {
                const proj = await resolveProject(client, ws, opts.project);
                projectId = proj.id;
            }
            else {
                projectId = requireActiveProject(config).id;
            }
            const pages = await fetchAll(client, `workspaces/${ws}/projects/${projectId}/pages/`);
            if (pages.length === 0) {
                printInfo("No pages found.");
                return;
            }
            if (opts.json) {
                printJson(pages);
                return;
            }
            const rows = pages.map((p) => [
                `  ${p.name}`,
                p.created_by_detail?.display_name ?? "",
                p.updated_at.slice(0, 10),
            ]);
            printTable(rows, ["NAME", "AUTHOR", "UPDATED"]);
        }
        catch (err) {
            printError(err instanceof PlaneApiError ? err.message : String(err));
            process.exit(1);
        }
    });
    // ── get ───────────────────────────────────────────────────────────────────
    command
        .command("get <page>")
        .description("Show a page by ID")
        .option("--workspace <slug>", "Workspace slug (overrides active context)")
        .option("--project <identifier>", "Project identifier (overrides active context)")
        .option("--json", "Output raw JSON")
        .action(async (pageId, opts) => {
        try {
            const config = loadConfig();
            const client = createClient(config);
            const ws = opts.workspace ?? requireActiveWorkspace(config);
            let projectId;
            if (opts.project) {
                const proj = await resolveProject(client, ws, opts.project);
                projectId = proj.id;
            }
            else {
                projectId = requireActiveProject(config).id;
            }
            const page = await client.get(`workspaces/${ws}/projects/${projectId}/pages/${pageId}/`);
            if (opts.json) {
                printJson(page);
                return;
            }
            printInfo(page.name);
            printInfo(`Author:  ${page.created_by_detail?.display_name ?? "-"}`);
            printInfo(`Updated: ${page.updated_at.slice(0, 10)}`);
            const content = page.description_html
                ? stripHtml(page.description_html)
                : (page.description ?? "");
            if (content) {
                printInfo("");
                printInfo(content);
            }
        }
        catch (err) {
            printError(err instanceof PlaneApiError ? err.message : String(err));
            process.exit(1);
        }
    });
    // ── create ─────────────────────────────────────────────────────────────────
    command
        .command("create <name>")
        .description("Create a new page in the active (or specified) project")
        .option("--content <text>", "Page content (optional)")
        .option("--workspace <slug>", "Workspace slug (overrides active context)")
        .option("--project <identifier>", "Project identifier (overrides active context)")
        .action(async (name, opts) => {
        try {
            const config = loadConfig();
            const client = createClient(config);
            const ws = opts.workspace ?? requireActiveWorkspace(config);
            let projectId;
            if (opts.project) {
                const proj = await resolveProject(client, ws, opts.project);
                projectId = proj.id;
            }
            else {
                projectId = requireActiveProject(config).id;
            }
            const content = opts.content ?? (await ask("Content"));
            const body = { name };
            if (content) {
                body.description_html = `<p>${content}</p>`;
            }
            await client.post(`workspaces/${ws}/projects/${projectId}/pages/`, body);
            printInfo(`Page "${name}" created.`);
        }
        catch (err) {
            printError(err instanceof PlaneApiError ? err.message : String(err));
            process.exit(1);
        }
    });
    // ── update ─────────────────────────────────────────────────────────────────
    command
        .command("update <pageId>")
        .description("Update a page by ID")
        .option("--name <new_name>", "New name")
        .option("--content <text>", "New content")
        .option("--workspace <slug>", "Workspace slug (overrides active context)")
        .option("--project <identifier>", "Project identifier (overrides active context)")
        .action(async (pageId, opts) => {
        try {
            const config = loadConfig();
            const client = createClient(config);
            const ws = opts.workspace ?? requireActiveWorkspace(config);
            let projectId;
            if (opts.project) {
                const proj = await resolveProject(client, ws, opts.project);
                projectId = proj.id;
            }
            else {
                projectId = requireActiveProject(config).id;
            }
            if (!opts.name && !opts.content) {
                printError("At least one of --name or --content must be provided.");
                process.exit(1);
            }
            const body = {};
            if (opts.name) {
                body.name = opts.name;
            }
            if (opts.content) {
                body.description_html = `<p>${opts.content}</p>`;
            }
            await client.patch(`workspaces/${ws}/projects/${projectId}/pages/${pageId}/`, body);
            printInfo("Page updated.");
        }
        catch (err) {
            printError(err instanceof PlaneApiError ? err.message : String(err));
            process.exit(1);
        }
    });
    // ── delete ─────────────────────────────────────────────────────────────────
    command
        .command("delete <pageId>")
        .description("Delete a page by ID")
        .option("--workspace <slug>", "Workspace slug (overrides active context)")
        .option("--project <identifier>", "Project identifier (overrides active context)")
        .action(async (pageId, opts) => {
        try {
            const config = loadConfig();
            const client = createClient(config);
            const ws = opts.workspace ?? requireActiveWorkspace(config);
            let projectId;
            if (opts.project) {
                const proj = await resolveProject(client, ws, opts.project);
                projectId = proj.id;
            }
            else {
                projectId = requireActiveProject(config).id;
            }
            await client.delete(`workspaces/${ws}/projects/${projectId}/pages/${pageId}/`);
            printInfo("Page deleted.");
        }
        catch (err) {
            printError(err instanceof PlaneApiError ? err.message : String(err));
            process.exit(1);
        }
    });
    return command;
}
//# sourceMappingURL=page.js.map