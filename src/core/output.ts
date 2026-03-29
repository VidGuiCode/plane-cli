import { PlaneApiError, PlaneApiRateLimitError } from "./api-client.js";
import { isCompactMode } from "./runtime.js";

export function printInfo(message: string): void {
  console.log(message);
}

export function printError(message: string): void {
  console.error(`✗  ${message}`);
}

export function printErrorJson(error: unknown): void {
  const errorObj =
    error instanceof PlaneApiRateLimitError
      ? {
          status: "error",
          code: "RATE_LIMITED",
          message: error.message,
          details: {
            httpStatus: error.status,
            retryAfter: error.retryAfter,
            method: error.method,
            path: error.path,
            ...(typeof error.details === "object" && error.details !== null ? error.details : {}),
          },
        }
      : error instanceof PlaneApiError
        ? {
            status: "error",
            code: "API_ERROR",
            message: error.message,
            details: {
              httpStatus: error.status,
              method: error.method,
              path: error.path,
              ...(typeof error.details === "object" && error.details !== null ? error.details : {}),
            },
          }
        : error instanceof Error
          ? {
              status: "error",
              code: error.name,
              message: error.message,
            }
          : {
              status: "error",
              code: "UNKNOWN_ERROR",
              message: String(error),
            };
  console.error(JSON.stringify(errorObj, null, 2));
}

export function printJson(value: unknown): void {
  console.log(JSON.stringify(value, null, isCompactMode() ? undefined : 2));
}

export function printTable(rows: string[][], headers?: string[]): void {
  if (rows.length === 0 && !headers) return;
  const allRows = headers ? [headers, ...rows] : rows;
  const widths = allRows[0].map((_, i) => Math.max(...allRows.map((r) => (r[i] ?? "").length)));
  if (headers) {
    console.log(headers.map((h, i) => h.padEnd(widths[i])).join("   "));
    console.log(widths.map((w) => "─".repeat(w)).join("   "));
  }
  for (const row of rows) {
    console.log(row.map((cell, i) => (cell ?? "").padEnd(widths[i])).join("   "));
  }
}
