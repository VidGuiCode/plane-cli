import { type PlaneApiClient, type PlaneReadClient } from "./api-client.js";
import { type IssueDescription } from "./issue-description.js";
import type { PlaneIssue } from "./types.js";
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
type Membership = {
    path: string;
    name: string;
    kind: "module" | "cycle";
    id: string;
};
type LabelPlan = {
    ids: string[];
    create: string[];
    ignored: string[];
};
type CreatePlan = {
    context: Scope;
    path: string;
    body: Record<string, unknown>;
    labels: LabelPlan;
    membership: Membership[];
};
export declare function validateCreateOptions(options: CreateOptions): void;
export declare function planIssueCreate(client: PlaneReadClient, context: Scope, style: string, fields: IssueCreateFields, options: CreateOptions, strict: boolean): Promise<CreatePlan>;
export declare function previewIssueCreate(plan: CreatePlan, previewedLabels?: Map<string, string>): ({
    dryRun: boolean;
    method: string;
    path: string;
    body: {
        name: string;
    };
    context: Scope;
} | {
    ignoredLabels?: string[] | undefined;
    dryRun: boolean;
    method: string;
    path: string;
    body: {
        labels?: (string | undefined)[] | undefined;
    };
    context: Scope;
} | {
    dryRun: boolean;
    method: string;
    path: string;
    body: {
        issues: string[];
    };
    context: {
        [x: string]: string;
        workspace: string;
        projectId: string;
    };
})[];
export declare function executeIssueCreate(client: PlaneApiClient, plan: CreatePlan, createdLabels?: Map<string, string>): Promise<{
    issue: PlaneIssue;
    membershipErrors: string[];
}>;
export {};
//# sourceMappingURL=issue-create.d.ts.map