export interface PlaneClientOptions {
    baseUrl: string;
    token: string;
    apiStyle: "issues" | "work-items";
    retries?: number;
    retryDelay?: number;
}
export declare class PlaneApiError extends Error {
    readonly status: number;
    readonly method?: string | undefined;
    readonly path?: string | undefined;
    readonly details?: unknown | undefined;
    constructor(status: number, message: string, method?: string | undefined, path?: string | undefined, details?: unknown | undefined);
}
export declare class PlaneApiRateLimitError extends PlaneApiError {
    readonly retryAfter: number | null;
    constructor(status: number, message: string, retryAfter: number | null, method?: string, path?: string, details?: unknown);
}
export declare class PlaneApiClient {
    private readonly options;
    private readonly maxRetries;
    private readonly baseDelay;
    constructor(options: PlaneClientOptions);
    get baseUrl(): string;
    get token(): string;
    issuesSegment(): string;
    private get headers();
    private url;
    private sleep;
    private calculateDelay;
    private isRetryableError;
    private fetchWithRetry;
    get<T>(path: string): Promise<T>;
    post<T>(path: string, body: unknown): Promise<T>;
    patch<T>(path: string, body: unknown): Promise<T>;
    delete(path: string): Promise<void>;
}
export declare function fetchAll<T>(client: PlaneApiClient, path: string): Promise<T[]>;
export declare function unwrap<T>(res: T[] | {
    results: T[];
} | unknown): T[];
//# sourceMappingURL=api-client.d.ts.map