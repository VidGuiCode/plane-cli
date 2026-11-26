export declare class ValidationError extends Error {
    constructor(message: string);
}
export declare class NonInteractiveError extends Error {
    constructor(message: string);
}
export declare function getExitCode(error: unknown): number;
export declare function getErrorMessage(error: unknown): string;
export interface ErrorDetails {
    code: string;
    command: string | null;
    retryable: boolean;
    suggestedFix: string | null;
}
export declare function printErrorJson(error: unknown, command?: string | null): void;
export declare function describeBatchError(error: unknown, command: string): {
    error: string;
    errorDetails: ErrorDetails;
};
export declare function exitWithError(error: unknown, json?: boolean): never;
//# sourceMappingURL=errors.d.ts.map