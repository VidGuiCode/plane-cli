import { PlaneApiError, PlaneApiRateLimitError } from "./api-client.js";
import { printError, printErrorJson } from "./output.js";

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

export function exitWithError(error: unknown, json = false): never {
  if (json) {
    printErrorJson(error);
  } else {
    printError(getErrorMessage(error));
  }
  process.exit(getExitCode(error));
}
