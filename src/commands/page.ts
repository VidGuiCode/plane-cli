import { Command } from "commander";
import {
  loadConfig,
  createClient,
  requireActiveWorkspace,
  requireActiveProject,
} from "../core/config-store.js";
import { fetchAll, PlaneApiError, type PlaneApiClient } from "../core/api-client.js";
import { printInfo, printTable, printJson } from "../core/output.js";
import { resolveProject } from "../core/resolvers.js";
import { stripHtml } from "../core/html.js";
import { ask } from "../core/prompt.js";
import { exitWithError, ValidationError } from "../core/errors.js";
import { isDryRunEnabled } from "../core/runtime.js";
import type { PlanePage } from "../core/types.js";

function pageListPath(workspace: string, projectId: string): string {
  return `workspaces/${workspace}/projects/${projectId}/pages/`;
}

function pageUnsupportedError(error: PlaneApiError): ValidationError {
  return new ValidationError(
    `Project pages endpoint returned 404. This Plane instance/API version may not support project pages. Original error: ${error.message}`,
  );
}

async function fetchProjectPages(
  client: PlaneApiClient,
  workspace: string,
  projectId: string,
): Promise<PlanePage[]> {
  try {
    return await fetchAll<PlanePage>(client, pageListPath(workspace, projectId));
  } catch (error) {
    if (error instanceof PlaneApiError && error.status === 404) {
      throw pageUnsupportedError(error);
    }
    throw error;
  }
}

function fetchPageById(
  client: PlaneApiClient,
  workspace: string,
  projectId: string,
  pageId: string,
): Promise<PlanePage> {
  return client.get<PlanePage>(`${pageListPath(workspace, projectId)}${pageId}/`);
}

function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function resolvePage(
  client: PlaneApiClient,
  workspace: string,
  projectId: string,
  pageRef: string,
): Promise<PlanePage> {
  if (isUuidLike(pageRef)) {
    return fetchPageById(client, workspace, projectId, pageRef);
  }

  const pages = await fetchProjectPages(client, workspace, projectId);
  const lower = pageRef.toLowerCase();
  const exact = pages.find((page) => page.name.toLowerCase() === lower);
  if (exact) return fetchPageById(client, workspace, projectId, exact.id);

  const matches = pages.filter((page) => page.name.toLowerCase().includes(lower));
  if (matches.length === 1) return fetchPageById(client, workspace, projectId, matches[0].id);
  if (matches.length > 1) {
    throw new ValidationError(
      `Multiple pages match "${pageRef}". Use: plane page search "${pageRef}" --project <project>`,
    );
  }

  throw new ValidationError(
    `Page "${pageRef}" not found in this project. Check with: plane page list`,
  );
}

export function createPageCommand(): Command {
  const command = new Command("page")
    .description("Work with Plane pages")
    .action(() => command.help());

  // ── list ──────────────────────────────────────────────────────────────────

  command
    .command("list")
    .description("List pages in the active (or specified) project")
    .option("--workspace <slug>", "Workspace slug (overrides active context)")
    .option(
      "--project <identifier-or-name>",
      "Project identifier or name (overrides active context)",
    )
    .option("--json", "Output raw JSON")
    .action(async (opts: { workspace?: string; project?: string; json?: boolean }) => {
      try {
        const config = loadConfig();
        const client = createClient(config);
        const ws = opts.workspace ?? requireActiveWorkspace(config);

        let projectId: string;
        if (opts.project) {
          const proj = await resolveProject(client, ws, opts.project);
          projectId = proj.id;
        } else {
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
      } catch (err) {
        exitWithError(err, Boolean(opts.json));
      }
    });

  // ── get ───────────────────────────────────────────────────────────────────

  command
    .command("get <page>")
    .alias("view")
    .description("Show a page by ID or exact name")
    .option("--workspace <slug>", "Workspace slug (overrides active context)")
    .option(
      "--project <identifier-or-name>",
      "Project identifier or name (overrides active context)",
    )
    .option("--json", "Output raw JSON")
    .action(
      async (pageRef: string, opts: { workspace?: string; project?: string; json?: boolean }) => {
        try {
          const config = loadConfig();
          const client = createClient(config);
          const ws = opts.workspace ?? requireActiveWorkspace(config);

          let projectId: string;
          if (opts.project) {
            const proj = await resolveProject(client, ws, opts.project);
            projectId = proj.id;
          } else {
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
        } catch (err) {
          exitWithError(err, Boolean(opts.json));
        }
      },
    );

  // â”€â”€ search â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€

  command
    .command("search <query>")
    .description("Search pages by name")
    .option("--workspace <slug>", "Workspace slug (overrides active context)")
    .option(
      "--project <identifier-or-name>",
      "Project identifier or name (overrides active context)",
    )
    .option("--json", "Output raw JSON")
    .action(
      async (query: string, opts: { workspace?: string; project?: string; json?: boolean }) => {
        try {
          const config = loadConfig();
          const client = createClient(config);
          const ws = opts.workspace ?? requireActiveWorkspace(config);

          let projectId: string;
          if (opts.project) {
            const proj = await resolveProject(client, ws, opts.project);
            projectId = proj.id;
          } else {
            projectId = requireActiveProject(config).id;
          }

          const lower = query.toLowerCase();
          const matches = (await fetchProjectPages(client, ws, projectId)).filter((page) =>
            page.name.toLowerCase().includes(lower),
          );

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
        } catch (err) {
          exitWithError(err, Boolean(opts.json));
        }
      },
    );

  // ── create ─────────────────────────────────────────────────────────────────

  command
    .command("create <name>")
    .description("Create a new page in the active (or specified) project")
    .option("--content <text>", "Page content (optional)")
    .option("--workspace <slug>", "Workspace slug (overrides active context)")
    .option(
      "--project <identifier-or-name>",
      "Project identifier or name (overrides active context)",
    )
    .option("--json", "Output raw JSON")
    .action(
      async (
        name: string,
        opts: { content?: string; workspace?: string; project?: string; json?: boolean },
      ) => {
        try {
          const config = loadConfig();
          const client = createClient(config);
          const ws = opts.workspace ?? requireActiveWorkspace(config);

          let projectId: string;
          if (opts.project) {
            const proj = await resolveProject(client, ws, opts.project);
            projectId = proj.id;
          } else {
            projectId = requireActiveProject(config).id;
          }

          const content = opts.content ?? (await ask("Content", ""));
          const body: { name: string; description_html?: string } = { name };
          if (content) {
            body.description_html = `<p>${content}</p>`;
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

          const page = await client.post<PlanePage>(path, body);
          if (opts.json) {
            printJson(page);
            return;
          }
          printInfo(`Page "${name}" created.`);
        } catch (err) {
          exitWithError(err, Boolean(opts.json));
        }
      },
    );

  // ── update ─────────────────────────────────────────────────────────────────

  command
    .command("update <pageId>")
    .description("Update a page by ID")
    .option("--name <new_name>", "New name")
    .option("--content <text>", "New content")
    .option("--workspace <slug>", "Workspace slug (overrides active context)")
    .option(
      "--project <identifier-or-name>",
      "Project identifier or name (overrides active context)",
    )
    .option("--json", "Output raw JSON")
    .action(
      async (
        pageId: string,
        opts: {
          name?: string;
          content?: string;
          workspace?: string;
          project?: string;
          json?: boolean;
        },
      ) => {
        try {
          const config = loadConfig();
          const client = createClient(config);
          const ws = opts.workspace ?? requireActiveWorkspace(config);

          let projectId: string;
          if (opts.project) {
            const proj = await resolveProject(client, ws, opts.project);
            projectId = proj.id;
          } else {
            projectId = requireActiveProject(config).id;
          }

          if (!opts.name && !opts.content) {
            throw new ValidationError("At least one of --name or --content must be provided.");
          }

          const body: { name?: string; description_html?: string } = {};
          if (opts.name) {
            body.name = opts.name;
          }
          if (opts.content) {
            body.description_html = `<p>${opts.content}</p>`;
          }

          const path = `workspaces/${ws}/projects/${projectId}/pages/${pageId}/`;
          if (isDryRunEnabled()) {
            printJson({
              dryRun: true,
              method: "PATCH",
              path,
              body,
              context: { workspace: ws, projectId, pageId },
            });
            return;
          }

          const page = await client.patch<PlanePage>(path, body);
          if (opts.json) {
            printJson(page);
            return;
          }
          printInfo("Page updated.");
        } catch (err) {
          exitWithError(err, Boolean(opts.json));
        }
      },
    );

  // ── delete ─────────────────────────────────────────────────────────────────

  command
    .command("delete <pageId>")
    .description("Delete a page by ID")
    .option("--workspace <slug>", "Workspace slug (overrides active context)")
    .option(
      "--project <identifier-or-name>",
      "Project identifier or name (overrides active context)",
    )
    .option("--json", "Output raw JSON")
    .action(
      async (pageId: string, opts: { workspace?: string; project?: string; json?: boolean }) => {
        try {
          const config = loadConfig();
          const client = createClient(config);
          const ws = opts.workspace ?? requireActiveWorkspace(config);

          let projectId: string;
          if (opts.project) {
            const proj = await resolveProject(client, ws, opts.project);
            projectId = proj.id;
          } else {
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

          await client.delete(path);
          if (opts.json) {
            printJson({ success: true, action: "page.delete", pageId, projectId, workspace: ws });
            return;
          }
          printInfo("Page deleted.");
        } catch (err) {
          exitWithError(err, Boolean(opts.json));
        }
      },
    );

  return command;
}
