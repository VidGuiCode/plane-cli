import { unwrap } from "./api-client.js";
import { ValidationError } from "./errors.js";
import { stripHtml } from "./html.js";
import { resolveCurrentUserId, resolveIssueRef, resolveLabel, resolveMember, UUID_RE, } from "./resolvers.js";
export async function buildIssueUpdateBaseBody(client, workspace, fields) {
    const body = {};
    const title = fields.title ?? fields.name;
    if (title)
        body.name = title;
    if (fields.descriptionHtml !== undefined)
        body.description_html = fields.descriptionHtml;
    else if (fields.description !== undefined)
        body.description_html = `<p>${fields.description}</p>`;
    if (fields.priority)
        body.priority = fields.priority;
    if (fields.due)
        body.target_date = fields.due === "none" ? null : fields.due;
    if (fields.start)
        body.start_date = fields.start === "none" ? null : fields.start;
    if (fields.assignee?.length) {
        body.assignees = await Promise.all(fields.assignee.map((assignee) => assignee.toLowerCase() === "me"
            ? resolveCurrentUserId(client)
            : resolveMember(client, workspace, assignee)));
    }
    return body;
}
export async function resolveIssueUpdateState(client, workspace, projectId, state) {
    const response = await client.get(`workspaces/${workspace}/projects/${projectId}/states/`);
    const states = unwrap(response);
    const match = states.find((candidate) => candidate.id === state || candidate.name.toLowerCase() === state.toLowerCase());
    return match?.id ?? state;
}
export function validateIssueUpdateLabelIds(labelIds) {
    for (const labelId of labelIds) {
        if (!UUID_RE.test(labelId)) {
            throw new ValidationError(`--label-id requires a UUID; got "${labelId}". Use --label for name resolution.`);
        }
    }
}
export async function resolveIssueUpdateLabels(client, workspace, projectId, names, ids) {
    const resolvedNames = await Promise.all(names.map((name) => resolveLabel(client, workspace, projectId, name)));
    return [...new Set([...resolvedNames, ...ids])];
}
export async function resolveIssueUpdateParent(client, workspace, target, style, parent) {
    if (parent === "none")
        return null;
    const { issueId } = await resolveIssueRef(client, workspace, target.projectId, target.identifier, style, parent);
    return issueId;
}
function stateIdFromIssue(issue) {
    if (typeof issue.state === "string")
        return issue.state;
    if (issue.state && typeof issue.state === "object" && "id" in issue.state) {
        return String(issue.state.id);
    }
    if (issue.state_detail && typeof issue.state_detail === "object" && "id" in issue.state_detail) {
        return String(issue.state_detail.id);
    }
    return null;
}
function labelIdsFromIssue(issue) {
    if (Array.isArray(issue.label_ids))
        return issue.label_ids.map(String);
    return (issue.labels ?? [])
        .map((label) => {
        if (typeof label === "string")
            return label;
        if (label && typeof label === "object" && "id" in label)
            return String(label.id);
        return null;
    })
        .filter((label) => Boolean(label));
}
function descriptionMatches(issue, expectedHtml) {
    const expectedText = stripHtml(expectedHtml);
    const candidates = [
        issue.description_html,
        issue.description_stripped,
        issue.description,
    ].filter((value) => typeof value === "string");
    // Empty updates must actually clear the content; every string includes "".
    return candidates.some((candidate) => expectedText === "" ? stripHtml(candidate) === "" : stripHtml(candidate).includes(expectedText));
}
function arrayContainsAll(actual, expected) {
    if (!Array.isArray(actual) || !Array.isArray(expected))
        return false;
    const actualSet = new Set(actual.map(String));
    return expected.map(String).every((value) => actualSet.has(value));
}
export function assertIssueUpdateRoundTrip(issue, body) {
    const mismatches = [];
    for (const [field, expected] of Object.entries(body)) {
        if (field === "name" && issue.name !== expected) {
            mismatches.push({ field, expected, actual: issue.name });
        }
        else if (field === "description_html" &&
            typeof expected === "string" &&
            !descriptionMatches(issue, expected)) {
            mismatches.push({
                field,
                expected: stripHtml(expected),
                actual: issue.description_stripped ?? issue.description_html ?? null,
            });
        }
        else if (field === "priority" && issue.priority !== expected) {
            mismatches.push({ field, expected, actual: issue.priority });
        }
        else if (field === "state" && stateIdFromIssue(issue) !== expected) {
            mismatches.push({ field, expected, actual: stateIdFromIssue(issue) });
        }
        else if (field === "assignees" && !arrayContainsAll(issue.assignees, expected)) {
            mismatches.push({ field, expected, actual: issue.assignees ?? [] });
        }
        else if (field === "labels" && !arrayContainsAll(labelIdsFromIssue(issue), expected)) {
            mismatches.push({ field, expected, actual: labelIdsFromIssue(issue) });
        }
        else if (field === "parent" && issue.parent !== expected) {
            mismatches.push({ field, expected, actual: issue.parent ?? null });
        }
        else if (field === "target_date" && issue.target_date !== expected) {
            mismatches.push({ field, expected, actual: issue.target_date ?? null });
        }
        else if (field === "start_date" && issue.start_date !== expected) {
            mismatches.push({ field, expected, actual: issue.start_date ?? null });
        }
    }
    if (mismatches.length > 0) {
        const summary = mismatches
            .map((mismatch) => `${mismatch.field}: expected ${JSON.stringify(mismatch.expected)}, got ${JSON.stringify(mismatch.actual)}`)
            .join("; ");
        throw new ValidationError(`Plane API did not confirm requested issue update fields (${summary}). The update may have been silently ignored by this API version.`);
    }
}
//# sourceMappingURL=issue-update.js.map