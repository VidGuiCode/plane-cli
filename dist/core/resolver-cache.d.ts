export declare class ResolverCache {
    private readonly directory;
    private readonly namespace;
    private readonly cached;
    private readonly refreshed;
    constructor(directory: string, baseUrl: string, token: string);
    find<T, R>(lookupPath: string, load: () => Promise<T[]>, select: (rows: T[]) => R | undefined): Promise<R | undefined>;
    observeResponse(requestPath: string, method: string, status: number): void;
    private file;
    private read;
    private write;
    private invalidate;
    private remove;
}
//# sourceMappingURL=resolver-cache.d.ts.map