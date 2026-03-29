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
  resolveCycle,
  buildStateMap,
  resolveState,
} from "../core/resolvers.js";
import type { PlaneCycle, PlaneIssue, PlaneState } from "../core/types.js";

export function createCycleCommand(): Command {
  const command = new Command("cycle")
    .description("Work with Plane cycles (sprints)")
    .action(() => command.help());

  // ── list ──────────────────────────────────────────────────────────────────

  command
    .command("list")
    .description("List cycles in the active (or specified) project")
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

        const cycles = await fetchAll<PlaneCycle>(
          client,
          `workspaces/${ws}/projects/${projectId}/cycles/`,
        );

        if (cycles.length === 0) {
          printInfo("No cycles found.");
          return;
        }

        if (opts.json) {
          printJson(cycles);
          return;
        }

        const rows = cycles.map((c) => [
          `  ${c.name}`,
          c.status ?? "",
          c.start_date ?? "",
          c.end_date ?? "",
        ]);
        printTable(rows, ["NAME", "STATUS", "START", "END"]);
      } catch (err) {
        exitWithError(err, Boolean(opts.json));
      }
    });

  // ── issues ────────────────────────────────────────────────────────────────

  command
    .command("issues <cycle>")
    .description("List issues in a cycle (name or UUID)")
    .option("--workspace <slug>", "Workspace slug (overrides active context)")
    .option(
      "--project <identifier-or-name>",
      "Project identifier or name (overrides active context)",
    )
    .option("--json", "Output raw JSON")
    .action(
      async (cycleRef: string, opts: { workspace?: string; project?: string; json?: boolean }) => {
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

          const cycle = await resolveCycle(client, ws, projectId, cycleRef);

          const [issues, stateMap] = await Promise.all([
            fetchAll<PlaneIssue>(
              client,
              `workspaces/${ws}/projects/${projectId}/cycles/${cycle.id}/issues/`,
            ),
            client
              .get<unknown>(`workspaces/${ws}/projects/${projectId}/states/`)
              .then((r) => buildStateMap(unwrap<PlaneState>(r))),
          ]);

          if (issues.length === 0) {
            printInfo(`No issues in cycle "${cycle.name}".`);
            return;
          }

          if (opts.json) {
            printJson(issues);
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

  // ── add ───────────────────────────────────────────────────────────────────

  command
    .command("add <issue> <cycle>")
    .description("Add an issue to a cycle. Issue: 42, PROJ-42, or UUID. Cycle: name or UUID")
    .option("--workspace <slug>", "Workspace slug (overrides active context)")
    .option(
      "--project <identifier-or-name>",
      "Project identifier or name (overrides active context)",
    )
    .option("--json", "Output raw JSON")
    .action(
      async (
        issueRef: string,
        cycleRef: string,
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
          const cycle = await resolveCycle(client, ws, projectId, cycleRef);

          const path = `workspaces/${ws}/projects/${projectId}/cycles/${cycle.id}/issues/`;
          const body = { issues: [issueId] };
          if (isDryRunEnabled()) {
            printJson({
              dryRun: true,
              method: "POST",
              path,
              body,
              context: { workspace: ws, projectId, issueId, cycleId: cycle.id },
            });
            return;
          }

          const result = await client.post<unknown>(path, body);
          if (opts.json) {
            printJson(result);
            return;
          }
          printInfo(`Issue added to cycle "${cycle.name}".`);
        } catch (err) {
          exitWithError(err, Boolean(opts.json));
        }
      },
    );

  // ── remove ────────────────────────────────────────────────────────────────

  command
    .command("remove <issue> <cycle>")
    .description("Remove an issue from a cycle")
    .option("--workspace <slug>", "Workspace slug (overrides active context)")
    .option(
      "--project <identifier-or-name>",
      "Project identifier or name (overrides active context)",
    )
    .option("--json", "Output raw JSON")
    .action(
      async (
        issueRef: string,
        cycleRef: string,
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
          const cycle = await resolveCycle(client, ws, projectId, cycleRef);

          const path = `workspaces/${ws}/projects/${projectId}/cycles/${cycle.id}/issues/${issueId}/`;
          if (isDryRunEnabled()) {
            printJson({
              dryRun: true,
              method: "DELETE",
              path,
              context: { workspace: ws, projectId, issueId, cycleId: cycle.id },
            });
            return;
          }

          await client.delete(path);
          if (opts.json) {
            printJson({
              success: true,
              action: "cycle.remove",
              projectId,
              issueId,
              cycleId: cycle.id,
            });
            return;
          }
          printInfo(`Issue removed from cycle "${cycle.name}".`);
        } catch (err) {
          exitWithError(err, Boolean(opts.json));
        }
      },
    );

  // ── create ─────────────────────────────────────────────────────────────────

  command
    .command("create <name>")
    .description("Create a new cycle")
    .option("--start <date>", "Start date (YYYY-MM-DD)")
    .option("--end <date>", "End date (YYYY-MM-DD)")
    .option("--workspace <slug>", "Workspace slug (overrides active context)")
    .option(
      "--project <identifier-or-name>",
      "Project identifier or name (overrides active context)",
    )
    .option("--json", "Output raw JSON")
    .action(
      async (
        name: string,
        opts: {
          start?: string;
          end?: string;
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

          const body: Record<string, string> = { name };
          if (opts.start) body.start_date = opts.start;
          if (opts.end) body.end_date = opts.end;

          const path = `workspaces/${ws}/projects/${projectId}/cycles/`;
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

          const created = await client.post<PlaneCycle>(path, body);

          if (opts.json) {
            printJson(created);
          } else {
            printInfo(`Cycle "${created.name}" created successfully.`);
          }
        } catch (err) {
          exitWithError(err, Boolean(opts.json));
        }
      },
    );

  // ── delete ─────────────────────────────────────────────────────────────────

  command
    .command("delete <cycle>")
    .description("Delete a cycle (name or UUID)")
    .option("--workspace <slug>", "Workspace slug (overrides active context)")
    .option(
      "--project <identifier-or-name>",
      "Project identifier or name (overrides active context)",
    )
    .option("--json", "Output raw JSON")
    .action(
      async (cycleRef: string, opts: { workspace?: string; project?: string; json?: boolean }) => {
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

          const cycle = await resolveCycle(client, ws, projectId, cycleRef);

          const path = `workspaces/${ws}/projects/${projectId}/cycles/${cycle.id}/`;
          if (isDryRunEnabled()) {
            printJson({
              dryRun: true,
              method: "DELETE",
              path,
              context: { workspace: ws, projectId, cycleId: cycle.id },
            });
            return;
          }

          await client.delete(path);
          if (opts.json) {
            printJson({
              success: true,
              action: "cycle.delete",
              projectId,
              cycleId: cycle.id,
              name: cycle.name,
            });
            return;
          }
          printInfo(`Cycle "${cycle.name}" deleted successfully.`);
        } catch (err) {
          exitWithError(err, Boolean(opts.json));
        }
      },
    );

  return command;
}
