import { Command } from "commander";
import {
  loadConfig,
  createClient,
  requireActiveWorkspace,
  requireActiveProject,
} from "../core/config-store.js";
import { unwrap, fetchAll } from "../core/api-client.js";
import { printInfo, printTable, printJson } from "../core/output.js";
import { exitWithError } from "../core/errors.js";
import { isDryRunEnabled } from "../core/runtime.js";
import {
  resolveProject,
  resolveIssueRef,
  resolveModule,
  buildStateMap,
  resolveState,
  normalizeIssue,
} from "../core/resolvers.js";
import type { PlaneModule, PlaneIssue, PlaneState } from "../core/types.js";

function splitIssueRefs(issueRefs: string): string[] {
  const refs = issueRefs
    .split(",")
    .map((ref) => ref.trim())
    .filter(Boolean);
  if (refs.length === 0) {
    throw new Error("At least one issue ref is required.");
  }
  return refs;
}

export function createModuleCommand(): Command {
  const command = new Command("module")
    .description("Work with Plane modules")
    .action(() => command.help());

  command
    .command("list")
    .description("List modules in the active (or specified) project")
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

        const modules = await fetchAll<PlaneModule>(
          client,
          `workspaces/${ws}/projects/${projectId}/modules/`,
        );

        if (modules.length === 0) {
          printInfo("No modules found.");
          return;
        }

        if (opts.json) {
          printJson(modules);
          return;
        }

        const rows = modules.map((m) => [
          `  ${m.name}`,
          m.status ?? "",
          m.start_date ?? "",
          m.target_date ?? "",
        ]);
        printTable(rows, ["NAME", "STATUS", "START", "TARGET"]);
      } catch (err) {
        exitWithError(err, Boolean(opts.json));
      }
    });

  // ── create ────────────────────────────────────────────────────────────────

  command
    .command("create <name>")
    .description("Create a new module in the active (or specified) project")
    .option("--workspace <slug>", "Workspace slug (overrides active context)")
    .option(
      "--project <identifier-or-name>",
      "Project identifier or name (overrides active context)",
    )
    .option("--json", "Output raw JSON")
    .action(
      async (name: string, opts: { workspace?: string; project?: string; json?: boolean }) => {
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

          const path = `workspaces/${ws}/projects/${projectId}/modules/`;
          const body = { name };
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

          const created = await client.post<PlaneModule>(path, body);

          if (opts.json) {
            printJson(created);
            return;
          }
          printInfo(`Module "${created.name}" created.`);
        } catch (err) {
          exitWithError(err, Boolean(opts.json));
        }
      },
    );

  // ── add ───────────────────────────────────────────────────────────────────

  command
    .command("ensure <name>")
    .description("Return an existing module by name, or create it if missing")
    .option("--workspace <slug>", "Workspace slug (overrides active context)")
    .option(
      "--project <identifier-or-name>",
      "Project identifier or name (overrides active context)",
    )
    .option("--json", "Output raw JSON")
    .action(
      async (name: string, opts: { workspace?: string; project?: string; json?: boolean }) => {
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

          const path = `workspaces/${ws}/projects/${projectId}/modules/`;
          const modules = await fetchAll<PlaneModule>(client, path);
          const existing = modules.find((mod) => mod.name.toLowerCase() === name.toLowerCase());
          if (existing) {
            if (opts.json) {
              printJson({ status: "existing", module: existing });
              return;
            }
            printInfo(`Module "${existing.name}" already exists.`);
            return;
          }

          const body = { name };
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

          const created = await client.post<PlaneModule>(path, body);
          if (opts.json) {
            printJson({ status: "created", module: created });
            return;
          }
          printInfo(`Module "${created.name}" created.`);
        } catch (err) {
          exitWithError(err, Boolean(opts.json));
        }
      },
    );

  command
    .command("add <issues> <module>")
    .description(
      "Add one or more issues to a module. Issues: 42, PROJ-42, UUID, or comma-separated",
    )
    .option("--workspace <slug>", "Workspace slug (overrides active context)")
    .option(
      "--project <identifier-or-name>",
      "Project identifier or name (overrides active context)",
    )
    .option("--json", "Output raw JSON")
    .action(
      async (
        issueRef: string,
        moduleRef: string,
        opts: { workspace?: string; project?: string; json?: boolean },
      ) => {
        try {
          const config = loadConfig();
          const client = createClient(config);
          const ws = opts.workspace ?? requireActiveWorkspace(config);
          const style = client.issuesSegment();

          let activeProjectId: string | undefined;
          let activeProjectIdentifier: string | undefined;
          if (opts.project) {
            const proj = await resolveProject(client, ws, opts.project);
            activeProjectId = proj.id;
            activeProjectIdentifier = proj.identifier;
          } else if (config.context.activeProject) {
            activeProjectId = config.context.activeProject;
            activeProjectIdentifier = config.context.activeProjectIdentifier;
          }

          const resolvedIssues = [];
          for (const ref of splitIssueRefs(issueRef)) {
            resolvedIssues.push(
              await resolveIssueRef(
                client,
                ws,
                activeProjectId,
                activeProjectIdentifier,
                style,
                ref,
              ),
            );
          }

          const projectId = resolvedIssues[0].projectId;
          const mismatched = resolvedIssues.find((issue) => issue.projectId !== projectId);
          if (mismatched) {
            throw new Error(
              "All issue refs must belong to the same project for module assignment.",
            );
          }
          const issueIds = resolvedIssues.map((issue) => issue.issueId);
          const mod = await resolveModule(client, ws, projectId, moduleRef);

          const path = `workspaces/${ws}/projects/${projectId}/modules/${mod.id}/module-issues/`;
          const body = { issues: issueIds };
          if (isDryRunEnabled()) {
            printJson({
              dryRun: true,
              method: "POST",
              path,
              body,
              context: { workspace: ws, projectId, issueIds, moduleId: mod.id },
            });
            return;
          }

          const result = await client.post<unknown>(path, body);
          if (opts.json) {
            printJson(result);
            return;
          }
          printInfo(
            issueIds.length === 1
              ? `Issue added to module "${mod.name}".`
              : `${issueIds.length} issues added to module "${mod.name}".`,
          );
        } catch (err) {
          exitWithError(err, Boolean(opts.json));
        }
      },
    );

  // ── issues ────────────────────────────────────────────────────────────────

  command
    .command("issues <module>")
    .description("List issues in a module (name or UUID)")
    .option("--workspace <slug>", "Workspace slug (overrides active context)")
    .option(
      "--project <identifier-or-name>",
      "Project identifier or name (overrides active context)",
    )
    .option("--json", "Output raw JSON")
    .action(
      async (moduleRef: string, opts: { workspace?: string; project?: string; json?: boolean }) => {
        try {
          const config = loadConfig();
          const client = createClient(config);
          const ws = opts.workspace ?? requireActiveWorkspace(config);

          let projectId: string;
          let identifier: string;
          if (opts.project) {
            const proj = await resolveProject(client, ws, opts.project);
            projectId = proj.id;
            identifier = proj.identifier;
          } else {
            const active = requireActiveProject(config);
            projectId = active.id;
            identifier = active.identifier;
          }

          const mod = await resolveModule(client, ws, projectId, moduleRef);

          const [issues, stateMap] = await Promise.all([
            fetchAll<PlaneIssue>(
              client,
              `workspaces/${ws}/projects/${projectId}/modules/${mod.id}/module-issues/`,
            ),
            client
              .get<unknown>(`workspaces/${ws}/projects/${projectId}/states/`)
              .then((r) => buildStateMap(unwrap<PlaneState>(r))),
          ]);

          if (issues.length === 0) {
            printInfo(`No issues in module "${mod.name}".`);
            return;
          }

          if (opts.json) {
            printJson(
              issues.map((issue) => normalizeIssue(issue, stateMap, identifier, projectId)),
            );
            return;
          }

          const rows = issues.map((issue) => [
            `${identifier}-${issue.sequence_id}`,
            issue.name,
            resolveState(issue, stateMap),
            issue.priority ?? "",
          ]);
          printTable(rows, ["ID", "TITLE", "STATE", "PRIORITY"]);
        } catch (err) {
          exitWithError(err, Boolean(opts.json));
        }
      },
    );

  // ── remove ────────────────────────────────────────────────────────────────

  command
    .command("remove <issue> <module>")
    .description("Remove an issue from a module")
    .option("--workspace <slug>", "Workspace slug (overrides active context)")
    .option(
      "--project <identifier-or-name>",
      "Project identifier or name (overrides active context)",
    )
    .option("--json", "Output raw JSON")
    .action(
      async (
        issueRef: string,
        moduleRef: string,
        opts: { workspace?: string; project?: string; json?: boolean },
      ) => {
        try {
          const config = loadConfig();
          const client = createClient(config);
          const ws = opts.workspace ?? requireActiveWorkspace(config);
          const style = client.issuesSegment();

          let activeProjectId: string | undefined;
          let activeProjectIdentifier: string | undefined;
          if (opts.project) {
            const proj = await resolveProject(client, ws, opts.project);
            activeProjectId = proj.id;
            activeProjectIdentifier = proj.identifier;
          } else if (config.context.activeProject) {
            activeProjectId = config.context.activeProject;
            activeProjectIdentifier = config.context.activeProjectIdentifier;
          }

          const { issueId, projectId } = await resolveIssueRef(
            client,
            ws,
            activeProjectId,
            activeProjectIdentifier,
            style,
            issueRef,
          );
          const mod = await resolveModule(client, ws, projectId, moduleRef);

          const path = `workspaces/${ws}/projects/${projectId}/modules/${mod.id}/module-issues/${issueId}/`;
          if (isDryRunEnabled()) {
            printJson({
              dryRun: true,
              method: "DELETE",
              path,
              context: { workspace: ws, projectId, issueId, moduleId: mod.id },
            });
            return;
          }

          await client.delete(path);
          if (opts.json) {
            printJson({
              success: true,
              action: "module.remove",
              projectId,
              issueId,
              moduleId: mod.id,
            });
            return;
          }
          printInfo(`Issue removed from module "${mod.name}".`);
        } catch (err) {
          exitWithError(err, Boolean(opts.json));
        }
      },
    );

  // ── delete ─────────────────────────────────────────────────────────────────

  command
    .command("delete <module>")
    .description("Delete a module from the active (or specified) project")
    .option("--workspace <slug>", "Workspace slug (overrides active context)")
    .option(
      "--project <identifier-or-name>",
      "Project identifier or name (overrides active context)",
    )
    .option("--json", "Output raw JSON")
    .action(
      async (moduleRef: string, opts: { workspace?: string; project?: string; json?: boolean }) => {
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

          const mod = await resolveModule(client, ws, projectId, moduleRef);

          const path = `workspaces/${ws}/projects/${projectId}/modules/${mod.id}/`;
          if (isDryRunEnabled()) {
            printJson({
              dryRun: true,
              method: "DELETE",
              path,
              context: { workspace: ws, projectId, moduleId: mod.id },
            });
            return;
          }

          await client.delete(path);
          if (opts.json) {
            printJson({
              success: true,
              action: "module.delete",
              projectId,
              moduleId: mod.id,
              name: mod.name,
            });
            return;
          }
          printInfo(`Module "${mod.name}" deleted.`);
        } catch (err) {
          exitWithError(err, Boolean(opts.json));
        }
      },
    );

  return command;
}
