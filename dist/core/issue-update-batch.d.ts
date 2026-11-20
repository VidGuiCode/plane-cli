import { type PlaneApiClient } from "./api-client.js";
import { type IssueUpdateFields } from "./issue-update.js";
type BatchEntry = IssueUpdateFields & {
    issue: string;
};
type BatchScope = {
    workspace: string;
    project?: string;
    activeProjectId?: string;
    activeProjectIdentifier?: string;
};
type RowIdentity = {
    issue: string;
    issueId: string;
    projectId: string;
};
type RowFailure = Partial<RowIdentity> & {
    issue: string;
    status: "failed";
    error: string;
};
type BatchResult = RowFailure | (RowIdentity & {
    status: "updated";
}) | (RowIdentity & {
    status: "planned";
    method: "PATCH";
    path: string;
    body: Record<string, unknown>;
});
export declare function hasIssueUpdateFlags(fields: IssueUpdateFields): boolean;
export declare function readIssueUpdateBatch(source: string): BatchEntry[];
export declare function updateIssueBatch(client: PlaneApiClient, scope: BatchScope, entries: readonly BatchEntry[], dryRun: boolean): Promise<{
    updated: number;
    failed: number;
    results: BatchResult[];
}>;
export {};
//# sourceMappingURL=issue-update-batch.d.ts.map