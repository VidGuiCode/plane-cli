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

export function getErrorMessage(error: unknown): string {
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
