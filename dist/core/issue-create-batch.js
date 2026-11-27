import { readFileSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { parse } from "yaml";
import { cacheBatchReads } from "./api-client.js";
import { describeBatchError, getErrorMessage, ValidationError } from "./errors.js";
import { executeIssueCreate, planIssueCreate, previewIssueCreate, } from "./issue-create.js";
const strings = [
    "title",
    "description",
    "descriptionHtml",
    "descriptionFile",
    "descriptionMarkdown",
    "priority",
    "state",
    "parent",
    "due",
    "start",
    "module",
    "cycle",
];
const arrays = ["assignee", "label", "labelId"];
const fields = new Set([...strings, ...arrays]);
const command = "plane issue bulk-create";
export function readIssueCreateBatch(source) {
    let input;
    try {
        input = readFileSync(source === "-" ? 0 : source, "utf8").replace(/^\uFEFF/, "");
    }
    catch (error) {
        throw new ValidationError(`Cannot read batch input: ${getErrorMessage(error)}`);
    }
    let rows;
    try {
        rows =
            extname(source).toLowerCase() === ".json"
                ? JSON.parse(input)
                : parse(input, { maxAliasCount: 25 });
    }
    catch (error) {
        throw new ValidationError(`Batch input must be valid JSON or YAML: ${getErrorMessage(error)}`);
    }
    if (!Array.isArray(rows) || !rows.length) {
        throw new ValidationError("Batch input must be a non-empty array of issue specs.");
    }
    return rows;
}
function readRow(entry, baseDir) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
        throw new ValidationError("Issue spec must be an object.");
    }
    const row = entry;
    for (const field of Object.keys(row)) {
        if (!fields.has(field))
            throw new ValidationError(`Unknown field "${field}".`);
    }
    for (const field of strings) {
        if (!Object.hasOwn(row, field))
            continue;
        const value = row[field];
        const allowEmpty = field === "description" || field === "descriptionHtml" || field === "descriptionMarkdown";
        if (typeof value !== "string" || (!allowEmpty && !value.trim())) {
            throw new ValidationError(`Field "${field}" must be ${allowEmpty ? "a" : "a non-empty"} string.`);
        }
    }
    for (const field of arrays) {
        if (!Object.hasOwn(row, field))
            continue;
        const value = row[field];
        if (!Array.isArray(value) ||
            value.some((item) => typeof item !== "string" || !item.trim())) {
            throw new ValidationError(`Field "${field}" must be an array of non-empty strings.`);
        }
    }
    if (!Object.hasOwn(row, "title"))
        throw new ValidationError('Field "title" is required.');
    const spec = { ...row };
    if (spec.descriptionFile === "-") {
        throw new ValidationError('Bulk descriptionFile must be a path. Use "description" for inline text.');
    }
    if (spec.descriptionFile)
        spec.descriptionFile = resolve(baseDir, spec.descriptionFile);
    return spec;
}
export async function createIssueBatch(client, scope, entries, source, options, dryRun) {
    const baseDir = source === "-" ? process.cwd() : dirname(resolve(source));
    const lookup = cacheBatchReads(client);
    const style = client.issuesSegment();
    const rows = [];
    for (const [index, entry] of entries.entries()) {
        const identity = { row: index + 1 };
        try {
            const fields = readRow(entry, baseDir);
            identity.title = fields.title;
            const plan = await planIssueCreate(lookup, scope, style, fields, options, true);
            rows.push({ ...identity, plan });
        }
        catch (error) {
            rows.push({ ...identity, ...describeBatchError(error, command) });
        }
    }
    const hasPreflightErrors = rows.some((row) => "error" in row);
    const previewedLabels = new Map();
    const createdLabels = new Map();
    const results = [];
    for (const { row, title, ...outcome } of rows) {
        const identity = { row, title };
        if ("error" in outcome) {
            results.push({ ...identity, status: "failed", ...outcome });
        }
        else if (hasPreflightErrors && !dryRun && !options.validateOnly) {
            results.push({ ...identity, status: "blocked" });
        }
        else if (dryRun || options.validateOnly) {
            results.push({
                ...identity,
                status: options.validateOnly ? "validated" : "planned",
                requests: previewIssueCreate(outcome.plan, previewedLabels),
            });
        }
        else {
            try {
                const { issue, membershipErrors } = await executeIssueCreate(client, outcome.plan, createdLabels);
                const ignoredLabels = outcome.plan.labels.ignored;
                results.push({
                    ...identity,
                    status: membershipErrors.length ? "partial" : "created",
                    issue,
                    ...(membershipErrors.length ? { membershipErrors } : {}),
                    ...(ignoredLabels.length ? { ignoredLabels } : {}),
                });
            }
            catch (error) {
                results.push({ ...identity, status: "failed", ...describeBatchError(error, command) });
            }
        }
    }
    return {
        created: results.filter((row) => row.status === "created" || row.status === "partial").length,
        failed: results.filter((row) => row.status === "failed" || row.status === "partial").length,
        results,
    };
}
//# sourceMappingURL=issue-create-batch.js.map