import { Command } from "commander";
import { loadConfig, createClient, requireActiveWorkspace, requireActiveProject, } from "../core/config-store.js";
import { fetchAll, PlaneApiError } from "../core/api-client.js";
import { printInfo, printTable, printJson } from "../core/output.js";
import { resolveProject } from "../core/resolvers.js";
import { stripHtml } from "../core/html.js";
import { ask } from "../core/prompt.js";
import { exitWithError, ValidationError } from "../core/errors.js";
import { isDryRunEnabled } from "../core/runtime.js";
function pageListPath(workspace, projectId) {
    return `workspaces/${workspace}/projects/${projectId}/pages/`;
}
function pageUnsupportedError(error) {
    return new ValidationError(`Project pages endpoint returned ${error.status}. This Plane instance/API version may not support project pages. Original error: ${error.message}`);
}
/** Describe the observed endpoint failure without assuming all editions match. */
function pageMutationUnsupportedError(error, verb) {
    const reason = error.status === 405
        ? `${error.method} is not allowed by this endpoint`
        : "the page or project-pages endpoint was not found";
    return new ValidationError(`Page ${verb} failed (${error.method} ${error.path}, HTTP ${error.status}): ${reason}. Check the page ID, project, permissions, and this instance's API version. ${verb === "update"
        ? "The current documented API uses PUT; use --method PATCH only for an instance that supports PATCH."
        : "If deletion is unavailable, try: plane page archive <ref>."} Original error: ${error.message}`);
}
function validateContentInput(opts) {
    if (opts.content !== undefined && opts.contentHtml !== undefined) {
        throw new ValidationError("--content and --content-html are mutually exclusive.");
    }
}
async function fetchProjectPages(client, workspace, projectId) {
    try {
        return await fetchAll(client, pageListPath(workspace, projectId));
    }
    catch (error) {
        if (error instanceof PlaneApiError && error.status === 404) {
            throw pageUnsupportedError(error);
        }
        throw error;
    }
}
function fetchPageById(client, workspace, projectId, pageId) {
    return client.get(`${pageListPath(workspace, projectId)}${pageId}/`);
}
function isUuidLike(value) {
    return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
async function resolvePage(client, workspace, projectId, pageRef) {
    if (isUuidLike(pageRef)) {
        return fetchPageById(client, workspace, projectId, pageRef);
    }
    const pages = await fetchProjectPages(client, workspace, projectId);
    const lower = pageRef.toLowerCase();
    const exact = pages.find((page) => page.name.toLowerCase() === lower);
    if (exact)
        return fetchPageById(client, workspace, projectId, exact.id);
    const matches = pages.filter((page) => page.name.toLowerCase().includes(lower));
    if (matches.length === 1)
        return fetchPageById(client, workspace, projectId, matches[0].id);
    if (matches.length > 1) {
        throw new ValidationError(`Multiple pages match "${pageRef}". Use: plane page search "${pageRef}" --project <project>`);
    }
    throw new ValidationError(`Page "${pageRef}" not found in this project. Check with: plane page list`);
}
/**
 * Archive/unarchive a page via the documented lifecycle endpoint
 * (`POST`/`DELETE …/pages/{id}/archive/`). The API returns 204 No Content, so
 * nothing comes back. A 404/405 on this call means the instance has no pages
 * API (Community self-hosted) — same wrap as the list path.
 */
async function setPageArchived(client, workspace, projectId, pageId, archived) {
    const path = `${pageListPath(workspace, projectId)}${pageId}/archive/`;
    try {
        if (archived) {
            await client.postVoid(path);
        }
        else {
            await client.delete(path);
        }
    }
    catch (error) {
        if (error instanceof PlaneApiError && (error.status === 404 || error.status === 405)) {
            throw pageUnsupportedError(error);
        }
        throw error;
    }
}
export function createPageCommand() {
    const command = new Command("page")
        .description("Work with Plane pages")
        .action(() => command.help());
    // ── list ──────────────────────────────────────────────────────────────────
    command
        .command("list")
        .description("List pages in the active (or specified) project")
        .option("--workspace <slug>", "Workspace slug (overrides active context)")
        .option("--project <identifier-or-name>", "Project identifier or name (overrides active context)")
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
            const pages = await fetchProjectPages(client, ws, projectId);
            if (opts.json) {
                printJson(pages);
                return;
            }
            if (pages.length === 0) {
                printInfo("No pages found.");
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
            exitWithError(err, Boolean(opts.json));
        }
    });
    // ── get ───────────────────────────────────────────────────────────────────
    command
        .command("get <page>")
        .alias("view")
        .description("Show a page by ID or exact name")
        .option("--workspace <slug>", "Workspace slug (overrides active context)")
        .option("--project <identifier-or-name>", "Project identifier or name (overrides active context)")
        .option("--json", "Output raw JSON")
        .action(async (pageRef, opts) => {
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
            const page = await resolvePage(client, ws, projectId, pageRef);
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
            exitWithError(err, Boolean(opts.json));
        }
    });
    // â”€â”€ search â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    command
        .command("search <query>")
        .description("Search pages by name")
        .option("--workspace <slug>", "Workspace slug (overrides active context)")
        .option("--project <identifier-or-name>", "Project identifier or name (overrides active context)")
        .option("--json", "Output raw JSON")
        .action(async (query, opts) => {
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
            const lower = query.toLowerCase();
            const matches = (await fetchProjectPages(client, ws, projectId)).filter((page) => page.name.toLowerCase().includes(lower));
            if (opts.json) {
                printJson(matches);
                return;
            }
            if (matches.length === 0) {
                printInfo(`No pages matched "${query}".`);
                return;
            }
            const rows = matches.map((p) => [
                `  ${p.name}`,
                p.id,
                p.created_by_detail?.display_name ?? "",
                p.updated_at.slice(0, 10),
            ]);
            printTable(rows, ["NAME", "ID", "AUTHOR", "UPDATED"]);
        }
        catch (err) {
            exitWithError(err, Boolean(opts.json));
        }
    });
    // ── create ─────────────────────────────────────────────────────────────────
    command
        .command("create <name>")
        .description("Create a new page in the active (or specified) project")
        .option("--content <text>", "Page content (optional)")
        .option("--content-html <html>", "Raw HTML content (exclusive with --content)")
        .option("--access <0|1>", "Page access: 0 = public (default), 1 = private")
        .option("--workspace <slug>", "Workspace slug (overrides active context)")
        .option("--project <identifier-or-name>", "Project identifier or name (overrides active context)")
        .option("--json", "Output raw JSON")
        .action(async (name, opts) => {
        try {
            validateContentInput(opts);
            let access;
            if (opts.access !== undefined) {
                if (opts.access !== "0" && opts.access !== "1") {
                    throw new ValidationError("--access must be 0 (public) or 1 (private).");
                }
                access = Number(opts.access);
            }
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
            const content = opts.contentHtml !== undefined
                ? undefined
                : (opts.content ?? (await ask("Content", "")));
            // The documented commercial create endpoint requires description_html
            // even for a contentless page.
            const body = {
                name,
                description_html: opts.contentHtml ?? (content ? `<p>${content}</p>` : "<p></p>"),
            };
            if (access !== undefined) {
                body.access = access;
            }
            const path = `workspaces/${ws}/projects/${projectId}/pages/`;
            if (isDryRunEnabled()) {
                printJson({
                    dryRun: true,
                    method: "POST",
                    path,
                    body,
                    context: { workspace: ws, projectId },
                });
                return;
            }
            const page = await client.post(path, body);
            if (opts.json) {
                printJson(page);
                return;
            }
            printInfo(`Page "${name}" created.`);
        }
        catch (err) {
            exitWithError(err, Boolean(opts.json));
        }
    });
    // ── update ─────────────────────────────────────────────────────────────────
    command
        .command("update <pageId>")
        .description("Update a page by ID (PUT by default; requires this instance's pages API)")
        .option("--name <new_name>", "New name")
        .option("--content <text>", "New content")
        .option("--content-html <html>", "Raw HTML content (exclusive with --content)")
        .option("--method <PUT|PATCH>", "Update method (no automatic fallback)", "PUT")
        .option("--workspace <slug>", "Workspace slug (overrides active context)")
        .option("--project <identifier-or-name>", "Project identifier or name (overrides active context)")
        .option("--json", "Output raw JSON")
        .action(async (pageId, opts) => {
        try {
            validateContentInput(opts);
            const method = opts.method.toUpperCase();
            if (method !== "PUT" && method !== "PATCH") {
                throw new ValidationError("--method must be PUT or PATCH.");
            }
            if (opts.name === undefined &&
                opts.content === undefined &&
                opts.contentHtml === undefined) {
                throw new ValidationError("At least one of --name, --content, or --content-html must be provided.");
            }
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
            const body = {};
            if (opts.name !== undefined) {
                body.name = opts.name;
            }
            if (opts.contentHtml !== undefined) {
                body.description_html = opts.contentHtml;
            }
            else if (opts.content !== undefined) {
                body.description_html = `<p>${opts.content}</p>`;
            }
            const path = `workspaces/${ws}/projects/${projectId}/pages/${pageId}/`;
            if (isDryRunEnabled()) {
                printJson({
                    dryRun: true,
                    method,
                    path,
                    body,
                    context: { workspace: ws, projectId, pageId },
                });
                return;
            }
            let page;
            try {
                page =
                    method === "PUT"
                        ? await client.put(path, body)
                        : await client.patch(path, body);
            }
            catch (err) {
                if (err instanceof PlaneApiError && (err.status === 404 || err.status === 405)) {
                    throw pageMutationUnsupportedError(err, "update");
                }
                throw err;
            }
            if (opts.json) {
                printJson(page);
                return;
            }
            printInfo("Page updated.");
        }
        catch (err) {
            exitWithError(err, Boolean(opts.json));
        }
    });
    // ── delete ─────────────────────────────────────────────────────────────────
    command
        .command("delete <pageId>")
        .description("Delete a page by ID (requires this instance's pages API; use `plane page archive` to retire a page)")
        .option("--workspace <slug>", "Workspace slug (overrides active context)")
        .option("--project <identifier-or-name>", "Project identifier or name (overrides active context)")
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
            const path = `workspaces/${ws}/projects/${projectId}/pages/${pageId}/`;
            if (isDryRunEnabled()) {
                printJson({
                    dryRun: true,
                    method: "DELETE",
                    path,
                    context: { workspace: ws, projectId, pageId },
                });
                return;
            }
            try {
                await client.delete(path);
            }
            catch (err) {
                if (err instanceof PlaneApiError && (err.status === 404 || err.status === 405)) {
                    throw pageMutationUnsupportedError(err, "delete");
                }
                throw err;
            }
            if (opts.json) {
                printJson({ success: true, action: "page.delete", pageId, projectId, workspace: ws });
                return;
            }
            printInfo("Page deleted.");
        }
        catch (err) {
            exitWithError(err, Boolean(opts.json));
        }
    });
    // ── archive / unarchive ────────────────────────────────────────────────────
    for (const [verb, archived, method] of [
        ["archive", true, "POST"],
        ["unarchive", false, "DELETE"],
    ]) {
        command
            .command(`${verb} <page>`)
            .description(archived
            ? "Archive a page by ID or exact name"
            : "Restore an archived page by ID or exact name")
            .option("--workspace <slug>", "Workspace slug (overrides active context)")
            .option("--project <identifier-or-name>", "Project identifier or name (overrides active context)")
            .option("--json", "Output raw JSON")
            .action(async (pageRef, opts) => {
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
                const page = await resolvePage(client, ws, projectId, pageRef);
                const path = `workspaces/${ws}/projects/${projectId}/pages/${page.id}/archive/`;
                if (isDryRunEnabled()) {
                    printJson({
                        dryRun: true,
                        method,
                        path,
                        context: { workspace: ws, projectId, pageId: page.id },
                    });
                    return;
                }
                await setPageArchived(client, ws, projectId, page.id, archived);
                if (opts.json) {
                    printJson({
                        success: true,
                        action: `page.${verb}`,
                        pageId: page.id,
                        projectId,
                        workspace: ws,
                    });
                    return;
                }
                printInfo(`Page "${page.name}" ${verb}d.`);
            }
            catch (err) {
                exitWithError(err, Boolean(opts.json));
            }
        });
    }
    return command;
}
//# sourceMappingURL=page.js.map