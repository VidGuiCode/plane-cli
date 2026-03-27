export interface PlaneClientOptions {
    baseUrl: string;
    token: string;
    apiStyle: "issues" | "work-items";
}
export declare class PlaneApiError extends Error {
    readonly status: number;
    constructor(status: number, message: string);
}
export declare class PlaneApiClient {
    private readonly options;
    constructor(options: PlaneClientOptions);
    get baseUrl(): string;
    get token(): string;
    issuesSegment(): string;
    private get headers();
    private url;
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