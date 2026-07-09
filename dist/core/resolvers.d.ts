import type { PlaneApiClient } from "./api-client.js";
import type { PlaneIssue, PlaneState, PlaneMember } from "./types.js";
export declare const UUID_RE: RegExp;
export declare function resolveProject(client: PlaneApiClient, ws: string, ref: string): Promise<{
    id: string;
    identifier: string;
    name: string;
}>;
type IssueRef = {
    type: "uuid";
    uuid: string;
} | {
    type: "slug";
    identifier: string;
    seq: number;
} | {
    type: "seq";
    seq: number;
};
export declare function parseIssueRef(ref: string): IssueRef;
export declare function resolveIssueRef(client: PlaneApiClient, ws: string, activeProjectId: string | undefined, activeProjectIdentifier: string | undefined, style: string, ref: string): Promise<{
    issueId: string;
    projectId: string;
    identifier: string;
    sequenceId?: number;
}>;
export declare function buildStateMap(states: PlaneState[]): Map<string, string>;
export declare function resolveState(issue: PlaneIssue, stateMap: Map<string, string>): string;
/** Fetch the authenticated user's ID via /users/me/. */
export declare function resolveCurrentUserId(client: PlaneApiClient): Promise<string>;
/** Extract display name — handles all known Plane API member shapes. */
export declare function getMemberDisplayName(m: PlaneMember): string;
/** Extract email — handles all known Plane API member shapes. */
export declare function getMemberEmail(m: PlaneMember): string | undefined;
/**
 * Extract the membership role — handles all known Plane API member shapes.
 * Some versions carry the true role nested (`member.role`) or annotated
 * (`member__role`) while defaulting the top-level `role`, which made every
 * member render as "Viewer". Returns undefined when no role is present so the
 * caller can render a neutral placeholder rather than a wrong default.
 */
export declare function getMemberRole(m: PlaneMember): number | undefined;
/**
 * Returns the user UUID for issue assignee filtering.
 * Nested object → member.id; string member field → that string; fallback → top-level id.
 */
export declare function getMemberId(m: PlaneMember): string;
export declare function resolveMember(client: PlaneApiClient, ws: string, nameOrEmail: string): Promise<string>;
export declare function resolveCycle(client: PlaneApiClient, ws: string, projectId: string, nameOrId: string): Promise<{
    id: string;
    name: string;
}>;
export declare function resolveModule(client: PlaneApiClient, ws: string, projectId: string, nameOrId: string): Promise<{
    id: string;
    name: string;
}>;
/**
 * Build a fully normalized issue object with both raw API fields and camelCase aliases.
 * Used by `--json` output across issue list, cycle issues, and module issues.
 */
export declare function normalizeIssue(issue: PlaneIssue, stateMap: Map<string, string>, identifier: string, projectId: string): Record<string, unknown>;
/**
 * Project a normalized issue down to a specific set of fields.
 */
export declare function projectIssueFields(normalized: Record<string, unknown>, fieldsCsv: string): Record<string, unknown>;
/**
 * Return the requested `--fields` names that are not keys of the normalized issue.
 * `projectIssueFields` silently drops these, which reads as an empty value in
 * scripts; callers use this to warn (on stderr) instead of failing silently.
 */
export declare function findUnknownFields(normalized: Record<string, unknown>, fieldsCsv: string): string[];
export declare function resolveLabel(client: PlaneApiClient, ws: string, projectId: string, nameOrColor: string): Promise<string>;
export {};
//# sourceMappingURL=resolvers.d.ts.map