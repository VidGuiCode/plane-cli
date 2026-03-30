import { unwrap, fetchAll } from "./api-client.js";
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
// ── Project ──────────────────────────────────────────────────────────────────
export async function resolveProject(client, ws, ref) {
    const res = await client.get(`workspaces/${ws}/projects/`);
    const projects = unwrap(res);
    const match = projects.find((p) => p.identifier.toLowerCase() === ref.toLowerCase() ||
        p.name.toLowerCase() === ref.toLowerCase());
    if (!match)
        throw new Error(`Project "${ref}" not found. Run: plane project list`);
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
        const issueId = await findIssueBySeq(client, ws, project.id, style, parsed.seq, `${parsed.identifier}-${parsed.seq}`);
        return { issueId, projectId: project.id, identifier: project.identifier };
    }
    // type === "seq" — need active project
    if (!activeProjectId) {
        throw new Error(`No active project for short ID "${ref}". Use PROJ-${ref} format or run: plane project use <identifier>`);
    }
    const issueId = await findIssueBySeq(client, ws, activeProjectId, style, parsed.seq, ref);
    return { issueId, projectId: activeProjectId, identifier: activeProjectIdentifier ?? "" };
}
async function findIssueBySeq(client, ws, projectId, style, seq, originalRef) {
    // Fetch all issues to find by sequence_id (Plane API doesn't support filtering by sequence)
    const issues = await fetchAll(client, `workspaces/${ws}/projects/${projectId}/${style}/`);
    const found = issues.find((i) => i.sequence_id === seq);
    if (!found)
        throw new Error(`Issue ${originalRef} not found.`);
    return found.id;
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
// ── Members ───────────────────────────────────────────────────────────────────
/** Extract display name from either flat or nested Plane API member format. */
export function getMemberDisplayName(m) {
    return m.member__display_name ?? m.member?.display_name ?? "";
}
/** Extract email from either flat or nested Plane API member format. */
export function getMemberEmail(m) {
    return m.member__email ?? m.member?.email;
}
/**
 * Returns the user UUID suitable for issue assignee filtering.
 * Prefers nested member.id (new API) over top-level id (old API where id was the user UUID).
 */
export function getMemberId(m) {
    return m.member?.id ?? m.id;
}
export async function resolveMember(client, ws, nameOrEmail) {
    const res = await client.get(`workspaces/${ws}/members/`);
    const members = unwrap(res);
    const lower = nameOrEmail.toLowerCase();
    const match = members.find((m) => getMemberDisplayName(m).toLowerCase() === lower ||
        (getMemberEmail(m)?.toLowerCase() ?? "") === lower);
    if (!match)
        throw new Error(`Member "${nameOrEmail}" not found. Run: plane members list`);
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
        throw new Error(`Cycle "${nameOrId}" not found. Run: plane cycle list`);
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
        throw new Error(`Module "${nameOrId}" not found. Run: plane module list`);
    return { id: match.id, name: match.name };
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
        throw new Error(`Label "${nameOrColor}" not found. Run: plane label list`);
    return match.id;
}
//# sourceMappingURL=resolvers.js.map