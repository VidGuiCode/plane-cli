import { Command } from "commander";
import {
  loadConfig,
  createClient,
  requireActiveWorkspace,
  requireActiveProject,
} from "../core/config-store.js";
import { fetchAll } from "../core/api-client.js";
import { printInfo, printTable, printJson } from "../core/output.js";
import { resolveProject } from "../core/resolvers.js";
import { stripHtml } from "../core/html.js";
import { ask } from "../core/prompt.js";
import { exitWithError, ValidationError } from "../core/errors.js";
import { isDryRunEnabled } from "../core/runtime.js";
import type { PlanePage } from "../core/types.js";

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

        const pages = await fetchAll<PlanePage>(
          client,
          `workspaces/${ws}/projects/${projectId}/pages/`,
        );

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
      } catch (err) {
        exitWithError(err, Boolean(opts.json));
      }
    });

  // ── get ───────────────────────────────────────────────────────────────────

  command
    .command("get <page>")
    .alias("view")
    .description("Show a page by ID")
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

          const page = await client.get<PlanePage>(
            `workspaces/${ws}/projects/${projectId}/pages/${pageId}/`,
          );

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
