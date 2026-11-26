import { PlaneApiError, PlaneApiRateLimitError } from "./api-client.js";
import { printError } from "./output.js";
import { getActiveCommand } from "./runtime.js";

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ValidationError";
  }
}

export class NonInteractiveError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "NonInteractiveError";
  }
}

export function getExitCode(error: unknown): number {
  if (error instanceof PlaneApiRateLimitError) return 4;
  if (error instanceof PlaneApiError && (error.status === 401 || error.status === 403)) return 2;
  if (error instanceof ValidationError || error instanceof NonInteractiveError) return 3;
  return 1;
}

function getStatusHint(status: number, path?: string): string | null {
  switch (status) {
    case 401:
      return "Authentication failed. Your API token may be expired or invalid. Run: plane login";
    case 403:
      return "Access denied. You may not have permission for this resource. Check your API token scope.";
    case 404: {
      if (path?.includes("members/")) return "Member not found. Check with: plane members list";
      if (path?.includes("cycle-issues/")) {
        return "Cycle issue membership endpoint was not found. The cycle may exist, but this Plane API version may use a different cycle membership endpoint.";
      }
      if (path?.includes("cycles/")) return "Cycle not found. Check with: plane cycle list";
      if (path?.includes("modules/")) return "Module not found. Check with: plane module list";
      if (path?.includes("labels/")) return "Label not found. Check with: plane label list";
      if (path?.includes("states/")) return "State not found. Check with: plane state list";
      return "Resource not found. Verify the workspace, project, and resource identifiers.";
    }
    case 429:
      return "Rate limited. Wait a moment and retry, or use --compact for smaller payloads.";
    default:
      return null;
  }
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof PlaneApiError) {
    const hint = getStatusHint(error.status, error.path);
    return hint ? `${error.message}\n  Hint: ${hint}` : error.message;
  }
  if (error instanceof Error) return error.message;
  return String(error);
}

export interface ErrorDetails {
  code: string;
  command: string | null;
  retryable: boolean;
  suggestedFix: string | null;
}

function describeError(error: unknown, command: string | null): ErrorDetails {
  if (error instanceof PlaneApiError) {
    const rateLimited = error.status === 429;
    const read = !error.method || ["GET", "HEAD"].includes(error.method);
    const transient = [408, 500, 502, 503, 504].includes(error.status);
    const retryable = rateLimited || (read && transient);
    let suggestedFix = getStatusHint(error.status, error.path);
    if (rateLimited) {
      suggestedFix = "Wait for the rate limit to reset before retrying.";
    } else if (transient) {
      suggestedFix = read
        ? "Wait briefly and retry the request."
        : "Check whether the write took effect in Plane before retrying.";
    } else if (error.status === 400 || error.status === 422) {
      suggestedFix = "Check the input against the validation response from Plane.";
    }
    return {
      code: error instanceof PlaneApiRateLimitError ? "RATE_LIMITED" : "API_ERROR",
      command,
      retryable,
      suggestedFix,
    };
  }
  let suggestedFix: string | null = null;
  if (error instanceof ValidationError) suggestedFix = "Correct the input described in the error.";
  if (error instanceof NonInteractiveError)
    suggestedFix = "Pass the required value as an option or use an interactive terminal.";
  return {
    code: error instanceof Error ? error.name : "UNKNOWN_ERROR",
    command,
    retryable: false,
    suggestedFix,
  };
}

export function printErrorJson(error: unknown, command = getActiveCommand()): void {
  const details =
    error instanceof PlaneApiError
      ? {
          httpStatus: error.status,
          ...(error instanceof PlaneApiRateLimitError ? { retryAfter: error.retryAfter } : {}),
          method: error.method,
          path: error.path,
          ...(typeof error.details === "object" && error.details !== null ? error.details : {}),
        }
      : undefined;
  console.error(
    JSON.stringify(
      {
        status: "error",
        ...describeError(error, command),
        message: error instanceof Error ? error.message : String(error),
        details,
      },
      null,
      2,
    ),
  );
}

export function describeBatchError(error: unknown, command: string) {
  return { error: getErrorMessage(error), errorDetails: describeError(error, command) };
}

export function exitWithError(error: unknown, json = false): never {
  if (json) {
    printErrorJson(error);
  } else {
    printError(getErrorMessage(error));
  }
  process.exit(getExitCode(error));
}
