export declare class ValidationError extends Error {
    constructor(message: string);
}
export declare class NonInteractiveError extends Error {
    constructor(message: string);
}
export declare function getExitCode(error: unknown): number;
export declare function getErrorMessage(error: unknown): string;
export declare function exitWithError(error: unknown, json?: boolean): never;
//# sourceMappingURL=errors.d.ts.map