import { readFileSync } from "node:fs";
import { cacheBatchReads } from "./api-client.js";
import { describeBatchError, getErrorMessage, ValidationError } from "./errors.js";
import { assertIssueUpdateRoundTrip, buildIssueUpdateBaseBody, resolveIssueUpdateLabels, resolveIssueUpdateParent, resolveIssueUpdateState, validateIssueUpdateLabelIds, } from "./issue-update.js";
import { resolveIssueRef, resolveProject } from "./resolvers.js";
const stringFields = [
    "title",
    "name",
    "description",
    "descriptionHtml",
    "priority",
    "state",
    "parent",
    "due",
    "start",
];
const arrayFields = ["assignee", "label", "labelId"];
const updateFields = [...stringFields, ...arrayFields];
const allowedFields = new Set(["issue", ...updateFields]);
const maxConcurrentRows = 4;
const command = "plane issue update";
export function hasIssueUpdateFlags(fields) {
    return (fields.descriptionFile !== undefined ||
        stringFields.some((field) => fields[field] !== undefined) ||
        arrayFields.some((field) => Boolean(fields[field]?.length)));
}
export function readIssueUpdateBatch(source) {
    let input;
    try {
        input = readFileSync(source === "-" ? 0 : source, "utf8");
    }
    catch (error) {
        const label = source === "-" ? "stdin" : JSON.stringify(source);
        throw new ValidationError(`Cannot read batch input from ${label}: ${getErrorMessage(error)}`);
    }
    let entries;
    try {
        entries = JSON.parse(input.replace(/^\uFEFF/, ""));
    }
    catch {
        throw new ValidationError("Batch input must be valid JSON.");
    }
    if (!Array.isArray(entries) || entries.length === 0) {
        throw new ValidationError("Batch input must be a non-empty JSON array.");
    }
    return entries.map((entry, index) => {
        const label = `Batch entry ${index + 1}`;
        if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
            throw new ValidationError(`${label} must be an object.`);
        }
        const row = entry;
        for (const field of Object.keys(row)) {
            if (!allowedFields.has(field)) {
                throw new ValidationError(`${label} has an unknown field: ${JSON.stringify(field)}.`);
            }
        }
        if (typeof row.issue !== "string" || !row.issue.trim()) {
            throw new ValidationError(`${label} requires a non-empty "issue" string.`);
        }
        if (!updateFields.some((field) => field in row)) {
            throw new ValidationError(`${label} requires at least one update field.`);
        }
        for (const field of stringFields) {
            if (field in row && typeof row[field] !== "string") {
                throw new ValidationError(`${label} field "${field}" must be a string.`);
            }
        }
        for (const field of arrayFields) {
            if (!(field in row))
                continue;
            const values = row[field];
            if (!Array.isArray(values) ||
                !values.length ||
                values.some((value) => typeof value !== "string" || !value.trim())) {
                throw new ValidationError(`${label} field "${field}" must be a non-empty array of non-empty strings.`);
            }
        }
        return { ...row, issue: row.issue.trim() };
    });
}
async function mapBatchRows(rows, apply) {
    const results = [];
    for (let offset = 0; offset < rows.length; offset += maxConcurrentRows) {
        results.push(...(await Promise.all(rows.slice(offset, offset + maxConcurrentRows).map(apply))));
    }
    return results;
}
function targetKey(target) {
    return `${target.projectId.toLowerCase()}/${target.issueId.toLowerCase()}`;
}
export async function updateIssueBatch(client, scope, entries, dryRun) {
    const lookup = cacheBatchReads(client);
    const { workspace } = scope;
    const style = client.issuesSegment();
    const activeProject = scope.project
        ? await resolveProject(lookup, workspace, scope.project)
        : null;
    const resolved = await mapBatchRows(entries, async (entry) => {
        try {
            const target = await resolveIssueRef(lookup, workspace, activeProject?.id ?? scope.activeProjectId, activeProject?.identifier ?? scope.activeProjectIdentifier, style, entry.issue);
            return { entry, target };
        }
        catch (error) {
            return { entry, failure: describeBatchError(error, command) };
        }
    });
    const seenTargets = new Set();
    const duplicateTargets = new Set();
    for (const { target } of resolved) {
        if (!target)
            continue;
        const key = targetKey(target);
        if (seenTargets.has(key))
            duplicateTargets.add(key);
        seenTargets.add(key);
    }
    const results = await mapBatchRows(resolved, async (row) => {
        const { entry, target } = row;
        if (!target)
            return { issue: entry.issue, status: "failed", ...row.failure };
        const { issueId, projectId } = target;
        const identity = { issue: entry.issue, issueId, projectId };
        if (duplicateTargets.has(targetKey(target))) {
            return {
                ...identity,
                status: "failed",
                ...describeBatchError(new ValidationError("Multiple batch entries target this issue."), command),
            };
        }
        try {
            if (entry.description !== undefined && entry.descriptionHtml !== undefined) {
                throw new ValidationError("description and descriptionHtml are mutually exclusive.");
            }
            const labelIds = entry.labelId ?? [];
            validateIssueUpdateLabelIds(labelIds);
            const body = await buildIssueUpdateBaseBody(lookup, workspace, entry);
            if (entry.state) {
                body.state = await resolveIssueUpdateState(lookup, workspace, projectId, entry.state);
            }
            if (entry.label || labelIds.length) {
                body.labels = await resolveIssueUpdateLabels(lookup, workspace, projectId, entry.label ?? [], labelIds);
            }
            if (entry.parent) {
                body.parent = await resolveIssueUpdateParent(lookup, workspace, target, style, entry.parent);
            }
            if (!Object.keys(body).length)
                throw new ValidationError("Nothing to update.");
            const path = `workspaces/${workspace}/projects/${projectId}/${style}/${issueId}/`;
            if (dryRun)
                return { ...identity, status: "planned", method: "PATCH", path, body };
            const updated = await client.patch(path, body);
            assertIssueUpdateRoundTrip(updated, body);
            return { ...identity, status: "updated" };
        }
        catch (error) {
            return { ...identity, status: "failed", ...describeBatchError(error, command) };
        }
    });
    return {
        updated: results.filter((result) => result.status === "updated").length,
        failed: results.filter((result) => result.status === "failed").length,
        results,
    };
}
//# sourceMappingURL=issue-update-batch.js.map