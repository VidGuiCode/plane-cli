import { Command } from "commander";
import { loadConfig, createClient, requireActiveWorkspace } from "../core/config-store.js";
import { fetchAll } from "../core/api-client.js";
import { printInfo, printJson, printTable } from "../core/output.js";
import { ask } from "../core/prompt.js";
import { exitWithError, ValidationError } from "../core/errors.js";
import { isDryRunEnabled } from "../core/runtime.js";
import { stripHtml } from "../core/html.js";
import { resolveProject, resolveIssueRef } from "../core/resolvers.js";
import type { PlaneComment } from "../core/types.js";

export function createCommentCommand(): Command {
  const command = new Command("comment")
    .description("Work with issue comments")
    .action(() => command.help());

  command
    .command("list <issue>")
    .description("List comments on an issue. Accepts: 42, PROJ-42, or UUID")
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

          const { issueId, projectId } = await resolveCommentIssueTarget(
            ws,
            issueRef,
            opts.project,
            config,
            client,
            style,
          );

          const comments = await fetchAll<PlaneComment>(
            client,
            `workspaces/${ws}/projects/${projectId}/${style}/${issueId}/comments/`,
          );

          if (comments.length === 0) {
            printInfo("No comments found.");
            return;
          }

          if (opts.json) {
            printJson(comments);
            return;
          }

          const rows = comments.map((comment) => [
            comment.id,
            commentAuthor(comment),
            comment.created_at?.slice(0, 19).replace("T", " ") ?? "",
            commentPreview(comment),
          ]);
          printTable(rows, ["ID", "AUTHOR", "CREATED", "MESSAGE"]);
        } catch (err) {
          exitWithError(err, Boolean(opts.json));
        }
      },
    );

  command
    .command("add <issue>")
    .description("Add a comment to an issue. Accepts: 42, PROJ-42, or UUID")
    .option("--workspace <slug>", "Workspace slug (overrides active context)")
    .option(
      "--project <identifier-or-name>",
      "Project identifier or name (overrides active context)",
    )
    .option("--message <message>", "Comment text")
    .option("--json", "Output raw JSON")
    .action(
      async (
        issueRef: string,
        opts: { workspace?: string; project?: string; message?: string; json?: boolean },
      ) => {
        try {
          const config = loadConfig();
          const client = createClient(config);
          const ws = opts.workspace ?? requireActiveWorkspace(config);
          const style = client.issuesSegment();

          const { issueId, projectId } = await resolveCommentIssueTarget(
            ws,
            issueRef,
            opts.project,
            config,
            client,
            style,
          );

          const message = opts.message ?? (await ask("Comment"));
          if (!message) {
            throw new ValidationError("Comment text is required.");
          }

          const path = `workspaces/${ws}/projects/${projectId}/${style}/${issueId}/comments/`;
          const body = { comment_html: `<p>${message}</p>` };
          if (isDryRunEnabled()) {
            printJson({
              dryRun: true,
              method: "POST",
              path,
              body,
              context: { workspace: ws, projectId, issueId },
            });
            return;
          }

          const comment = await client.post<unknown>(path, body);
          if (opts.json) {
            printJson(comment);
            return;
          }
          printInfo("Comment added.");
        } catch (err) {
          exitWithError(err, Boolean(opts.json));
        }
      },
    );

  // ── update ────────────────────────────────────────────────────────────────

  command
    .command("update <commentId> <issue>")
    .description("Update a comment by UUID. Issue: 42, PROJ-42, or UUID")
    .option("--workspace <slug>", "Workspace slug (overrides active context)")
    .option(
      "--project <identifier-or-name>",
      "Project identifier or name (overrides active context)",
    )
    .option("--message <text>", "New comment text")
    .option("--json", "Output raw JSON")
    .action(
      async (
        commentId: string,
        issueRef: string,
        opts: { workspace?: string; project?: string; message?: string; json?: boolean },
      ) => {
        try {
          const config = loadConfig();
          const client = createClient(config);
          const ws = opts.workspace ?? requireActiveWorkspace(config);
          const style = client.issuesSegment();

          const { issueId, projectId } = await resolveCommentIssueTarget(
            ws,
            issueRef,
            opts.project,
            config,
            client,
            style,
          );

          const message = opts.message ?? (await ask("Comment"));
          if (!message) {
            throw new ValidationError("Comment text is required.");
          }

          const path = `workspaces/${ws}/projects/${projectId}/${style}/${issueId}/comments/${commentId}/`;
          const body = { comment_html: `<p>${message}</p>` };
          if (isDryRunEnabled()) {
            printJson({
              dryRun: true,
              method: "PATCH",
              path,
              body,
              context: { workspace: ws, projectId, issueId, commentId },
            });
            return;
          }

          const comment = await client.patch<unknown>(path, body);
          if (opts.json) {
            printJson(comment);
            return;
          }
          printInfo("Comment updated.");
        } catch (err) {
          exitWithError(err, Boolean(opts.json));
        }
      },
    );

  // ── delete ────────────────────────────────────────────────────────────────

  command
    .command("delete <commentId> <issue>")
    .description("Delete a comment by UUID. Issue: 42, PROJ-42, or UUID")
    .option("--workspace <slug>", "Workspace slug (overrides active context)")
    .option(
      "--project <identifier-or-name>",
      "Project identifier or name (overrides active context)",
    )
    .option("--json", "Output raw JSON")
    .action(
      async (
        commentId: string,
        issueRef: string,
        opts: { workspace?: string; project?: string; json?: boolean },
      ) => {
        try {
          const config = loadConfig();
          const client = createClient(config);
          const ws = opts.workspace ?? requireActiveWorkspace(config);
          const style = client.issuesSegment();

          const { issueId, projectId } = await resolveCommentIssueTarget(
            ws,
            issueRef,
            opts.project,
            config,
            client,
            style,
          );

          const path = `workspaces/${ws}/projects/${projectId}/${style}/${issueId}/comments/${commentId}/`;
          if (isDryRunEnabled()) {
            printJson({
              dryRun: true,
              method: "DELETE",
              path,
              context: { workspace: ws, projectId, issueId, commentId },
            });
            return;
          }

          await client.delete(path);
          if (opts.json) {
            printJson({ deleted: true, commentId, issueId, projectId });
            return;
          }
          printInfo("Comment deleted.");
        } catch (err) {
          exitWithError(err, Boolean(opts.json));
        }
      },
    );

  return command;
}

async function resolveCommentIssueTarget(
  workspace: string,
  issueRef: string,
  projectRef: string | undefined,
  config: ReturnType<typeof loadConfig>,
  client: ReturnType<typeof createClient>,
  style: ReturnType<ReturnType<typeof createClient>["issuesSegment"]>,
): Promise<{ issueId: string; projectId: string }> {
  let activeProjectId: string | undefined;
  let activeProjectIdentifier: string | undefined;

  if (projectRef) {
    const proj = await resolveProject(client, workspace, projectRef);
    activeProjectId = proj.id;
    activeProjectIdentifier = proj.identifier;
  } else if (config.context.activeProject) {
    activeProjectId = config.context.activeProject;
    activeProjectIdentifier = config.context.activeProjectIdentifier;
  }

  const { issueId, projectId } = await resolveIssueRef(
    client,
    workspace,
    activeProjectId,
    activeProjectIdentifier,
    style,
    issueRef,
  );

  return { issueId, projectId };
}

function commentAuthor(comment: PlaneComment): string {
  if (comment.created_by_detail?.display_name) return comment.created_by_detail.display_name;
  if (comment.actor_detail?.display_name) return comment.actor_detail.display_name;
  if (
    comment.created_by &&
    typeof comment.created_by === "object" &&
    comment.created_by.display_name
  ) {
    return comment.created_by.display_name;
  }
  if (typeof comment.created_by === "string") return comment.created_by;
  return "-";
}

function commentPreview(comment: PlaneComment): string {
  const raw = comment.comment_html
    ? stripHtml(comment.comment_html)
    : (comment.comment_stripped ?? "");
  const singleLine = raw.replace(/\s+/g, " ").trim();
  if (!singleLine) return "[empty]";
  return singleLine.length > 72 ? `${singleLine.slice(0, 69)}...` : singleLine;
}
