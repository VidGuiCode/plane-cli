import type { PlaneApiClient } from "./api-client.js";
import type { PlaneIssue, PlaneState, PlaneMember } from "./types.js";
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
}>;
export declare function buildStateMap(states: PlaneState[]): Map<string, string>;
export declare function resolveState(issue: PlaneIssue, stateMap: Map<string, string>): string;
/** Extract display name from either flat or nested Plane API member format. */
export declare function getMemberDisplayName(m: PlaneMember): string;
/** Extract email from either flat or nested Plane API member format. */
export declare function getMemberEmail(m: PlaneMember): string | undefined;
/**
 * Returns the user UUID suitable for issue assignee filtering.
 * Prefers nested member.id (new API) over top-level id (old API where id was the user UUID).
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
export declare function resolveLabel(client: PlaneApiClient, ws: string, projectId: string, nameOrColor: string): Promise<string>;
export {};
//# sourceMappingURL=resolvers.d.ts.map