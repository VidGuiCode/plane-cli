import { readFileSync } from "node:fs";
import { dirname, extname, resolve } from "node:path";
import { parse } from "yaml";
import { cacheBatchReads, type PlaneApiClient } from "./api-client.js";
import { getErrorMessage, ValidationError } from "./errors.js";
import {
  executeIssueCreate,
  planIssueCreate,
  previewIssueCreate,
  type CreateOptions,
  type IssueCreateFields,
} from "./issue-create.js";

const strings = [
  "title",
  "description",
  "descriptionHtml",
  "descriptionFile",
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

export function readIssueCreateBatch(source: string): unknown[] {
  let input: string;
  try {
    input = readFileSync(source === "-" ? 0 : source, "utf8").replace(/^\uFEFF/, "");
  } catch (error) {
    throw new ValidationError(`Cannot read batch input: ${getErrorMessage(error)}`);
  }
  let rows: unknown;
  try {
    rows =
      extname(source).toLowerCase() === ".json"
        ? JSON.parse(input)
        : parse(input, { maxAliasCount: 25 });
  } catch (error) {
    throw new ValidationError(`Batch input must be valid JSON or YAML: ${getErrorMessage(error)}`);
  }
  if (!Array.isArray(rows) || !rows.length) {
    throw new ValidationError("Batch input must be a non-empty array of issue specs.");
  }
  return rows;
}

function readRow(entry: unknown, baseDir: string): IssueCreateFields {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
    throw new ValidationError("Issue spec must be an object.");
  }
  const row = entry as Record<string, unknown>;
  for (const field of Object.keys(row)) {
    if (!fields.has(field)) throw new ValidationError(`Unknown field "${field}".`);
  }
  for (const field of strings) {
    if (!Object.hasOwn(row, field)) continue;
    const value = row[field];
    const allowEmpty = field === "description" || field === "descriptionHtml";
    if (typeof value !== "string" || (!allowEmpty && !value.trim())) {
      throw new ValidationError(
        `Field "${field}" must be ${allowEmpty ? "a" : "a non-empty"} string.`,
      );
    }
  }
  for (const field of arrays) {
    if (!Object.hasOwn(row, field)) continue;
    const value = row[field];
    if (
      !Array.isArray(value) ||
      value.some((item: unknown) => typeof item !== "string" || !item.trim())
    ) {
      throw new ValidationError(`Field "${field}" must be an array of non-empty strings.`);
    }
  }
  if (!Object.hasOwn(row, "title")) throw new ValidationError('Field "title" is required.');
  const spec = { ...row } as unknown as IssueCreateFields;
  if (spec.descriptionFile === "-") {
    throw new ValidationError(
      'Bulk descriptionFile must be a path. Use "description" for inline text.',
    );
  }
  if (spec.descriptionFile) spec.descriptionFile = resolve(baseDir, spec.descriptionFile);
  return spec;
}

type Scope = Parameters<typeof planIssueCreate>[1];
type Plan = Awaited<ReturnType<typeof planIssueCreate>>;
type RowIdentity = { row: number; title?: string };
type RowResult = RowIdentity &
  (
    | { status: "failed"; error: string }
    | { status: "blocked" }
    | { status: "validated" | "planned"; requests: ReturnType<typeof previewIssueCreate> }
    | {
        status: "created" | "partial";
        issue: Awaited<ReturnType<typeof executeIssueCreate>>["issue"];
        membershipErrors?: string[];
        ignoredLabels?: string[];
      }
  );

export async function createIssueBatch(
  client: PlaneApiClient,
  scope: Scope,
  entries: readonly unknown[],
  source: string,
  options: CreateOptions,
  dryRun: boolean,
) {
  const baseDir = source === "-" ? process.cwd() : dirname(resolve(source));
  const lookup = cacheBatchReads(client);
  const style = client.issuesSegment();
  const rows: (RowIdentity & ({ plan: Plan } | { error: string }))[] = [];
  for (const [index, entry] of entries.entries()) {
    const identity: RowIdentity = { row: index + 1 };
    try {
      const fields = readRow(entry, baseDir);
      identity.title = fields.title;
      const plan = await planIssueCreate(lookup, scope, style, fields, options, true);
      rows.push({ ...identity, plan });
    } catch (error) {
      rows.push({ ...identity, error: getErrorMessage(error) });
    }
  }

  const hasPreflightErrors = rows.some((row) => "error" in row);
  const previewedLabels = new Map<string, string>();
  const createdLabels = new Map<string, string>();
  const results: RowResult[] = [];
  for (const { row, title, ...outcome } of rows) {
    const identity = { row, title };
    if ("error" in outcome) {
      results.push({ ...identity, status: "failed", error: outcome.error });
    } else if (hasPreflightErrors && !dryRun && !options.validateOnly) {
      results.push({ ...identity, status: "blocked" });
    } else if (dryRun || options.validateOnly) {
      results.push({
        ...identity,
        status: options.validateOnly ? "validated" : "planned",
        requests: previewIssueCreate(outcome.plan, previewedLabels),
      });
    } else {
      try {
        const { issue, membershipErrors } = await executeIssueCreate(
          client,
          outcome.plan,
          createdLabels,
        );
        const ignoredLabels = outcome.plan.labels.ignored;
        results.push({
          ...identity,
          status: membershipErrors.length ? "partial" : "created",
          issue,
          ...(membershipErrors.length ? { membershipErrors } : {}),
          ...(ignoredLabels.length ? { ignoredLabels } : {}),
        });
      } catch (error) {
        results.push({ ...identity, status: "failed", error: getErrorMessage(error) });
      }
    }
  }
  return {
    created: results.filter((row) => row.status === "created" || row.status === "partial").length,
    failed: results.filter((row) => row.status === "failed" || row.status === "partial").length,
    results,
  };
}
