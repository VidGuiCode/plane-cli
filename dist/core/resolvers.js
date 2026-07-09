import { unwrap, fetchAll } from "./api-client.js";
import { ValidationError } from "./errors.js";
export const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// ── Project ──────────────────────────────────────────────────────────────────
export async function resolveProject(client, ws, ref) {
    const res = await client.get(`workspaces/${ws}/projects/`);
    const projects = unwrap(res);
    const match = projects.find((p) => p.identifier.toLowerCase() === ref.toLowerCase() ||
        p.name.toLowerCase() === ref.toLowerCase());
    if (!match)
        throw new Error(`Project "${ref}" not found in workspace "${ws}". Run: plane project list`);
    return { id: match.id, identifier: match.identifier, name: match.name };
}
export function parseIssueRef(ref) {
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
export async function resolveIssueRef(client, ws, activeProjectId, activeProjectIdentifier, style, ref) {
    const parsed = parseIssueRef(ref);
    if (parsed.type === "uuid") {
        if (!activeProjectId)
            throw new Error("No active project. Run: plane project use <identifier>");
        return {
            issueId: parsed.uuid,
            projectId: activeProjectId,
            identifier: activeProjectIdentifier ?? "",
        };
    }
    if (parsed.type === "slug") {
        // Resolve project by identifier prefix
        const project = await resolveProject(client, ws, parsed.identifier);
        const found = await findIssueBySeq(client, ws, project.id, style, parsed.seq, `${parsed.identifier}-${parsed.seq}`);
        return {
            issueId: found.id,
            projectId: project.id,
            identifier: project.identifier,
            sequenceId: found.sequenceId,
        };
    }
    // type === "seq" — need active project
    if (!activeProjectId) {
        throw new Error(`No active project for short ID "${ref}". Use PROJ-${ref} format or run: plane project use <identifier>`);
    }
    const found = await findIssueBySeq(client, ws, activeProjectId, style, parsed.seq, ref);
    return {
        issueId: found.id,
        projectId: activeProjectId,
        identifier: activeProjectIdentifier ?? "",
        sequenceId: found.sequenceId,
    };
}
async function findIssueBySeq(client, ws, projectId, style, seq, originalRef) {
    // Fetch all issues to find by sequence_id (Plane API doesn't support filtering by sequence)
    const issues = await fetchAll(client, `workspaces/${ws}/projects/${projectId}/${style}/`);
    const matches = issues.filter((i) => i.sequence_id === seq);
    if (matches.length === 0)
        throw new Error(`Issue ${originalRef} not found.`);
    if (matches.length === 1) {
        return { id: matches[0].id, sequenceId: matches[0].sequence_id };
    }
    // Duplicate sequence_id (real in migrated/imported projects). Resolving to the
    // first match silently mutates the wrong issue and reports success, so refuse to
    // guess and list every candidate by UUID. Fetch state names only here, on this
    // slow ambiguous path, to keep the common single-match path free of extra calls.
    const stateRes = await client.get(`workspaces/${ws}/projects/${projectId}/states/`);
    const stateMap = buildStateMap(unwrap(stateRes));
    const candidates = matches
        .map((i) => `  ${i.id} — ${resolveState(i, stateMap)} — ${i.name}`)
        .join("\n");
    throw new ValidationError(`Ambiguous issue ref "${originalRef}": ${matches.length} issues share sequence ${seq}. ` +
        `Re-run with the exact UUID of the one you mean:\n${candidates}`);
}
// ── State ─────────────────────────────────────────────────────────────────────
export function buildStateMap(states) {
    return new Map(states.map((s) => [s.id, s.name]));
}
export function resolveState(issue, stateMap) {
    const s = issue.state;
    if (s && typeof s === "object" && "name" in s)
        return s.name;
    if (issue.state_detail?.name)
        return issue.state_detail.name;
    if (typeof s === "string")
        return stateMap.get(s) ?? s;
    return "-";
}
// ── Current user ─────────────────────────────────────────────────────────────
/** Fetch the authenticated user's ID via /users/me/. */
export async function resolveCurrentUserId(client) {
    const user = await client.get("users/me/");
    return user.id;
}
// ── Members ───────────────────────────────────────────────────────────────────
/** Extract display name — handles all known Plane API member shapes. */
export function getMemberDisplayName(m) {
    // Double-underscore annotation format (older Plane)
    if (m.member__display_name)
        return m.member__display_name;
    // Nested member object format
    if (m.member && typeof m.member === "object")
        return m.member.display_name;
    // Top-level flat format (most current Plane versions, member field is a UUID string)
    if (m.display_name)
        return m.display_name;
    return "";
}
/** Extract email — handles all known Plane API member shapes. */
export function getMemberEmail(m) {
    if (m.member__email)
        return m.member__email;
    if (m.member && typeof m.member === "object")
        return m.member.email;
    return m.email;
}
/**
 * Extract the membership role — handles all known Plane API member shapes.
 * Some versions carry the true role nested (`member.role`) or annotated
 * (`member__role`) while defaulting the top-level `role`, which made every
 * member render as "Viewer". Returns undefined when no role is present so the
 * caller can render a neutral placeholder rather than a wrong default.
 */
export function getMemberRole(m) {
    if (m.member && typeof m.member === "object" && typeof m.member.role === "number") {
        return m.member.role;
    }
    if (typeof m.member__role === "number")
        return m.member__role;
    if (typeof m.role === "number")
        return m.role;
    return undefined;
}
/**
 * Returns the user UUID for issue assignee filtering.
 * Nested object → member.id; string member field → that string; fallback → top-level id.
 */
export function getMemberId(m) {
    if (m.member && typeof m.member === "object")
        return m.member.id;
    if (typeof m.member === "string")
        return m.member;
    return m.id;
}
export async function resolveMember(client, ws, nameOrEmail) {
    const res = await client.get(`workspaces/${ws}/members/`);
    const members = unwrap(res);
    const lower = nameOrEmail.toLowerCase();
    const match = members.find((m) => getMemberDisplayName(m).toLowerCase() === lower ||
        (getMemberEmail(m)?.toLowerCase() ?? "") === lower);
    if (!match)
        throw new Error(`Member "${nameOrEmail}" not found in workspace "${ws}". Check with: plane members list`);
    return getMemberId(match);
}
// ── Cycles ────────────────────────────────────────────────────────────────────
export async function resolveCycle(client, ws, projectId, nameOrId) {
    if (UUID_RE.test(nameOrId)) {
        return { id: nameOrId, name: nameOrId };
    }
    const res = await client.get(`workspaces/${ws}/projects/${projectId}/cycles/`);
    const cycles = unwrap(res);
    const lower = nameOrId.toLowerCase();
    const match = cycles.find((c) => c.name.toLowerCase() === lower);
    if (!match)
        throw new Error(`Cycle "${nameOrId}" not found in this project. Check with: plane cycle list`);
    return { id: match.id, name: match.name };
}
// ── Modules ───────────────────────────────────────────────────────────────────
export async function resolveModule(client, ws, projectId, nameOrId) {
    if (UUID_RE.test(nameOrId)) {
        return { id: nameOrId, name: nameOrId };
    }
    const res = await client.get(`workspaces/${ws}/projects/${projectId}/modules/`);
    const modules = unwrap(res);
    const lower = nameOrId.toLowerCase();
    const match = modules.find((m) => m.name.toLowerCase() === lower);
    if (!match)
        throw new Error(`Module "${nameOrId}" not found in this project. Check with: plane module list`);
    return { id: match.id, name: match.name };
}
// ── Issue normalization ──────────────────────────────────────────────────────
/**
 * Build a fully normalized issue object with both raw API fields and camelCase aliases.
 * Used by `--json` output across issue list, cycle issues, and module issues.
 */
export function normalizeIssue(issue, stateMap, identifier, projectId) {
    const stateName = resolveState(issue, stateMap);
    const labelNames = (issue.labels ?? []).map((label) => typeof label === "object" && "name" in label ? label.name : String(label));
    // Flat API shape returns label UUIDs as strings; nested shape returns objects with an `id`.
    const labelIds = (issue.labels ?? []).map((label) => typeof label === "object" && "id" in label ? String(label.id) : String(label));
    return {
        ...issue,
        project_id: projectId,
        projectId,
        identifier: `${identifier}-${issue.sequence_id}`,
        sequence: issue.sequence_id,
        title: issue.name,
        state: stateName,
        state_name: stateName,
        state_id: typeof issue.state === "string" ? issue.state : null,
        labels: labelNames,
        label_ids: labelIds,
        dueDate: issue.target_date ?? null,
        startDate: issue.start_date ?? null,
        createdAt: issue.created_at,
        updatedAt: issue.updated_at,
        description: issue.description_stripped ?? issue.description_html ?? null,
    };
}
function parseFieldsCsv(fieldsCsv) {
    return fieldsCsv
        .split(/[,\s]+/)
        .map((f) => f.trim())
        .filter(Boolean);
}
/**
 * Project a normalized issue down to a specific set of fields.
 */
export function projectIssueFields(normalized, fieldsCsv) {
    return parseFieldsCsv(fieldsCsv).reduce((acc, field) => {
        if (field in normalized)
            acc[field] = normalized[field];
        return acc;
    }, {});
}
/**
 * Return the requested `--fields` names that are not keys of the normalized issue.
 * `projectIssueFields` silently drops these, which reads as an empty value in
 * scripts; callers use this to warn (on stderr) instead of failing silently.
 */
export function findUnknownFields(normalized, fieldsCsv) {
    return parseFieldsCsv(fieldsCsv).filter((field) => !(field in normalized));
}
// ── Labels ────────────────────────────────────────────────────────────────────
export async function resolveLabel(client, ws, projectId, nameOrColor) {
    if (UUID_RE.test(nameOrColor)) {
        return nameOrColor;
    }
    const res = await client.get(`workspaces/${ws}/projects/${projectId}/labels/`);
    const labels = unwrap(res);
    const lower = nameOrColor.toLowerCase();
    const match = labels.find((l) => l.name.toLowerCase() === lower || l.color.toLowerCase() === lower);
    if (!match)
        throw new Error(`Label "${nameOrColor}" not found in this project. Check with: plane label list`);
    return match.id;
}
//# sourceMappingURL=resolvers.js.map