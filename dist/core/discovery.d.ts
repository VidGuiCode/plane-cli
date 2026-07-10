import type { PlaneConfig, PlaneCycle, PlaneLabel, PlaneMember, PlaneModule, PlaneProject, PlaneState } from "./types.js";
import type { PlaneApiClient } from "./api-client.js";
export interface ResolvedProjectContext {
    workspace: string;
    projectId: string;
    projectIdentifier: string;
    projectName?: string;
}
export interface IssueInputOptions {
    states: PlaneState[];
    members: PlaneMember[];
    labels: PlaneLabel[];
    cycles: PlaneCycle[];
    modules: PlaneModule[];
}
export declare function resolveProjectContext(client: PlaneApiClient, config: PlaneConfig, workspace: string, projectRef?: string): Promise<ResolvedProjectContext>;
export declare function fetchProjects(client: PlaneApiClient, workspace: string): Promise<PlaneProject[]>;
export declare function fetchMembers(client: PlaneApiClient, workspace: string): Promise<PlaneMember[]>;
/**
 * Capability flag for Plane Pages on the current instance.
 * - `supported: true`  — the token-authenticated project-pages endpoint answered.
 * - `supported: false` — it returned 404 (Pages are not on the public API here).
 * - `supported: null`  — could not be determined (probe error, or no project to probe).
 */
export interface PagesCapability {
    supported: boolean | null;
    reason: string | null;
}
/**
 * Non-fatal probe: can this instance serve project Pages over the
 * token-authenticated `/api/v1/.../pages/` endpoint? Mirrors how
 * `fetchProjectPages` treats a 404 as "unsupported", but NEVER throws — a probe
 * error is reported as unsupported/unknown so `discover` cannot be made to fail
 * by advertising a capability. See
 * context/research/lessons-learned/pages-support-root-cause.md.
 */
export declare function probePagesSupport(client: PlaneApiClient, workspace: string, projectId: string): Promise<PagesCapability>;
export declare function fetchIssueInputOptions(client: PlaneApiClient, workspace: string, projectId: string): Promise<IssueInputOptions>;
//# sourceMappingURL=discovery.d.ts.map