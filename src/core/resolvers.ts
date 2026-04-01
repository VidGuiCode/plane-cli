import type { PlaneApiClient } from "./api-client.js";
import { unwrap, fetchAll } from "./api-client.js";
import type {
  PlaneProject,
  PlaneIssue,
  PlaneState,
  PlaneLabel,
  PlaneMember,
  PlaneCycle,
  PlaneModule,
} from "./types.js";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// ── Project ──────────────────────────────────────────────────────────────────

export async function resolveProject(
  client: PlaneApiClient,
  ws: string,
  ref: string,
): Promise<{ id: string; identifier: string; name: string }> {
  const res = await client.get<unknown>(`workspaces/${ws}/projects/`);
  const projects = unwrap<PlaneProject>(res);
  const match = projects.find(
    (p) =>
      p.identifier.toLowerCase() === ref.toLowerCase() ||
      p.name.toLowerCase() === ref.toLowerCase(),
  );
  if (!match) throw new Error(`Project "${ref}" not found in workspace "${ws}". Run: plane project list`);
  return { id: match.id, identifier: match.identifier, name: match.name };
}

// ── Issue refs ────────────────────────────────────────────────────────────────

type IssueRef =
  | { type: "uuid"; uuid: string }
  | { type: "slug"; identifier: string; seq: number }
  | { type: "seq"; seq: number };

export function parseIssueRef(ref: string): IssueRef {
  // UUID
  if (UUID_RE.test(ref)) {
    return { type: "uuid", uuid: ref };
  }
  // PROJ-42
  const slugMatch = ref.match(/^([A-Za-z][A-Za-z0-9_]*)-(\d+)$/);
  if (slugMatch) {
    return {
      type: "slug",
      identifier: slugMatch[1].toUpperCase(),
      seq: parseInt(slugMatch[2], 10),
    };
  }
  // Plain number
  const seqMatch = ref.match(/^(\d+)$/);
  if (seqMatch) {
    return { type: "seq", seq: parseInt(seqMatch[1], 10) };
  }
  throw new Error(`Cannot parse issue ref: "${ref}". Use a sequence number, PROJ-42, or UUID.`);
}

export async function resolveIssueRef(
  client: PlaneApiClient,
  ws: string,
  activeProjectId: string | undefined,
  activeProjectIdentifier: string | undefined,
  style: string,
  ref: string,
): Promise<{ issueId: string; projectId: string; identifier: string }> {
  const parsed = parseIssueRef(ref);

  if (parsed.type === "uuid") {
    if (!activeProjectId) throw new Error("No active project. Run: plane project use <identifier>");
    return {
      issueId: parsed.uuid,
      projectId: activeProjectId,
      identifier: activeProjectIdentifier ?? "",
    };
  }

  if (parsed.type === "slug") {
    // Resolve project by identifier prefix
    const project = await resolveProject(client, ws, parsed.identifier);
    const issueId = await findIssueBySeq(
      client,
      ws,
      project.id,
      style,
      parsed.seq,
      `${parsed.identifier}-${parsed.seq}`,
    );
    return { issueId, projectId: project.id, identifier: project.identifier };
  }

  // type === "seq" — need active project
  if (!activeProjectId) {
    throw new Error(
      `No active project for short ID "${ref}". Use PROJ-${ref} format or run: plane project use <identifier>`,
    );
  }
  const issueId = await findIssueBySeq(client, ws, activeProjectId, style, parsed.seq, ref);
  return { issueId, projectId: activeProjectId, identifier: activeProjectIdentifier ?? "" };
}

async function findIssueBySeq(
  client: PlaneApiClient,
  ws: string,
  projectId: string,
  style: string,
  seq: number,
  originalRef: string,
): Promise<string> {
  // Fetch all issues to find by sequence_id (Plane API doesn't support filtering by sequence)
  const issues = await fetchAll<PlaneIssue>(
    client,
    `workspaces/${ws}/projects/${projectId}/${style}/`,
  );
  const found = issues.find((i) => i.sequence_id === seq);
  if (!found) throw new Error(`Issue ${originalRef} not found.`);
  return found.id;
}

// ── State ─────────────────────────────────────────────────────────────────────

export function buildStateMap(states: PlaneState[]): Map<string, string> {
  return new Map(states.map((s) => [s.id, s.name]));
}

export function resolveState(issue: PlaneIssue, stateMap: Map<string, string>): string {
  const s = issue.state;
  if (s && typeof s === "object" && "name" in s) return s.name;
  if (issue.state_detail?.name) return issue.state_detail.name;
  if (typeof s === "string") return stateMap.get(s) ?? s;
  return "-";
}

// ── Current user ─────────────────────────────────────────────────────────────

/** Fetch the authenticated user's ID via /users/me/. */
export async function resolveCurrentUserId(client: PlaneApiClient): Promise<string> {
  const user = await client.get<{ id: string }>("users/me/");
  return user.id;
}

// ── Members ───────────────────────────────────────────────────────────────────

/** Extract display name — handles all known Plane API member shapes. */
export function getMemberDisplayName(m: PlaneMember): string {
  // Double-underscore annotation format (older Plane)
  if (m.member__display_name) return m.member__display_name;
  // Nested member object format
  if (m.member && typeof m.member === "object") return m.member.display_name;
  // Top-level flat format (most current Plane versions, member field is a UUID string)
  if (m.display_name) return m.display_name;
  return "";
}

/** Extract email — handles all known Plane API member shapes. */
export function getMemberEmail(m: PlaneMember): string | undefined {
  if (m.member__email) return m.member__email;
  if (m.member && typeof m.member === "object") return m.member.email;
  return m.email;
}

/**
 * Returns the user UUID for issue assignee filtering.
 * Nested object → member.id; string member field → that string; fallback → top-level id.
 */
export function getMemberId(m: PlaneMember): string {
  if (m.member && typeof m.member === "object") return m.member.id;
  if (typeof m.member === "string") return m.member;
  return m.id;
}

export async function resolveMember(
  client: PlaneApiClient,
  ws: string,
  nameOrEmail: string,
): Promise<string> {
  const res = await client.get<unknown>(`workspaces/${ws}/members/`);
  const members = unwrap<PlaneMember>(res);
  const lower = nameOrEmail.toLowerCase();
  const match = members.find(
    (m) =>
      getMemberDisplayName(m).toLowerCase() === lower ||
      (getMemberEmail(m)?.toLowerCase() ?? "") === lower,
  );
  if (!match) throw new Error(`Member "${nameOrEmail}" not found in workspace "${ws}". Check with: plane members list`);
  return getMemberId(match);
}

// ── Cycles ────────────────────────────────────────────────────────────────────

export async function resolveCycle(
  client: PlaneApiClient,
  ws: string,
  projectId: string,
  nameOrId: string,
): Promise<{ id: string; name: string }> {
  if (UUID_RE.test(nameOrId)) {
    return { id: nameOrId, name: nameOrId };
  }
  const res = await client.get<unknown>(`workspaces/${ws}/projects/${projectId}/cycles/`);
  const cycles = unwrap<PlaneCycle>(res);
  const lower = nameOrId.toLowerCase();
  const match = cycles.find((c) => c.name.toLowerCase() === lower);
  if (!match) throw new Error(`Cycle "${nameOrId}" not found in this project. Check with: plane cycle list`);
  return { id: match.id, name: match.name };
}

// ── Modules ───────────────────────────────────────────────────────────────────

export async function resolveModule(
  client: PlaneApiClient,
  ws: string,
  projectId: string,
  nameOrId: string,
): Promise<{ id: string; name: string }> {
  if (UUID_RE.test(nameOrId)) {
    return { id: nameOrId, name: nameOrId };
  }
  const res = await client.get<unknown>(`workspaces/${ws}/projects/${projectId}/modules/`);
  const modules = unwrap<PlaneModule>(res);
  const lower = nameOrId.toLowerCase();
  const match = modules.find((m) => m.name.toLowerCase() === lower);
  if (!match) throw new Error(`Module "${nameOrId}" not found in this project. Check with: plane module list`);
  return { id: match.id, name: match.name };
}

// ── Issue normalization ──────────────────────────────────────────────────────

/**
 * Build a fully normalized issue object with both raw API fields and camelCase aliases.
 * Used by `--json` output across issue list, cycle issues, and module issues.
 */
export function normalizeIssue(
  issue: PlaneIssue,
  stateMap: Map<string, string>,
  identifier: string,
  projectId: string,
): Record<string, unknown> {
  const stateName = resolveState(issue, stateMap);
  const labelNames = (issue.labels ?? []).map((label) =>
    typeof label === "object" && "name" in label ? label.name : String(label),
  );

  return {
    ...(issue as unknown as Record<string, unknown>),
    project_id: projectId,
    projectId,
    identifier: `${identifier}-${issue.sequence_id}`,
    sequence: issue.sequence_id,
    title: issue.name,
    state: stateName,
    state_name: stateName,
    state_id: typeof issue.state === "string" ? issue.state : null,
    labels: labelNames,
    label_ids: labelNames,
    dueDate: issue.due_date ?? null,
    startDate: issue.start_date ?? null,
    createdAt: issue.created_at,
    updatedAt: issue.updated_at,
    description: issue.description_stripped ?? issue.description_html ?? null,
  };
}

/**
 * Project a normalized issue down to a specific set of fields.
 */
export function projectIssueFields(
  normalized: Record<string, unknown>,
  fieldsCsv: string,
): Record<string, unknown> {
  const requested = fieldsCsv
    .split(/[,\s]+/)
    .map((f) => f.trim())
    .filter(Boolean);

  return requested.reduce<Record<string, unknown>>((acc, field) => {
    if (field in normalized) acc[field] = normalized[field];
    return acc;
  }, {});
}

// ── Labels ────────────────────────────────────────────────────────────────────

export async function resolveLabel(
  client: PlaneApiClient,
  ws: string,
  projectId: string,
  nameOrColor: string,
): Promise<string> {
  if (UUID_RE.test(nameOrColor)) {
    return nameOrColor;
  }
  const res = await client.get<unknown>(`workspaces/${ws}/projects/${projectId}/labels/`);
  const labels = unwrap<PlaneLabel>(res);
  const lower = nameOrColor.toLowerCase();
  const match = labels.find(
    (l) => l.name.toLowerCase() === lower || l.color.toLowerCase() === lower,
  );
  if (!match) throw new Error(`Label "${nameOrColor}" not found in this project. Check with: plane label list`);
  return match.id;
}
