import { Command } from "commander";
import { loadConfig, createClient, requireActiveWorkspace, } from "../core/config-store.js";
import { PlaneApiError, fetchAll } from "../core/api-client.js";
import { printInfo, printError, printJson, printTable } from "../core/output.js";
import { ask } from "../core/prompt.js";
import { stripHtml } from "../core/html.js";
import { resolveProject, resolveIssueRef } from "../core/resolvers.js";
export function createCommentCommand() {
    const command = new Command("comment")
        .description("Work with issue comments")
        .action(() => command.help());
    command
        .command("list <issue>")
        .description("List comments on an issue. Accepts: 42, PROJ-42, or UUID")
        .option("--workspace <slug>", "Workspace slug (overrides active context)")
        .option("--project <identifier>", "Project identifier (overrides active context)")
        .option("--json", "Output raw JSON")
        .action(async (issueRef, opts) => {
        try {
            const config = loadConfig();
            const client = createClient(config);
            const ws = opts.workspace ?? requireActiveWorkspace(config);
            const style = client.issuesSegment();
            const { issueId, projectId } = await resolveCommentIssueTarget(ws, issueRef, opts.project, config, client, style);
            const comments = await fetchAll(client, `workspaces/${ws}/projects/${projectId}/${style}/${issueId}/comments/`);
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
        }
        catch (err) {
            printError(err instanceof PlaneApiError ? err.message : String(err));
            process.exit(1);
        }
    });
    command
        .command("add <issue>")
        .description("Add a comment to an issue. Accepts: 42, PROJ-42, or UUID")
        .option("--workspace <slug>", "Workspace slug (overrides active context)")
        .option("--project <identifier>", "Project identifier (overrides active context)")
        .option("--message <message>", "Comment text")
        .action(async (issueRef, opts) => {
        try {
            const config = loadConfig();
            const client = createClient(config);
            const ws = opts.workspace ?? requireActiveWorkspace(config);
            const style = client.issuesSegment();
            const { issueId, projectId } = await resolveCommentIssueTarget(ws, issueRef, opts.project, config, client, style);
            const message = opts.message ?? (await ask("Comment"));
            if (!message) {
                printError("Comment text is required.");
                process.exit(1);
            }
            await client.post(`workspaces/${ws}/projects/${projectId}/${style}/${issueId}/comments/`, { comment_html: `<p>${message}</p>` });
            printInfo("Comment added.");
        }
        catch (err) {
            printError(err instanceof PlaneApiError ? err.message : String(err));
            process.exit(1);
        }
    });
    // ── delete ────────────────────────────────────────────────────────────────
    command
        .command("delete <commentId> <issue>")
        .description("Delete a comment by UUID. Issue: 42, PROJ-42, or UUID")
        .option("--workspace <slug>", "Workspace slug (overrides active context)")
        .option("--project <identifier>", "Project identifier (overrides active context)")
        .action(async (commentId, issueRef, opts) => {
        try {
            const config = loadConfig();
            const client = createClient(config);
            const ws = opts.workspace ?? requireActiveWorkspace(config);
            const style = client.issuesSegment();
            const { issueId, projectId } = await resolveCommentIssueTarget(ws, issueRef, opts.project, config, client, style);
            await client.delete(`workspaces/${ws}/projects/${projectId}/${style}/${issueId}/comments/${commentId}/`);
            printInfo("Comment deleted.");
        }
        catch (err) {
            printError(err instanceof PlaneApiError ? err.message : String(err));
            process.exit(1);
        }
    });
    return command;
}
async function resolveCommentIssueTarget(workspace, issueRef, projectRef, config, client, style) {
    let activeProjectId;
    let activeProjectIdentifier;
    if (projectRef) {
        const proj = await resolveProject(client, workspace, projectRef);
        activeProjectId = proj.id;
        activeProjectIdentifier = proj.identifier;
    }
    else if (config.context.activeProject) {
        activeProjectId = config.context.activeProject;
        activeProjectIdentifier = config.context.activeProjectIdentifier;
    }
    const { issueId, projectId } = await resolveIssueRef(client, workspace, activeProjectId, activeProjectIdentifier, style, issueRef);
    return { issueId, projectId };
}
function commentAuthor(comment) {
    if (comment.created_by_detail?.display_name)
        return comment.created_by_detail.display_name;
    if (comment.actor_detail?.display_name)
        return comment.actor_detail.display_name;
    if (comment.created_by && typeof comment.created_by === "object" && comment.created_by.display_name) {
        return comment.created_by.display_name;
    }
    if (typeof comment.created_by === "string")
        return comment.created_by;
    return "-";
}
function commentPreview(comment) {
    const raw = comment.comment_html
        ? stripHtml(comment.comment_html)
        : (comment.comment_stripped ?? "");
    const singleLine = raw.replace(/\s+/g, " ").trim();
    if (!singleLine)
        return "[empty]";
    return singleLine.length > 72 ? `${singleLine.slice(0, 69)}...` : singleLine;
}
//# sourceMappingURL=comment.js.map