export class PlaneApiError extends Error {
    status;
    constructor(status, message) {
        super(`API error ${status}: ${message}`);
        this.status = status;
    }
}
export class PlaneApiRateLimitError extends PlaneApiError {
    retryAfter;
    constructor(status, message, retryAfter) {
        super(status, message);
        this.retryAfter = retryAfter;
        this.name = "PlaneApiRateLimitError";
    }
}
export class PlaneApiClient {
    options;
    maxRetries;
    baseDelay;
    constructor(options) {
        this.options = options;
        this.maxRetries = options.retries ?? 3;
        this.baseDelay = options.retryDelay ?? 1000;
    }
    get baseUrl() {
        return this.options.baseUrl;
    }
    get token() {
        return this.options.token;
    }
    issuesSegment() {
        return this.options.apiStyle;
    }
    get headers() {
        return {
            "X-API-Key": this.options.token,
            "Content-Type": "application/json",
        };
    }
    url(path) {
        const base = this.options.baseUrl.replace(/\/$/, "");
        const p = path.replace(/^\//, "");
        return `${base}/api/v1/${p}`;
    }
    sleep(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    calculateDelay(attempt, retryAfter) {
        // If Retry-After header is present, use it (convert seconds to ms)
        if (retryAfter !== null && retryAfter > 0) {
            return retryAfter * 1000;
        }
        // Exponential backoff: delay * 2^attempt
        const exponentialDelay = this.baseDelay * Math.pow(2, attempt);
        // Add jitter to prevent thundering herd: delay + Math.random() * 100
        const jitter = Math.random() * 100;
        return exponentialDelay + jitter;
    }
    isRetryableError(status) {
        // Retry on 5xx errors and rate limit (429)
        // Don't retry on 4xx errors (except 429) or 2xx/3xx responses
        if (status >= 500 && status < 600)
            return true;
        if (status === 429)
            return true;
        return false;
    }
    async fetchWithRetry(path, options = {}) {
        const url = this.url(path);
        const fetchOptions = {
            headers: this.headers,
            ...options,
        };
        let lastError = null;
        for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
            try {
                const res = await fetch(url, fetchOptions);
                // Success or non-retryable error
                if (res.ok || !this.isRetryableError(res.status)) {
                    return res;
                }
                // Handle rate limit (429) specially
                if (res.status === 429) {
                    const retryAfterHeader = res.headers.get("Retry-After");
                    const retryAfter = retryAfterHeader ? parseInt(retryAfterHeader, 10) : null;
                    // If this is the last attempt, throw rate limit error
                    if (attempt === this.maxRetries) {
                        const errorText = await res.text();
                        throw new PlaneApiRateLimitError(res.status, errorText, retryAfter);
                    }
                    // Wait and retry
                    const delay = this.calculateDelay(attempt, retryAfter);
                    await this.sleep(delay);
                    continue;
                }
                // Handle 5xx errors
                if (attempt === this.maxRetries) {
                    const errorText = await res.text();
                    throw new PlaneApiError(res.status, errorText);
                }
                // Calculate delay with exponential backoff and jitter
                const delay = this.calculateDelay(attempt, null);
                await this.sleep(delay);
            }
            catch (error) {
                // Network errors (fetch throws on network failure)
                if (error instanceof TypeError || error instanceof Error) {
                    // Check if it's a network error (fetch typically throws TypeError for network issues)
                    const isNetworkError = error instanceof TypeError ||
                        error.message.includes("fetch") ||
                        error.message.includes("network");
                    if (isNetworkError && attempt < this.maxRetries) {
                        const delay = this.calculateDelay(attempt, null);
                        await this.sleep(delay);
                        lastError = error;
                        continue;
                    }
                }
                // Re-throw PlaneApiError and PlaneApiRateLimitError as-is
                if (error instanceof PlaneApiError) {
                    throw error;
                }
                // For other errors on final attempt, throw with context
                if (attempt === this.maxRetries) {
                    throw new Error(`Request failed after ${this.maxRetries} retries: ${error instanceof Error ? error.message : String(error)}`);
                }
                lastError = error instanceof Error ? error : new Error(String(error));
                // Retry with backoff
                const delay = this.calculateDelay(attempt, null);
                await this.sleep(delay);
            }
        }
        // This should not be reached, but just in case
        throw lastError || new Error(`Request failed after ${this.maxRetries} retries`);
    }
    async get(path) {
        const res = await this.fetchWithRetry(path);
        if (!res.ok)
            throw new PlaneApiError(res.status, await res.text());
        return res.json();
    }
    async post(path, body) {
        const res = await this.fetchWithRetry(path, {
            method: "POST",
            body: JSON.stringify(body),
        });
        if (!res.ok)
            throw new PlaneApiError(res.status, await res.text());
        return res.json();
    }
    async patch(path, body) {
        const res = await this.fetchWithRetry(path, {
            method: "PATCH",
            body: JSON.stringify(body),
        });
        if (!res.ok)
            throw new PlaneApiError(res.status, await res.text());
        return res.json();
    }
    async delete(path) {
        const res = await this.fetchWithRetry(path, {
            method: "DELETE",
        });
        if (!res.ok)
            throw new PlaneApiError(res.status, await res.text());
    }
}
export async function fetchAll(client, path) {
    const sep = path.includes("?") ? "&" : "?";
    let url = `${path}${sep}per_page=100`;
    const results = [];
    while (true) {
        const res = await client.get(url);
        results.push(...unwrap(res));
        const cursor = res && typeof res === "object" && "next_cursor" in res
            ? res.next_cursor
            : null;
        if (cursor) {
            url = `${path}${sep}per_page=100&cursor=${encodeURIComponent(cursor)}`;
        }
        else {
            break;
        }
    }
    return results;
}
export function unwrap(res) {
    if (Array.isArray(res))
        return res;
    if (res &&
        typeof res === "object" &&
        "results" in res &&
        Array.isArray(res.results)) {
        return res.results;
    }
    return [];
}
//# sourceMappingURL=api-client.js.map