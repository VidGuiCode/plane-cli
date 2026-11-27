import {
  findInResolverList,
  PlaneApiError,
  type PlaneApiClient,
  type PlaneReadClient,
} from "./api-client.js";
import { getErrorMessage, ValidationError } from "./errors.js";
import { readIssueDescription, type IssueDescription } from "./issue-description.js";
import { buildIssueUpdateBaseBody, validateIssueUpdateLabelIds } from "./issue-update.js";
import { findLabelId, resolveCycle, resolveIssueRef, resolveModule, UUID_RE } from "./resolvers.js";
import type { PlaneCycle, PlaneIssue, PlaneLabel, PlaneModule, PlaneState } from "./types.js";

export interface IssueCreateFields extends IssueDescription {
  title: string;
  priority?: string;
  state?: string;
  assignee?: string[];
  label?: string[];
  labelId?: string[];
  parent?: string;
  due?: string;
  start?: string;
  module?: string;
  cycle?: string;
}

export interface CreateOptions {
  createLabels?: boolean;
  ignoreMissingLabels?: boolean;
  validateOnly?: boolean;
}

type Scope = {
  workspace: string;
  projectId: string;
  projectIdentifier: string;
};

type Membership = { path: string; name: string; kind: "module" | "cycle"; id: string };
type LabelPlan = { ids: string[]; create: string[]; ignored: string[] };
type CreatePlan = {
  context: Scope;
  path: string;
  body: Record<string, unknown>;
  labels: LabelPlan;
  membership: Membership[];
};

const priorities = ["urgent", "high", "medium", "low", "none"];

export function validateCreateOptions(options: CreateOptions): void {
  if (options.createLabels && options.ignoreMissingLabels) {
    throw new ValidationError(
      "--create-labels and --ignore-missing-labels are mutually exclusive.",
    );
  }
}

function validateDate(date: string | undefined, field: string): void {
  if (date === undefined) return;
  const parsed = new Date(date);
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date ||
    date.startsWith("0000-")
  ) {
    throw new ValidationError(`${field} must be a valid date in YYYY-MM-DD format.`);
  }
}

async function planLabels(
  client: PlaneReadClient,
  { workspace, projectId }: Scope,
  fields: IssueCreateFields,
  options: CreateOptions,
  strict: boolean,
): Promise<LabelPlan> {
  const ids: string[] = [];
  const create: string[] = [];
  const ignored: string[] = [];
  const missing: string[] = [];
  const names = new Map<string, string>();
  for (const name of fields.label ?? []) {
    if (!names.has(name.toLowerCase())) names.set(name.toLowerCase(), name);
  }
  for (const name of names.values()) {
    const id = await findLabelId(client, workspace, projectId, name, strict);
    if (id) ids.push(id);
    else if (options.createLabels && !UUID_RE.test(name)) create.push(name);
    else if (options.ignoreMissingLabels && !UUID_RE.test(name)) ignored.push(name);
    else missing.push(name);
  }
  for (const id of fields.labelId ?? []) {
    const resolved = await findLabelId(client, workspace, projectId, id, strict);
    if (resolved) ids.push(resolved);
    else missing.push(id);
  }
  if (missing.length) {
    throw new ValidationError(
      `Labels not found in this project: ${missing.map((name) => JSON.stringify(name)).join(", ")}. Check with: plane label list`,
    );
  }
  return { ids: [...new Set(ids)], create, ignored };
}

export async function planIssueCreate(
  client: PlaneReadClient,
  context: Scope,
  style: string,
  fields: IssueCreateFields,
  options: CreateOptions,
  strict: boolean,
): Promise<CreatePlan> {
  const descriptionHtml = readIssueDescription(fields);
  if (!fields.title.trim()) throw new ValidationError("Title is required.");
  if (fields.priority && !priorities.includes(fields.priority)) {
    throw new ValidationError(`Priority must be one of: ${priorities.join(", ")}.`);
  }
  validateDate(fields.due || undefined, "Due date");
  validateDate(fields.start || undefined, "Start date");
  validateIssueUpdateLabelIds(fields.labelId ?? []);

  const { workspace, projectId, projectIdentifier } = context;
  const projectPath = `workspaces/${workspace}/projects/${projectId}`;
  const path = `${projectPath}/${style}/`;
  const body = await buildIssueUpdateBaseBody(client, workspace, {
    ...fields,
    description: undefined,
    descriptionFile: undefined,
    descriptionMarkdown: undefined,
    descriptionHtml: fields.description === "" ? undefined : descriptionHtml,
  });
  if (fields.state !== undefined) {
    const state = fields.state.toLowerCase();
    const match = await findInResolverList(
      client,
      `${projectPath}/states/`,
      (states: PlaneState[]) =>
        states.find(({ id, name }) => id.toLowerCase() === state || name.toLowerCase() === state),
    );
    if (!match) throw new ValidationError(`State "${fields.state}" not found in this project.`);
    body.state = match.id;
  }
  const labels = await planLabels(client, context, fields, options, strict);
  if (labels.ids.length) body.labels = labels.ids;

  if (fields.parent) {
    const parent = await resolveIssueRef(
      client,
      workspace,
      projectId,
      projectIdentifier,
      style,
      fields.parent,
    );
    if (strict && UUID_RE.test(fields.parent)) {
      await client.get(`${path}${parent.issueId}/`);
    }
    body.parent = parent.issueId;
  }

  const membership: Membership[] = [];
  for (const kind of ["module", "cycle"] as const) {
    const ref = fields[kind];
    if (!ref) continue;
    const segment = `${projectPath}/${kind}s/`;
    const resolve = kind === "module" ? resolveModule : resolveCycle;
    const resource =
      strict && UUID_RE.test(ref)
        ? await client.get<PlaneModule | PlaneCycle>(`${segment}${ref}/`)
        : await resolve(client, workspace, projectId, ref);
    membership.push({ path: `${segment}${resource.id}/${kind}-issues/`, kind, ...resource });
  }
  return { context, path, body, labels, membership };
}

function labelPath({ workspace, projectId }: Scope): string {
  return `workspaces/${workspace}/projects/${projectId}/labels/`;
}

export function previewIssueCreate(plan: CreatePlan, previewedLabels = new Map<string, string>()) {
  const labelCalls = plan.labels.create.flatMap((name) => {
    const key = name.toLowerCase();
    if (previewedLabels.has(key)) return [];
    previewedLabels.set(key, `<new-label-id:${name}>`);
    return [
      {
        dryRun: true,
        method: "POST",
        path: labelPath(plan.context),
        body: { name },
        context: plan.context,
      },
    ];
  });
  const create = {
    dryRun: true,
    method: "POST",
    path: plan.path,
    body: {
      ...plan.body,
      ...(plan.labels.create.length
        ? {
            labels: [
              ...plan.labels.ids,
              ...plan.labels.create.map((name) => previewedLabels.get(name.toLowerCase())),
            ],
          }
        : {}),
    },
    context: plan.context,
    ...(plan.labels.ignored.length ? { ignoredLabels: plan.labels.ignored } : {}),
  };
  const { workspace, projectId } = plan.context;
  const memberships = plan.membership.map(({ path, kind, id }) => ({
    dryRun: true,
    method: "POST",
    path,
    body: { issues: ["<new-issue-id>"] },
    context: { workspace, projectId, [`${kind}Id`]: id },
  }));
  return [...labelCalls, create, ...memberships];
}

export async function executeIssueCreate(
  client: PlaneApiClient,
  plan: CreatePlan,
  createdLabels = new Map<string, string>(),
) {
  const body = { ...plan.body };
  const labelIds = new Set(plan.labels.ids);
  for (const name of plan.labels.create) {
    const key = name.toLowerCase();
    let id = createdLabels.get(key);
    if (!id) {
      try {
        id = (await client.post<PlaneLabel>(labelPath(plan.context), { name })).id;
      } catch (error) {
        if (!(error instanceof PlaneApiError) || ![400, 409].includes(error.status)) throw error;
        const { workspace, projectId } = plan.context;
        id = await findLabelId(client, workspace, projectId, name);
        if (!id) throw error;
      }
      createdLabels.set(key, id);
    }
    labelIds.add(id);
  }
  if (labelIds.size) body.labels = [...labelIds];
  const issue = await client.post<PlaneIssue>(plan.path, body);
  const membershipErrors: string[] = [];
  for (const { path, name, kind } of plan.membership) {
    try {
      await client.post(path, { issues: [issue.id] });
    } catch (error) {
      membershipErrors.push(`${kind} "${name}": ${getErrorMessage(error)}`);
    }
  }
  return { issue, membershipErrors };
}
