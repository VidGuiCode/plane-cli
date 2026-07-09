import { Command } from "commander";
import {
  loadConfig,
  createClient,
  requireActiveWorkspace,
  requireActiveProject,
} from "../core/config-store.js";
import { unwrap, fetchAll } from "../core/api-client.js";
import { printInfo, printTable, printJson } from "../core/output.js";
import { exitWithError, ValidationError } from "../core/errors.js";
import { isDryRunEnabled } from "../core/runtime.js";
import {
  resolveProject,
  resolveIssueRef,
  resolveCycle,
  buildStateMap,
  resolveState,
  normalizeIssue,
} from "../core/resolvers.js";
import type { PlaneCycle, PlaneIssue, PlaneState } from "../core/types.js";

/**
 * Map CLI property options to the Plane cycle PATCH body. Field names mirror the
 * working cycle create pattern (start_date/end_date) and the cycle GET response.
 */
function buildCycleBody(opts: {
  name?: string;
  description?: string;
  start?: string;
  end?: string;
}): Record<string, unknown> {
  const body: Record<string, unknown> = {};
  if (opts.name !== undefined) body.name = opts.name;
  if (opts.description !== undefined) body.description = opts.description;
  if (opts.start !== undefined) body.start_date = opts.start === "none" ? null : opts.start;
  if (opts.end !== undefined) body.end_date = opts.end === "none" ? null : opts.end;
  return body;
}

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

function cycleIssuesPath(ws: string, projectId: string, cycleId: string): string {
  return `workspaces/${ws}/projects/${projectId}/cycles/${cycleId}/cycle-issues/`;
}

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

  // ── current ───────────────────────────────────────────────────────────────

  command
    .command("current")
    .description("Show the active cycle and its issues")
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

        const cycles = await fetchAll<PlaneCycle>(
          client,
          `workspaces/${ws}/projects/${projectId}/cycles/`,
        );
        const current = cycles.find((c) => c.status?.toLowerCase() === "current");
        if (!current) {
          printInfo("No active cycle found in this project.");
          return;
        }

        const [issues, stateMap] = await Promise.all([
          fetchAll<PlaneIssue>(client, cycleIssuesPath(ws, projectId, current.id)),
          client
            .get<unknown>(`workspaces/${ws}/projects/${projectId}/states/`)
            .then((r) => buildStateMap(unwrap<PlaneState>(r))),
        ]);

        if (opts.json) {
          printJson({
            cycle: current,
            issues: issues.map((issue) => normalizeIssue(issue, stateMap, identifier, projectId)),
          });
          return;
        }

        printInfo(`Cycle: ${current.name}`);
        if (current.start_date) printInfo(`Start: ${current.start_date}`);
        if (current.end_date) printInfo(`End:   ${current.end_date}`);
        printInfo("");

        if (issues.length === 0) {
          printInfo("No issues in this cycle.");
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
            fetchAll<PlaneIssue>(client, cycleIssuesPath(ws, projectId, cycle.id)),
            client
              .get<unknown>(`workspaces/${ws}/projects/${projectId}/states/`)
              .then((r) => buildStateMap(unwrap<PlaneState>(r))),
          ]);

          if (issues.length === 0) {
            printInfo(`No issues in cycle "${cycle.name}".`);
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

  // ── add ───────────────────────────────────────────────────────────────────

  command
    .command("add <issues> <cycle>")
    .description("Add one or more issues to a cycle. Issues: 42, PROJ-42, UUID, or comma-separated")
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
            throw new Error("All issue refs must belong to the same project for cycle assignment.");
          }
          const issueIds = resolvedIssues.map((issue) => issue.issueId);
          const cycle = await resolveCycle(client, ws, projectId, cycleRef);

          const path = cycleIssuesPath(ws, projectId, cycle.id);
          const body = { issues: issueIds };
          if (isDryRunEnabled()) {
            printJson({
              dryRun: true,
              method: "POST",
              path,
              body,
              context: { workspace: ws, projectId, issueIds, cycleId: cycle.id },
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
              ? `Issue added to cycle "${cycle.name}" (uuid: ${issueIds[0]}).`
              : `${issueIds.length} issues added to cycle "${cycle.name}".`,
          );
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

          const path = `${cycleIssuesPath(ws, projectId, cycle.id)}${issueId}/`;
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
          printInfo(`Issue removed from cycle "${cycle.name}" (uuid: ${issueId}).`);
        } catch (err) {
          exitWithError(err, Boolean(opts.json));
        }
      },
    );

  // ── create ─────────────────────────────────────────────────────────────────

  command
    .command("create <name>")
    .description("Create a new cycle")
    .option("--description <text>", "Cycle description")
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
          description?: string;
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

          const body: Record<string, unknown> = {
            name,
            project_id: projectId,
            ...buildCycleBody(opts),
          };

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

  // ── update ──────────────────────────────────────────────────────────────────

  command
    .command("update <cycle>")
    .description("Update a cycle's properties (name or UUID)")
    .option("--name <name>", "New cycle name")
    .option("--description <text>", "Cycle description")
    .option("--start <date>", "Start date (YYYY-MM-DD, use 'none' to clear)")
    .option("--end <date>", "End date (YYYY-MM-DD, use 'none' to clear)")
    .option("--workspace <slug>", "Workspace slug (overrides active context)")
    .option(
      "--project <identifier-or-name>",
      "Project identifier or name (overrides active context)",
    )
    .option("--json", "Output raw JSON")
    .action(
      async (
        cycleRef: string,
        opts: {
          name?: string;
          description?: string;
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

          const cycle = await resolveCycle(client, ws, projectId, cycleRef);
          const body = buildCycleBody(opts);
          if (Object.keys(body).length === 0) {
            throw new ValidationError(
              "Nothing to update. Use --name, --description, --start, or --end.",
            );
          }

          const path = `workspaces/${ws}/projects/${projectId}/cycles/${cycle.id}/`;
          if (isDryRunEnabled()) {
            printJson({
              dryRun: true,
              method: "PATCH",
              path,
              body,
              context: { workspace: ws, projectId, cycleId: cycle.id },
            });
            return;
          }

          const updated = await client.patch<PlaneCycle>(path, body);
          if (opts.json) {
            printJson(updated);
            return;
          }
          printInfo(`Cycle "${updated.name}" updated successfully.`);
        } catch (err) {
          exitWithError(err, Boolean(opts.json));
        }
      },
    );

  // ── ensure ──────────────────────────────────────────────────────────────────

  command
    .command("ensure <name>")
    .description("Return an existing cycle by name, or create it if missing")
    .option("--description <text>", "Cycle description (applied only when creating)")
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
          description?: string;
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

          const path = `workspaces/${ws}/projects/${projectId}/cycles/`;
          const cycles = await fetchAll<PlaneCycle>(client, path);
          const existing = cycles.find((cycle) => cycle.name.toLowerCase() === name.toLowerCase());
          if (existing) {
            if (opts.json) {
              printJson({ status: "existing", cycle: existing });
              return;
            }
            printInfo(`Cycle "${existing.name}" already exists.`);
            return;
          }

          const body: Record<string, unknown> = {
            name,
            project_id: projectId,
            ...buildCycleBody(opts),
          };

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
            printJson({ status: "created", cycle: created });
            return;
          }
          printInfo(`Cycle "${created.name}" created successfully.`);
        } catch (err) {
          exitWithError(err, Boolean(opts.json));
        }
      },
    );

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
