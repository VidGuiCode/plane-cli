import { type PlaneApiClient } from "./api-client.js";
import { executeIssueCreate, planIssueCreate, previewIssueCreate, type CreateOptions } from "./issue-create.js";
export declare function readIssueCreateBatch(source: string): unknown[];
type Scope = Parameters<typeof planIssueCreate>[1];
type RowIdentity = {
    row: number;
    title?: string;
};
type RowResult = RowIdentity & ({
    status: "failed";
    error: string;
} | {
    status: "blocked";
} | {
    status: "validated" | "planned";
    requests: ReturnType<typeof previewIssueCreate>;
} | {
    status: "created" | "partial";
    issue: Awaited<ReturnType<typeof executeIssueCreate>>["issue"];
    membershipErrors?: string[];
    ignoredLabels?: string[];
});
export declare function createIssueBatch(client: PlaneApiClient, scope: Scope, entries: readonly unknown[], source: string, options: CreateOptions, dryRun: boolean): Promise<{
    created: number;
    failed: number;
    results: RowResult[];
}>;
export {};
//# sourceMappingURL=issue-create-batch.d.ts.map