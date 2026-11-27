import { Command } from "commander";
import { spawn } from "node:child_process";
import {
  loadConfig,
  createClient,
  requireActiveWorkspace,
  requireActiveProject,
  requireActiveAccount,
} from "../core/config-store.js";
import { unwrap, fetchAll } from "../core/api-client.js";
import { printInfo, printError, printTable, printJson } from "../core/output.js";
import { ask } from "../core/prompt.js";
import { exitWithError, ValidationError } from "../core/errors.js";
import { isDryRunEnabled } from "../core/runtime.js";
import { stripHtml } from "../core/html.js";
import { htmlToMarkdown } from "../core/markdown.js";
import { readIssueDescription } from "../core/issue-description.js";
import {
  executeIssueCreate,
  planIssueCreate,
  previewIssueCreate,
  validateCreateOptions,
  type CreateOptions,
  type IssueCreateFields,
} from "../core/issue-create.js";
import { createIssueBatch, readIssueCreateBatch } from "../core/issue-create-batch.js";
import {
  assertIssueUpdateRoundTrip,
  buildIssueUpdateBaseBody,
  resolveIssueUpdateLabels,
  resolveIssueUpdateParent,
  resolveIssueUpdateState,
  validateIssueUpdateLabelIds,
  type IssueUpdateFields,
} from "../core/issue-update.js";
import {
  hasIssueUpdateFlags,
  readIssueUpdateBatch,
  updateIssueBatch,
} from "../core/issue-update-batch.js";
import {
  resolveProject,
  resolveIssueRef,
  buildStateMap,
  resolveState,
  resolveMember,
  resolveCurrentUserId,
  normalizeIssue,
  projectIssueFields,
  findUnknownFields,
} from "../core/resolvers.js";
import { fetchProjects } from "../core/discovery.js";
import type { PlaneIssue, PlaneState } from "../core/types.js";

/**
 * Warn (on stderr, keeping stdout pure JSON) when `--fields` contains names that
 * aren't keys of the normalized issue — otherwise they're silently dropped and
 * read as empty values in scripts.
 */
function warnUnknownFields(normalized: Record<string, unknown>, fieldsCsv: string): void {
  const unknown = findUnknownFields(normalized, fieldsCsv);
  if (unknown.length === 0) return;
  const valid = Object.keys(normalized).sort().join(", ");
  console.error(
    `Warning: ignoring unknown --fields name(s): ${unknown.join(", ")}. Valid fields: ${valid}`,
  );
}

export { assertIssueUpdateRoundTrip } from "../core/issue-update.js";

export function createIssueCommand(): Command {
  const command = new Command("issue")
    .description("Work with Plane issues")
    .action(() => command.help());

  // ── list ──────────────────────────────────────────────────────────────────

  command
    .command("list")
    .description("List issues in the active (or specified) project")
    .option("--workspace <slug>", "Workspace slug (overrides active context)")
    .option(
      "--project <identifier-or-name>",
      "Project identifier, name, or UUID; ALL lists issues across all workspace projects",
    )
    .option("--state <names>", "Filter by state name(s), comma-separated (e.g. Todo,InProgress)")
    .option(
      "--priority <values>",
      "Filter by priority, comma-separated: urgent | high | medium | low | none",
    )
    .option(
      "--assignee <names>",
      "Filter by assignee(s), comma-separated display names/emails or 'me'",
    )
    .option("--updated-since <date>", "Filter issues updated on or after this date (YYYY-MM-DD)")
    .option(
      "--search <query>",
      "Filter by keyword in title, identifier, or description (case-insensitive)",
    )
    .option("--json", "Output raw JSON")
    .option("--fields <names>", "Comma-separated fields for JSON output")
    .option(
      "--columns <list>",
      "Comma-separated columns for the table (id,title,state,priority,due,start,assignee,labels,uuid,created,updated)",
    )
    .action(
      async (opts: {
        workspace?: string;
        project?: string;
        state?: string;
        priority?: string;
        assignee?: string;
        updatedSince?: string;
        search?: string;
        json?: boolean;
        fields?: string;
        columns?: string;
      }) => {
        try {
          const config = loadConfig();
          const client = createClient(config);
          const ws = opts.workspace ?? requireActiveWorkspace(config);

          // Resolve assignee(s)
          let assigneeIds: string[] | undefined;
          if (opts.assignee) {
            const names = opts.assignee
              .split(",")
              .map((s) => s.trim())
              .filter(Boolean);
            assigneeIds = await Promise.all(
              names.map((n) =>
                n.toLowerCase() === "me"
                  ? resolveCurrentUserId(client)
                  : resolveMember(client, ws, n),
              ),
            );
          }

          const filterOpts = {
            states: opts.state
              ?.split(",")
              .map((s) => s.trim())
              .filter(Boolean),
            priorities: opts.priority
              ?.split(",")
              .map((s) => s.trim())
              .filter(Boolean),
            assigneeIds,
            updatedSince: opts.updatedSince,
            search: opts.search,
            json: opts.json,
            fields: opts.fields,
            columns: opts.columns,
          };

          if (opts.project && opts.project.trim().toUpperCase() === "ALL") {
            await listIssuesAllProjects(client, ws, filterOpts);
            return;
          }

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

          await listIssuesCore(client, ws, projectId, identifier, filterOpts);
        } catch (err) {
          exitWithError(err, Boolean(opts.json));
        }
      },
    );

  // ── mine ─────────────────────────────────────────────────────────────────

  command
    .command("mine")
    .description("List issues assigned to you (shortcut for: issue list --assignee me)")
    .option("--workspace <slug>", "Workspace slug (overrides active context)")
    .option(
      "--project <identifier-or-name>",
      "Project identifier, name, or UUID; ALL lists your issues across all workspace projects",
    )
    .option("--state <names>", "Filter by state name(s), comma-separated")
    .option(
      "--priority <values>",
      "Filter by priority, comma-separated: urgent | high | medium | low | none",
    )
    .option("--updated-since <date>", "Filter issues updated on or after this date (YYYY-MM-DD)")
    .option(
      "--search <query>",
      "Filter by keyword in title, identifier, or description (case-insensitive)",
    )
    .option("--json", "Output raw JSON")
    .option("--fields <names>", "Comma-separated fields for JSON output")
    .option(
      "--columns <list>",
      "Comma-separated columns for the table (id,title,state,priority,due,start,assignee,labels,uuid,created,updated)",
    )
    .action(
      async (opts: {
        workspace?: string;
        project?: string;
        state?: string;
        priority?: string;
        updatedSince?: string;
        search?: string;
        json?: boolean;
        fields?: string;
        columns?: string;
      }) => {
        try {
          const config = loadConfig();
          const client = createClient(config);
          const ws = opts.workspace ?? requireActiveWorkspace(config);

          const myId = await resolveCurrentUserId(client);

          const filterOpts = {
            states: opts.state
              ?.split(",")
              .map((s) => s.trim())
              .filter(Boolean),
            priorities: opts.priority
              ?.split(",")
              .map((s) => s.trim())
              .filter(Boolean),
            assigneeIds: [myId],
            updatedSince: opts.updatedSince,
            search: opts.search,
            json: opts.json,
            fields: opts.fields,
            columns: opts.columns,
          };

          if (opts.project && opts.project.trim().toUpperCase() === "ALL") {
            await listIssuesAllProjects(client, ws, filterOpts);
            return;
          }

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

          await listIssuesCore(client, ws, projectId, identifier, filterOpts);
        } catch (err) {
          exitWithError(err, Boolean(opts.json));
        }
      },
    );

  // ── get ───────────────────────────────────────────────────────────────────

  command
    .command("get <issue>")
    .alias("view")
    .description(
      "Fetch a single issue. Accepts: 42 (active project), PROJ-42 (any project), or UUID",
    )
    .option("--workspace <slug>", "Workspace slug (overrides active context)")
    .option(
      "--project <identifier-or-name>",
      "Project identifier or name (overrides active context)",
    )
    .option("--json", "Output raw JSON")
    .option("--fields <names>", "Comma-separated fields for JSON output")
    .option("--markdown", "Render the description as Markdown in text output")
    .action(
      async (
        issueRef: string,
        opts: {
          workspace?: string;
          project?: string;
          json?: boolean;
          fields?: string;
          markdown?: boolean;
        },
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

          const { issueId, projectId, identifier } = await resolveIssueRef(
            client,
            ws,
            activeProjectId,
            activeProjectIdentifier,
            style,
            issueRef,
          );

          const [issue, stateRes] = await Promise.all([
            client.get<PlaneIssue>(`workspaces/${ws}/projects/${projectId}/${style}/${issueId}/`),
            client.get<unknown>(`workspaces/${ws}/projects/${projectId}/states/`),
          ]);
          const stateMap = buildStateMap(unwrap<PlaneState>(stateRes));

          if (opts.json) {
            const normalized = normalizeIssue(issue, stateMap, identifier, projectId);
            if (opts.fields) warnUnknownFields(normalized, opts.fields);
            printJson(opts.fields ? projectIssueFields(normalized, opts.fields) : normalized);
            return;
          }

          printInfo(`${identifier}-${issue.sequence_id}  ${issue.name}`);
          printInfo(`State:       ${resolveState(issue, stateMap)}`);
          printInfo(`Priority:    ${issue.priority ?? "-"}`);

          if (opts.markdown && issue.description_html) {
            printInfo(`Description (markdown):\n${htmlToMarkdown(issue.description_html)}`);
          } else if (issue.description_html) {
            const text = stripHtml(issue.description_html);
            printInfo(`Description: ${text || "-"}`);
          } else {
            printInfo(`Description: ${issue.description_stripped ?? "-"}`);
          }

          // Parent
          if (issue.parent) {
            printInfo(`Parent:      ${issue.parent}`);
          }

          // Assignees
          const assignees = issue.assignees ?? [];
          printInfo(`Assignees:   ${assignees.length > 0 ? assignees.join(", ") : "-"}`);

          // Labels
          const labels = issue.labels ?? [];
          const labelNames = labels.map((l) =>
            typeof l === "object" && "name" in l ? l.name : String(l),
          );
          printInfo(`Labels:      ${labelNames.length > 0 ? labelNames.join(", ") : "-"}`);

          if (issue.target_date) printInfo(`Due:         ${issue.target_date}`);
          if (issue.start_date) printInfo(`Start:       ${issue.start_date}`);
          printInfo(`Created:     ${issue.created_at}`);
          printInfo(`Updated:     ${issue.updated_at}`);
        } catch (err) {
          exitWithError(err, Boolean(opts.json));
        }
      },
    );

  // ── create ────────────────────────────────────────────────────────────────

  command
    .command("create")
    .description("Create an issue in the active (or specified) project")
    .option("--workspace <slug>", "Workspace slug (overrides active context)")
    .option(
      "--project <identifier-or-name>",
      "Project identifier or name (overrides active context)",
    )
    .option("--title <title>", "Issue title")
    .option("--description <description>", "Issue description")
    .option("--description-html <html>", "Raw HTML description (exclusive with --description)")
    .option("--description-file <path|->", "Read a plain-text description from a file or stdin")
    .option(
      "--description-markdown <markdown>",
      "Markdown description, converted to HTML (exclusive with the other --description-* flags)",
    )
    .option("--state <state>", "State name or ID")
    .option("--create-labels", "Create missing named labels")
    .option("--ignore-missing-labels", "Skip missing named labels")
    .option("--validate-only", "Check the issue and its resources without writing")
    .option("--priority <priority>", "Priority: urgent | high | medium | low | none")
    .option("--assignee <name>", "Assignee display name or email (repeatable)", collect, [])
    .option("--label <name>", "Label name (case-insensitive, repeatable)", collect, [])
    .option(
      "--label-id <uuid>",
      "Label UUID (repeatable, alternative to --label, skips name resolution)",
      collect,
      [],
    )
    .option("--parent <ref>", "Parent issue ref (sequence number, PROJ-42, or UUID)")
    .option("--due <YYYY-MM-DD>", "Due date")
    .option("--start <YYYY-MM-DD>", "Start date")
    .option("--module <name>", "Add the new issue to this module (name or UUID)")
    .option("--cycle <name>", "Add the new issue to this cycle (name or UUID)")
    .option("--json", "Output raw JSON")
    .action(
      async (
        opts: Omit<IssueCreateFields, "title"> &
          CreateOptions & {
            workspace?: string;
            project?: string;
            title?: string;
            json?: boolean;
          },
      ) => {
        try {
          validateCreateOptions(opts);
          if (opts.descriptionFile === "-" && opts.title === undefined) {
            throw new ValidationError(
              "--title is required when reading the description from stdin.",
            );
          }
          const descriptionHtml = readIssueDescription(opts);
          const config = loadConfig();
          const client = createClient(config);
          const workspace = opts.workspace ?? requireActiveWorkspace(config);
          const project = opts.project
            ? await resolveProject(client, workspace, opts.project)
            : requireActiveProject(config);
          const { id: projectId, identifier } = project;
          if (opts.validateOnly && !opts.project) {
            await resolveProject(client, workspace, projectId);
          }

          const title = opts.title ?? (await ask("Title"));
          let description = opts.description === "" ? undefined : descriptionHtml;
          if (descriptionHtml === undefined) {
            const text = await ask("Description (optional)", "");
            if (text) description = readIssueDescription({ description: text });
          }
          const plan = await planIssueCreate(
            client,
            { workspace, projectId, projectIdentifier: identifier },
            client.issuesSegment(),
            {
              ...opts,
              title,
              description: undefined,
              descriptionHtml: description,
              descriptionFile: undefined,
              descriptionMarkdown: undefined,
            },
            opts,
            Boolean(opts.validateOnly),
          );

          const dryRun = isDryRunEnabled();
          if (dryRun || opts.validateOnly) {
            const calls = previewIssueCreate(plan);
            if (opts.validateOnly) printJson({ valid: true, requests: calls });
            else printJson(calls.length === 1 ? calls[0] : calls);
            return;
          }

          const { issue, membershipErrors } = await executeIssueCreate(client, plan);
          if (plan.labels.ignored.length) {
            console.error(`Warning: skipped missing labels: ${plan.labels.ignored.join(", ")}`);
          }

          if (opts.json) {
            if (membershipErrors.length > 0) {
              printJson({ issue, membership: { ok: false, errors: membershipErrors } });
              process.exit(1);
            }
            printJson(issue);
            return;
          }

          printInfo(`Created ${identifier}-${issue.sequence_id}: ${issue.name}`);
          if (membershipErrors.length > 0) {
            printError(
              `Issue ${identifier}-${issue.sequence_id} (uuid: ${issue.id}) created, but membership failed: ${membershipErrors.join(
                "; ",
              )}. Retry with: plane module add ${issue.id} <module>`,
            );
            process.exit(1);
          }
          for (const { kind, name } of plan.membership) printInfo(`Added to ${kind} "${name}".`);
        } catch (err) {
          exitWithError(err, Boolean(opts.json));
        }
      },
    );

  command
    .command("bulk-create")
    .description("Create issues from a JSON or YAML array in one project")
    .requiredOption("--file <path|->", "Read issue specs from a file or stdin")
    .option("--workspace <slug>", "Workspace slug (overrides active context)")
    .option("--project <identifier-or-name>", "Project identifier, name, or UUID")
    .option("--create-labels", "Create missing named labels")
    .option("--ignore-missing-labels", "Skip missing named labels")
    .option("--validate-only", "Check all issues and resources without writing")
    .option("--json", "Output a JSON summary")
    .action(
      async (
        opts: CreateOptions & {
          file: string;
          workspace?: string;
          project?: string;
          json?: boolean;
        },
      ) => {
        try {
          validateCreateOptions(opts);
          const entries = readIssueCreateBatch(opts.file);
          const config = loadConfig();
          const client = createClient(config);
          const workspace = opts.workspace ?? requireActiveWorkspace(config);
          const projectRef = opts.project ?? requireActiveProject(config).id;
          const project = await resolveProject(client, workspace, projectRef);
          const dryRun = isDryRunEnabled();
          const summary = await createIssueBatch(
            client,
            { workspace, projectId: project.id, projectIdentifier: project.identifier },
            entries,
            opts.file,
            opts,
            dryRun,
          );
          if (opts.json || dryRun || opts.validateOnly) {
            printJson(summary);
          } else {
            for (const row of summary.results) {
              const label = `Row ${row.row}${row.title ? ` (${row.title})` : ""}`;
              if (row.status === "failed") printError(`${label}: ${row.error}`);
              if (row.status === "blocked")
                printInfo(`${label}: skipped because preflight failed.`);
              if (row.status === "created" || row.status === "partial") {
                printInfo(
                  `${label}: created ${project.identifier}-${row.issue.sequence_id} (uuid: ${row.issue.id})`,
                );
                if (row.membershipErrors)
                  printError(`${label}: ${row.membershipErrors.join("; ")}`);
                if (row.ignoredLabels)
                  console.error(
                    `Warning: ${label} skipped missing labels: ${row.ignoredLabels.join(", ")}`,
                  );
              }
            }
            printInfo(`Created ${summary.created} issue(s). Failed ${summary.failed} row(s).`);
          }
          if (summary.failed) process.exitCode = 1;
        } catch (error) {
          exitWithError(error, Boolean(opts.json));
        }
      },
    );

  // ── update ────────────────────────────────────────────────────────────────

  command
    .command("update [issue]")
    .description(
      "Update comma-separated issue refs (PROJ-1,2,3) or apply per-issue changes from JSON",
    )
    .option("--from-json <file|->", "Read a batch of issue updates from a JSON file or stdin")
    .option("--workspace <slug>", "Workspace slug (overrides active context)")
    .option(
      "--project <identifier-or-name>",
      "Project identifier or name (overrides active context)",
    )
    .option("--title <title>", "New title")
    .option("--name <name>", "New title (alias for --title)")
    .option("--description <description>", "New description")
    .option("--description-html <html>", "Raw HTML description (exclusive with --description)")
    .option("--description-file <path|->", "Read a plain-text description from a file or stdin")
    .option(
      "--description-markdown <markdown>",
      "Markdown description, converted to HTML (exclusive with the other --description-* flags)",
    )
    .option("--priority <priority>", "Priority: urgent | high | medium | low | none")
    .option("--state <state>", "State name or ID")
    .option("--assignee <name>", "Assignee display name or email (repeatable)", collect, [])
    .option(
      "--label <name>",
      "Label name (case-insensitive, repeatable) — replaces existing labels",
      collect,
      [],
    )
    .option(
      "--label-id <uuid>",
      "Label UUID (repeatable, alternative to --label, skips name resolution)",
      collect,
      [],
    )
    .option(
      "--parent <ref>",
      "Parent issue ref (sequence number, PROJ-42, or UUID; 'none' to clear) — single-issue only",
    )
    .option("--due <YYYY-MM-DD>", "Due date (use 'none' to clear)")
    .option("--start <YYYY-MM-DD>", "Start date (use 'none' to clear)")
    .option("--json", "Output raw JSON")
    .action(
      async (
        issueRefArg: string | undefined,
        opts: IssueUpdateFields & {
          fromJson?: string;
          workspace?: string;
          project?: string;
          assignee: string[];
          label: string[];
          labelId: string[];
          json?: boolean;
        },
      ) => {
        try {
          if (opts.fromJson !== undefined) {
            if (issueRefArg !== undefined || hasIssueUpdateFlags(opts)) {
              throw new ValidationError(
                "--from-json cannot be combined with an issue argument or update flags.",
              );
            }
            const entries = readIssueUpdateBatch(opts.fromJson);
            const config = loadConfig();
            const client = createClient(config);
            const workspace = opts.workspace ?? requireActiveWorkspace(config);
            const dryRun = isDryRunEnabled();
            const summary = await updateIssueBatch(
              client,
              {
                workspace,
                project: opts.project,
                activeProjectId: config.context.activeProject,
                activeProjectIdentifier: config.context.activeProjectIdentifier,
              },
              entries,
              dryRun,
            );
            if (opts.json || dryRun) {
              printJson(summary);
            } else {
              for (const entry of summary.results) {
                const reference = entry.issueId
                  ? `${entry.issue} (uuid: ${entry.issueId})`
                  : entry.issue;
                if (entry.status === "failed") printError(`${reference}: ${entry.error}`);
                else printInfo(`Updated ${reference}`);
              }
              printInfo(`Updated ${summary.updated} issue(s). Failed ${summary.failed}.`);
            }
            if (summary.failed) process.exitCode = 1;
            return;
          }
          if (issueRefArg === undefined) {
            throw new ValidationError("Provide an issue ref or --from-json <file|->.");
          }
          const descriptionHtml = readIssueDescription(opts);
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

          const refs = issueRefArg
            .split(",")
            .map((r) => r.trim())
            .filter(Boolean);
          const isBulk = refs.length > 1;

          if (isBulk && opts.parent) {
            throw new ValidationError(
              "--parent cannot be used with bulk updates (multiple issue refs).",
            );
          }

          // Resolve all refs up-front — fail before sending any API calls
          const resolved = await Promise.all(
            refs.map((ref) =>
              resolveIssueRef(client, ws, activeProjectId, activeProjectIdentifier, style, ref),
            ),
          );

          const baseBody = await buildIssueUpdateBaseBody(client, ws, {
            ...opts,
            description: undefined,
            descriptionHtml,
            descriptionFile: undefined,
            descriptionMarkdown: undefined,
          });

          // Resolve state and labels per unique project (handles cross-project bulk)
          const uniqueProjectIds = [...new Set(resolved.map((r) => r.projectId))];

          const stateIdByProject = new Map<string, string>();
          if (opts.state) {
            const state = opts.state;
            await Promise.all(
              uniqueProjectIds.map(async (pid) => {
                stateIdByProject.set(pid, await resolveIssueUpdateState(client, ws, pid, state));
              }),
            );
          }

          validateIssueUpdateLabelIds(opts.labelId);
          const labelIdsByProject = new Map<string, string[]>();
          if (opts.label.length > 0 || opts.labelId.length > 0) {
            await Promise.all(
              uniqueProjectIds.map(async (pid) => {
                labelIdsByProject.set(
                  pid,
                  await resolveIssueUpdateLabels(client, ws, pid, opts.label, opts.labelId),
                );
              }),
            );
          }

          // Resolve parent (single-issue only)
          if (opts.parent) {
            baseBody.parent = await resolveIssueUpdateParent(
              client,
              ws,
              resolved[0],
              style,
              opts.parent,
            );
          }

          if (
            Object.keys(baseBody).length === 0 &&
            !opts.state &&
            opts.label.length === 0 &&
            opts.labelId.length === 0
          ) {
            throw new ValidationError(
              "Nothing to update. Use --title (or --name), --description, --description-html, --description-file, --description-markdown, --priority, --state, --assignee, --label, --label-id, --parent, --due, or --start.",
            );
          }

          // Dry-run: print all payloads and exit
          if (isDryRunEnabled()) {
            const dryRunPayloads = resolved.map(({ issueId, projectId, identifier }) => {
              const body = { ...baseBody };
              if (stateIdByProject.has(projectId)) body.state = stateIdByProject.get(projectId);
              if (labelIdsByProject.has(projectId)) body.labels = labelIdsByProject.get(projectId);
              return {
                dryRun: true,
                method: "PATCH",
                path: `workspaces/${ws}/projects/${projectId}/${style}/${issueId}/`,
                body,
                context: { workspace: ws, projectId, projectIdentifier: identifier, issueId },
              };
            });
            printJson(isBulk ? dryRunPayloads : dryRunPayloads[0]);
            return;
          }

          // Patch all issues in parallel
          const updated = await Promise.all(
            resolved.map(({ issueId, projectId }) => {
              const body = { ...baseBody };
              if (stateIdByProject.has(projectId)) body.state = stateIdByProject.get(projectId);
              if (labelIdsByProject.has(projectId)) body.labels = labelIdsByProject.get(projectId);
              return client
                .patch<PlaneIssue>(
                  `workspaces/${ws}/projects/${projectId}/${style}/${issueId}/`,
                  body,
                )
                .then((issue) => {
                  assertIssueUpdateRoundTrip(issue, body);
                  return issue;
                });
            }),
          );

          if (opts.json) {
            printJson(isBulk ? updated : updated[0]);
            return;
          }

          if (isBulk) {
            const rows = updated.map((issue, i) => [
              `${resolved[i].identifier}-${issue.sequence_id}`,
              issue.name,
            ]);
            printTable(rows, ["ID", "TITLE"]);
          } else {
            const issue = updated[0];
            printInfo(
              `Updated ${resolved[0].identifier}-${issue.sequence_id}: ${issue.name} (uuid: ${resolved[0].issueId})`,
            );
          }
        } catch (err) {
          exitWithError(err, Boolean(opts.json));
        }
      },
    );

  // ── delete ────────────────────────────────────────────────────────────────

  command
    .command("delete <issue>")
    .description("Delete an issue. Accepts: 42, PROJ-42, or UUID")
    .option("--workspace <slug>", "Workspace slug (overrides active context)")
    .option(
      "--project <identifier-or-name>",
      "Project identifier or name (overrides active context)",
    )
    .option("--json", "Output raw JSON")
    .action(
      async (issueRef: string, opts: { workspace?: string; project?: string; json?: boolean }) => {
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

          const { issueId, projectId, identifier, sequenceId } = await resolveIssueRef(
            client,
            ws,
            activeProjectId,
            activeProjectIdentifier,
            style,
            issueRef,
          );

          const path = `workspaces/${ws}/projects/${projectId}/${style}/${issueId}/`;
          if (isDryRunEnabled()) {
            printJson({
              dryRun: true,
              method: "DELETE",
              path,
              context: {
                workspace: ws,
                projectId,
                projectIdentifier: identifier,
                issueId,
              },
            });
            return;
          }

          await client.delete(path);
          if (opts.json) {
            printJson({ deleted: true, issueId, projectId, identifier });
            return;
          }
          printInfo(
            `Deleted ${identifier && sequenceId !== undefined ? `${identifier}-${sequenceId}` : issueRef} (uuid: ${issueId}).`,
          );
        } catch (err) {
          exitWithError(err, Boolean(opts.json));
        }
      },
    );

  // ── close ─────────────────────────────────────────────────────────────────

  command
    .command("close <issue>")
    .description("Move an issue to its first completed state")
    .option("--workspace <slug>", "Workspace slug (overrides active context)")
    .option(
      "--project <identifier-or-name>",
      "Project identifier or name (overrides active context)",
    )
    .option("--json", "Output raw JSON")
    .action(
      async (issueRef: string, opts: { workspace?: string; project?: string; json?: boolean }) => {
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

          const { issueId, projectId, identifier } = await resolveIssueRef(
            client,
            ws,
            activeProjectId,
            activeProjectIdentifier,
            style,
            issueRef,
          );

          const stateRes = await client.get<unknown>(
            `workspaces/${ws}/projects/${projectId}/states/`,
          );
          const states = unwrap<PlaneState>(stateRes);
          const completed = states.find((s) => s.group === "completed");
          if (!completed) throw new ValidationError("No completed state found in this project.");

          const path = `workspaces/${ws}/projects/${projectId}/${style}/${issueId}/`;
          const body = { state: completed.id };
          if (isDryRunEnabled()) {
            printJson({
              dryRun: true,
              method: "PATCH",
              path,
              body,
              context: {
                workspace: ws,
                projectId,
                projectIdentifier: identifier,
                issueId,
              },
            });
            return;
          }

          const issue = await client.patch<PlaneIssue>(path, body);
          if (opts.json) {
            printJson(issue);
            return;
          }
          printInfo(
            `Closed ${identifier ? `${identifier}-${issue.sequence_id}` : issueRef} (uuid: ${issueId}).`,
          );
        } catch (err) {
          exitWithError(err, Boolean(opts.json));
        }
      },
    );

  // ── reopen ────────────────────────────────────────────────────────────────

  command
    .command("reopen <issue>")
    .description("Move an issue back to its first backlog (or unstarted) state")
    .option("--workspace <slug>", "Workspace slug (overrides active context)")
    .option(
      "--project <identifier-or-name>",
      "Project identifier or name (overrides active context)",
    )
    .option("--json", "Output raw JSON")
    .action(
      async (issueRef: string, opts: { workspace?: string; project?: string; json?: boolean }) => {
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

          const { issueId, projectId, identifier } = await resolveIssueRef(
            client,
            ws,
            activeProjectId,
            activeProjectIdentifier,
            style,
            issueRef,
          );

          const stateRes = await client.get<unknown>(
            `workspaces/${ws}/projects/${projectId}/states/`,
          );
          const states = unwrap<PlaneState>(stateRes);
          const reopen =
            states.find((s) => s.group === "backlog") ??
            states.find((s) => s.group === "unstarted");
          if (!reopen)
            throw new ValidationError("No backlog or unstarted state found in this project.");

          const path = `workspaces/${ws}/projects/${projectId}/${style}/${issueId}/`;
          const body = { state: reopen.id };
          if (isDryRunEnabled()) {
            printJson({
              dryRun: true,
              method: "PATCH",
              path,
              body,
              context: {
                workspace: ws,
                projectId,
                projectIdentifier: identifier,
                issueId,
              },
            });
            return;
          }

          const issue = await client.patch<PlaneIssue>(path, body);
          if (opts.json) {
            printJson(issue);
            return;
          }
          printInfo(
            `Reopened ${identifier ? `${identifier}-${issue.sequence_id}` : issueRef} (uuid: ${issueId}).`,
          );
        } catch (err) {
          exitWithError(err, Boolean(opts.json));
        }
      },
    );

  // ── open ───────────────────────────────────────────────────────────────────

  command
    .command("open <issue>")
    .description("Open an issue in the default browser. Accepts: 42, PROJ-42, or UUID")
    .option("--workspace <slug>", "Workspace slug (overrides active context)")
    .option(
      "--project <identifier-or-name>",
      "Project identifier or name (overrides active context)",
    )
    .option("--json", "Output raw JSON")
    .action(
      async (issueRef: string, opts: { workspace?: string; project?: string; json?: boolean }) => {
        try {
          const config = loadConfig();
          const client = createClient(config);
          const ws = opts.workspace ?? requireActiveWorkspace(config);
          const style = client.issuesSegment();

          // Get baseUrl from active account for constructing the web URL
          const account = requireActiveAccount(config);
          const baseUrl = account.baseUrl.replace(/\/$/, ""); // Remove trailing slash

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

          const { issueId, projectId, identifier } = await resolveIssueRef(
            client,
            ws,
            activeProjectId,
            activeProjectIdentifier,
            style,
            issueRef,
          );

          // Fetch the issue to get its sequence_id for the URL
          const issue = await client.get<PlaneIssue>(
            `workspaces/${ws}/projects/${projectId}/${style}/${issueId}/`,
          );

          // Construct the Plane web URL
          // Format: {baseUrl}/{workspace}/projects/{project_identifier}/issues/{sequence_id}
          const url = `${baseUrl}/${ws}/projects/${identifier}/issues/${issue.sequence_id}`;

          // Open the URL in the default browser (cross-platform)
          const platform = process.platform;
          const command =
            platform === "darwin" ? "open" : platform === "win32" ? "start" : "xdg-open";
          const args = platform === "win32" ? ["", url] : [url]; // Windows start command needs an empty title arg

          if (isDryRunEnabled()) {
            printJson({
              dryRun: true,
              action: "issue.open",
              url,
              context: { workspace: ws, projectId, issueId, identifier },
            });
            return;
          }

          spawn(command, args, { shell: true, detached: true, stdio: "ignore" }).unref();

          if (opts.json) {
            printJson({ success: true, action: "issue.open", url, issueId, projectId, identifier });
            return;
          }

          printInfo(`Opened ${identifier}-${issue.sequence_id} in browser: ${url}`);
        } catch (err) {
          exitWithError(err, Boolean(opts.json));
        }
      },
    );

  // ── move ─────────────────────────────────────────────────────────────────

  command
    .command("move <issue>")
    .description("Move (or copy) an issue to a different project")
    .requiredOption("--to-project <identifier-or-name>", "Target project identifier or name")
    .option("--copy", "Copy the issue without deleting the original")
    .option("--workspace <slug>", "Workspace slug (overrides active context)")
    .option(
      "--project <identifier-or-name>",
      "Source project identifier or name (overrides active context)",
    )
    .option("--json", "Output raw JSON")
    .action(
      async (
        issueRef: string,
        opts: {
          toProject: string;
          copy?: boolean;
          workspace?: string;
          project?: string;
          json?: boolean;
        },
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

          const {
            issueId,
            projectId: srcProjectId,
            identifier: srcIdentifier,
          } = await resolveIssueRef(
            client,
            ws,
            activeProjectId,
            activeProjectIdentifier,
            style,
            issueRef,
          );

          const targetProject = await resolveProject(client, ws, opts.toProject);
          const tgtProjectId = targetProject.id;
          const tgtIdentifier = targetProject.identifier;

          if (srcProjectId === tgtProjectId) {
            throw new ValidationError("Source and target projects are the same.");
          }

          // Fetch full source issue
          const source = await client.get<PlaneIssue>(
            `workspaces/${ws}/projects/${srcProjectId}/${style}/${issueId}/`,
          );

          // Map state from source to target by group (best-effort)
          const [srcStates, tgtStates] = await Promise.all([
            client
              .get<unknown>(`workspaces/${ws}/projects/${srcProjectId}/states/`)
              .then((r) => unwrap<PlaneState>(r)),
            client
              .get<unknown>(`workspaces/${ws}/projects/${tgtProjectId}/states/`)
              .then((r) => unwrap<PlaneState>(r)),
          ]);

          const srcStateId =
            typeof source.state === "string"
              ? source.state
              : (source.state as PlaneState | undefined)?.id;
          const srcStateGroup = srcStates.find((s) => s.id === srcStateId)?.group ?? "backlog";

          const mappedState =
            tgtStates.find((s) => s.group === srcStateGroup) ??
            tgtStates.find((s) => s.group === "backlog") ??
            tgtStates.find((s) => s.group === "unstarted") ??
            tgtStates[0];

          if (!mappedState) {
            throw new ValidationError(
              `Target project "${tgtIdentifier}" has no states. Configure states before moving issues.`,
            );
          }

          const newBody: Record<string, unknown> = {
            name: source.name,
            state: mappedState.id,
            priority: source.priority ?? "none",
          };
          if (source.description_html) newBody.description_html = source.description_html;
          if (source.target_date) newBody.target_date = source.target_date;
          if (source.start_date) newBody.start_date = source.start_date;
          // assignees and labels are workspace/project-scoped IDs — omit to avoid ID mismatches
          // users can re-assign after move

          const createPath = `workspaces/${ws}/projects/${tgtProjectId}/${style}/`;
          const deletePath = `workspaces/${ws}/projects/${srcProjectId}/${style}/${issueId}/`;

          if (isDryRunEnabled()) {
            printJson({
              dryRun: true,
              action: opts.copy ? "issue.copy" : "issue.move",
              steps: [
                { method: "POST", path: createPath, body: newBody },
                ...(opts.copy ? [] : [{ method: "DELETE", path: deletePath }]),
              ],
              context: {
                source: `${srcIdentifier}-${source.sequence_id}`,
                targetProject: tgtIdentifier,
                stateMapping: `${srcStateGroup} → ${mappedState.name}`,
              },
            });
            return;
          }

          const newIssue = await client.post<PlaneIssue>(createPath, newBody);

          if (!opts.copy) {
            await client.delete(deletePath);
          }

          if (opts.json) {
            printJson({
              action: opts.copy ? "copied" : "moved",
              source: `${srcIdentifier}-${source.sequence_id}`,
              result: `${tgtIdentifier}-${newIssue.sequence_id}`,
              issue: newIssue,
            });
            return;
          }

          const verb = opts.copy ? "Copied" : "Moved";
          printInfo(
            `${verb} ${srcIdentifier}-${source.sequence_id} → ${tgtIdentifier}-${newIssue.sequence_id}: ${newIssue.name}`,
          );
        } catch (err) {
          exitWithError(err, Boolean(opts.json));
        }
      },
    );

  return command;
}

function collect(value: string, previous: string[]): string[] {
  return [...previous, value];
}

type IssueColumn = {
  header: string;
  get: (normalized: Record<string, unknown>) => string;
};

function cell(value: unknown): string {
  if (value === null || value === undefined) return "";
  if (Array.isArray(value)) return value.map(String).join(",");
  return String(value);
}

// Curated columns for the human issue table. Values come from the normalized
// issue so the column set stays consistent with `--fields` / `--json` output.
const ISSUE_COLUMNS: Record<string, IssueColumn> = {
  id: { header: "ID", get: (n) => cell(n.identifier) },
  uuid: { header: "UUID", get: (n) => cell(n.id) },
  title: { header: "TITLE", get: (n) => cell(n.title) },
  state: { header: "STATE", get: (n) => cell(n.state) },
  priority: { header: "PRIORITY", get: (n) => cell(n.priority) },
  due: { header: "DUE", get: (n) => cell(n.dueDate) },
  start: { header: "START", get: (n) => cell(n.startDate) },
  assignee: { header: "ASSIGNEE", get: (n) => cell(n.assignees) },
  labels: { header: "LABELS", get: (n) => cell(n.labels) },
  created: { header: "CREATED", get: (n) => cell(n.createdAt) },
  updated: { header: "UPDATED", get: (n) => cell(n.updatedAt) },
};

const DEFAULT_ISSUE_COLUMNS = ["id", "title", "state", "priority", "due"];

/**
 * Resolve the `--columns` value to a validated list of column keys, defaulting
 * to id/title/state/priority/due (which adds the DUE tracking column). Throws a
 * ValidationError naming any unknown columns.
 */
export function resolveIssueColumns(columnsCsv: string | undefined): string[] {
  if (!columnsCsv) return DEFAULT_ISSUE_COLUMNS;
  const requested = columnsCsv
    .split(/[,\s]+/)
    .map((c) => c.trim().toLowerCase())
    .filter(Boolean);
  if (requested.length === 0) return DEFAULT_ISSUE_COLUMNS;
  const unknown = requested.filter((c) => !(c in ISSUE_COLUMNS));
  if (unknown.length > 0) {
    throw new ValidationError(
      `Unknown --columns name(s): ${unknown.join(", ")}. Valid columns: ${Object.keys(
        ISSUE_COLUMNS,
      ).join(", ")}.`,
    );
  }
  return requested;
}

type IssueListFilters = {
  states?: string[];
  priorities?: string[];
  assigneeIds?: string[];
  updatedSince?: string;
  search?: string;
};

type IssueListOptions = IssueListFilters & {
  json?: boolean;
  fields?: string;
  columns?: string;
};

/** Apply the in-memory list filters. State names resolve against the given project's state list. */
function applyIssueFilters(
  issues: PlaneIssue[],
  filters: IssueListFilters,
  stateList: PlaneState[],
  identifier: string,
): PlaneIssue[] {
  // Build state-name → ID set for filter matching
  let stateFilterIds: Set<string> | undefined;
  if (filters.states && filters.states.length > 0) {
    const lowerNames = new Set(filters.states.map((s) => s.toLowerCase()));
    stateFilterIds = new Set(
      stateList.filter((s) => lowerNames.has(s.name.toLowerCase())).map((s) => s.id),
    );
  }

  let result = issues;

  if (stateFilterIds) {
    result = result.filter((issue) => {
      const stateId =
        typeof issue.state === "string"
          ? issue.state
          : ((issue.state as PlaneState | undefined)?.id ?? "");
      return stateFilterIds!.has(stateId);
    });
  }

  if (filters.priorities && filters.priorities.length > 0) {
    const prioritySet = new Set(filters.priorities.map((p) => p.toLowerCase()));
    result = result.filter((issue) => prioritySet.has((issue.priority ?? "none").toLowerCase()));
  }

  if (filters.assigneeIds && filters.assigneeIds.length > 0) {
    const assigneeSet = new Set(filters.assigneeIds);
    result = result.filter((issue) => (issue.assignees ?? []).some((a) => assigneeSet.has(a)));
  }

  if (filters.updatedSince) {
    const since = new Date(filters.updatedSince);
    if (isNaN(since.getTime())) {
      throw new ValidationError(`Invalid date "${filters.updatedSince}". Use YYYY-MM-DD format.`);
    }
    result = result.filter((issue) => new Date(issue.updated_at) >= since);
  }

  if (filters.search) {
    const query = filters.search.toLowerCase();
    result = result.filter((issue) => {
      const haystack = [
        issue.name ?? "",
        `${identifier}-${issue.sequence_id}`,
        stripHtml(issue.description_html ?? ""),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(query);
    });
  }

  return result;
}

type NormalizedIssueEntry = {
  issue: PlaneIssue;
  identifier: string;
  projectId: string;
  stateMap: Map<string, string>;
};

function renderIssueList(
  entries: NormalizedIssueEntry[],
  opts: { json?: boolean; fields?: string },
  columns: string[],
): void {
  if (entries.length === 0) {
    printInfo("No issues found.");
    return;
  }

  if (opts.json) {
    const normalized = entries.map(({ issue, identifier, projectId, stateMap }) =>
      normalizeIssue(issue, stateMap, identifier, projectId),
    );
    if (opts.fields) warnUnknownFields(normalized[0], opts.fields);
    printJson(
      opts.fields ? normalized.map((n) => projectIssueFields(n, opts.fields!)) : normalized,
    );
    return;
  }

  const rows = entries.map(({ issue, identifier, projectId, stateMap }) => {
    const normalized = normalizeIssue(issue, stateMap, identifier, projectId);
    return columns.map((col) => ISSUE_COLUMNS[col].get(normalized));
  });
  printTable(
    rows,
    columns.map((col) => ISSUE_COLUMNS[col].header),
  );
}

async function listIssuesCore(
  client: import("../core/api-client.js").PlaneApiClient,
  ws: string,
  projectId: string,
  identifier: string,
  opts: IssueListOptions,
): Promise<void> {
  const style = client.issuesSegment();
  const basePath = `workspaces/${ws}/projects/${projectId}/${style}/`;

  // Validate requested columns up-front so a typo fails before any network calls.
  const columns = resolveIssueColumns(opts.columns);

  const [allIssues, stateList] = await Promise.all([
    fetchAll<PlaneIssue>(client, basePath),
    client
      .get<unknown>(`workspaces/${ws}/projects/${projectId}/states/`)
      .then((r) => unwrap<PlaneState>(r)),
  ]);

  const stateMap = buildStateMap(stateList);
  const issues = applyIssueFilters(allIssues, opts, stateList, identifier);
  renderIssueList(
    issues.map((issue) => ({ issue, identifier, projectId, stateMap })),
    opts,
    columns,
  );
}

/** `--project ALL`: list issues across every project in the workspace in one call. */
async function listIssuesAllProjects(
  client: import("../core/api-client.js").PlaneApiClient,
  ws: string,
  opts: IssueListOptions,
): Promise<void> {
  const columns = resolveIssueColumns(opts.columns);
  const projects = await fetchProjects(client, ws);
  if (projects.length === 0) {
    printInfo("No projects found in this workspace.");
    return;
  }

  const style = client.issuesSegment();
  const perProject = await Promise.all(
    projects.map(async (project) => {
      const [issues, stateList] = await Promise.all([
        fetchAll<PlaneIssue>(client, `workspaces/${ws}/projects/${project.id}/${style}/`),
        client
          .get<unknown>(`workspaces/${ws}/projects/${project.id}/states/`)
          .then((r) => unwrap<PlaneState>(r)),
      ]);
      return { project, issues, stateList, stateMap: buildStateMap(stateList) };
    }),
  );

  const entries = perProject.flatMap(({ project, issues, stateList, stateMap }) =>
    applyIssueFilters(issues, opts, stateList, project.identifier).map((issue) => ({
      issue,
      identifier: project.identifier,
      projectId: project.id,
      stateMap,
    })),
  );
  renderIssueList(entries, opts, columns);
}
