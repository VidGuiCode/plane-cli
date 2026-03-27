import { Command } from "commander";
import {
  loadConfig,
  createClient,
  requireActiveWorkspace,
  requireActiveProject,
} from "../core/config-store.js";
import { PlaneApiError, fetchAll } from "../core/api-client.js";
import { printInfo, printError, printTable, printJson } from "../core/output.js";
import { resolveProject } from "../core/resolvers.js";
import { stripHtml } from "../core/html.js";
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
    .option("--project <identifier>", "Project identifier (overrides active context)")
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

        if (opts.json) { printJson(pages); return; }

        const rows = pages.map((p) => [
          `  ${p.name}`,
          p.created_by_detail?.display_name ?? "",
          p.updated_at.slice(0, 10),
        ]);
        printTable(rows, ["NAME", "AUTHOR", "UPDATED"]);
      } catch (err) {
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
    .action(async (pageId: string, opts: { workspace?: string; project?: string; json?: boolean }) => {
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

        if (opts.json) { printJson(page); return; }

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
        printError(err instanceof PlaneApiError ? err.message : String(err));
        process.exit(1);
      }
    });

  return command;
}
