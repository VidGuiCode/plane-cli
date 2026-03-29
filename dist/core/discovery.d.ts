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
export declare function fetchIssueInputOptions(client: PlaneApiClient, workspace: string, projectId: string): Promise<IssueInputOptions>;
//# sourceMappingURL=discovery.d.ts.map