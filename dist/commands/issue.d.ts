import { Command } from "commander";
export { assertIssueUpdateRoundTrip } from "../core/issue-update.js";
export declare function createIssueCommand(): Command;
/**
 * Resolve the `--columns` value to a validated list of column keys, defaulting
 * to id/title/state/priority/due (which adds the DUE tracking column). Throws a
 * ValidationError naming any unknown columns.
 */
export declare function resolveIssueColumns(columnsCsv: string | undefined): string[];
//# sourceMappingURL=issue.d.ts.map