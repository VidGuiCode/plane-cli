import type { PlaneReadClient } from "./api-client.js";
import { findInResolverList } from "./api-client.js";
import { ValidationError } from "./errors.js";
import { stripHtml } from "./html.js";
import { readIssueDescription, type IssueDescription } from "./issue-description.js";
import {
  resolveCurrentUserId,
  resolveIssueRef,
  resolveLabel,
  resolveMember,
  UUID_RE,
} from "./resolvers.js";
import type { PlaneIssue, PlaneState } from "./types.js";

export interface IssueUpdateFields extends IssueDescription {
  title?: string;
  name?: string;
  priority?: string;
  state?: string;
  assignee?: string[];
  label?: string[];
  labelId?: string[];
  parent?: string;
  due?: string;
  start?: string;
}

export async function buildIssueUpdateBaseBody(
  client: PlaneReadClient,
  workspace: string,
  fields: IssueUpdateFields,
): Promise<Record<string, unknown>> {
  const body: Record<string, unknown> = {};
  const title = fields.title ?? fields.name;
  if (title) body.name = title;
  const description = readIssueDescription(fields);
  if (description !== undefined) body.description_html = description;
  if (fields.priority) body.priority = fields.priority;
  if (fields.due) body.target_date = fields.due === "none" ? null : fields.due;
  if (fields.start) body.start_date = fields.start === "none" ? null : fields.start;
  if (fields.assignee?.length) {
    body.assignees = await Promise.all(
      fields.assignee.map((assignee) =>
        assignee.toLowerCase() === "me"
          ? resolveCurrentUserId(client)
          : resolveMember(client, workspace, assignee),
      ),
    );
  }
  return body;
}

export async function resolveIssueUpdateState(
  client: PlaneReadClient,
  workspace: string,
  projectId: string,
  state: string,
): Promise<string> {
  const lower = state.toLowerCase();
  const match = await findInResolverList(
    client,
    `workspaces/${workspace}/projects/${projectId}/states/`,
    (states: PlaneState[]) =>
      states.find((candidate) => candidate.id === state || candidate.name.toLowerCase() === lower),
  );
  return match?.id ?? state;
}

export function validateIssueUpdateLabelIds(labelIds: readonly string[]): void {
  for (const labelId of labelIds) {
    if (!UUID_RE.test(labelId)) {
      throw new ValidationError(
        `--label-id requires a UUID; got "${labelId}". Use --label for name resolution.`,
      );
    }
  }
}

export async function resolveIssueUpdateLabels(
  client: PlaneReadClient,
  workspace: string,
  projectId: string,
  names: readonly string[],
  ids: readonly string[],
): Promise<string[]> {
  const resolvedNames = await Promise.all(
    names.map((name) => resolveLabel(client, workspace, projectId, name)),
  );
  return [...new Set([...resolvedNames, ...ids])];
}

export async function resolveIssueUpdateParent(
  client: PlaneReadClient,
  workspace: string,
  target: { projectId: string; identifier: string },
  style: string,
  parent: string,
): Promise<string | null> {
  if (parent === "none") return null;
  const { issueId } = await resolveIssueRef(
    client,
    workspace,
    target.projectId,
    target.identifier,
    style,
    parent,
  );
  return issueId;
}

type IssueUpdateMismatch = {
  field: string;
  expected: unknown;
  actual: unknown;
};

function stateIdFromIssue(issue: PlaneIssue): string | null {
  if (typeof issue.state === "string") return issue.state;
  if (issue.state && typeof issue.state === "object" && "id" in issue.state) {
    return String(issue.state.id);
  }
  if (issue.state_detail && typeof issue.state_detail === "object" && "id" in issue.state_detail) {
    return String((issue.state_detail as PlaneState & { id?: string }).id);
  }
  return null;
}

function labelIdsFromIssue(issue: PlaneIssue): string[] {
  if (Array.isArray(issue.label_ids)) return issue.label_ids.map(String);
  return (issue.labels ?? [])
    .map((label) => {
      if (typeof label === "string") return label;
      if (label && typeof label === "object" && "id" in label) return String(label.id);
      return null;
    })
    .filter((label): label is string => Boolean(label));
}

function descriptionMatches(issue: PlaneIssue, expectedHtml: string): boolean {
  const expectedText = stripHtml(expectedHtml);
  const candidates = [
    issue.description_html,
    issue.description_stripped,
    (issue as PlaneIssue & { description?: string }).description,
  ].filter((value): value is string => typeof value === "string");
  // Empty updates must actually clear the content; every string includes "".
  return candidates.some((candidate) =>
    expectedText === "" ? stripHtml(candidate) === "" : stripHtml(candidate).includes(expectedText),
  );
}

function arrayContainsAll(actual: unknown, expected: unknown): boolean {
  if (!Array.isArray(actual) || !Array.isArray(expected)) return false;
  const actualSet = new Set(actual.map(String));
  return expected.map(String).every((value) => actualSet.has(value));
}

export function assertIssueUpdateRoundTrip(issue: PlaneIssue, body: Record<string, unknown>): void {
  const mismatches: IssueUpdateMismatch[] = [];

  for (const [field, expected] of Object.entries(body)) {
    if (field === "name" && issue.name !== expected) {
      mismatches.push({ field, expected, actual: issue.name });
    } else if (
      field === "description_html" &&
      typeof expected === "string" &&
      !descriptionMatches(issue, expected)
    ) {
      mismatches.push({
        field,
        expected: stripHtml(expected),
        actual: issue.description_stripped ?? issue.description_html ?? null,
      });
    } else if (field === "priority" && issue.priority !== expected) {
      mismatches.push({ field, expected, actual: issue.priority });
    } else if (field === "state" && stateIdFromIssue(issue) !== expected) {
      mismatches.push({ field, expected, actual: stateIdFromIssue(issue) });
    } else if (field === "assignees" && !arrayContainsAll(issue.assignees, expected)) {
      mismatches.push({ field, expected, actual: issue.assignees ?? [] });
    } else if (field === "labels" && !arrayContainsAll(labelIdsFromIssue(issue), expected)) {
      mismatches.push({ field, expected, actual: labelIdsFromIssue(issue) });
    } else if (field === "parent" && issue.parent !== expected) {
      mismatches.push({ field, expected, actual: issue.parent ?? null });
    } else if (field === "target_date" && issue.target_date !== expected) {
      mismatches.push({ field, expected, actual: issue.target_date ?? null });
    } else if (field === "start_date" && issue.start_date !== expected) {
      mismatches.push({ field, expected, actual: issue.start_date ?? null });
    }
  }

  if (mismatches.length > 0) {
    const summary = mismatches
      .map(
        (mismatch) =>
          `${mismatch.field}: expected ${JSON.stringify(mismatch.expected)}, got ${JSON.stringify(
            mismatch.actual,
          )}`,
      )
      .join("; ");
    throw new ValidationError(
      `Plane API did not confirm requested issue update fields (${summary}). The update may have been silently ignored by this API version.`,
    );
  }
}
