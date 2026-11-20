import type { PlaneReadClient } from "./api-client.js";
import type { PlaneIssue } from "./types.js";
export interface IssueUpdateFields {
    title?: string;
    name?: string;
    description?: string;
    descriptionHtml?: string;
    priority?: string;
    state?: string;
    assignee?: string[];
    label?: string[];
    labelId?: string[];
    parent?: string;
    due?: string;
    start?: string;
}
export declare function buildIssueUpdateBaseBody(client: PlaneReadClient, workspace: string, fields: IssueUpdateFields): Promise<Record<string, unknown>>;
export declare function resolveIssueUpdateState(client: PlaneReadClient, workspace: string, projectId: string, state: string): Promise<string>;
export declare function validateIssueUpdateLabelIds(labelIds: readonly string[]): void;
export declare function resolveIssueUpdateLabels(client: PlaneReadClient, workspace: string, projectId: string, names: readonly string[], ids: readonly string[]): Promise<string[]>;
export declare function resolveIssueUpdateParent(client: PlaneReadClient, workspace: string, target: {
    projectId: string;
    identifier: string;
}, style: string, parent: string): Promise<string | null>;
export declare function assertIssueUpdateRoundTrip(issue: PlaneIssue, body: Record<string, unknown>): void;
//# sourceMappingURL=issue-update.d.ts.map