export interface PlaneClientOptions {
  baseUrl: string;
  token: string;
  apiStyle: "issues" | "work-items";
  retries?: number;
  retryDelay?: number;
}

export class PlaneApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly method?: string,
    public readonly path?: string,
    public readonly details?: unknown,
  ) {
    super(`API error ${status}: ${message}`);
    this.name = "PlaneApiError";
  }
}

export class PlaneApiRateLimitError extends PlaneApiError {
  constructor(
    status: number,
    message: string,
    public readonly retryAfter: number | null,
    method?: string,
    path?: string,
    details?: unknown,
  ) {
    super(status, message, method, path, details);
    this.name = "PlaneApiRateLimitError";
  }
}

interface FetchOptions {
  method?: string;
  body?: string;
}

export class PlaneApiClient {
  private readonly maxRetries: number;
  private readonly baseDelay: number;

  constructor(private readonly options: PlaneClientOptions) {
    this.maxRetries = options.retries ?? 3;
    this.baseDelay = options.retryDelay ?? 1000;
  }

  get baseUrl(): string {
    return this.options.baseUrl;
  }

  get token(): string {
    return this.options.token;
  }

  issuesSegment(): string {
    return this.options.apiStyle;
  }

  private get headers(): Record<string, string> {
    return {
      "X-API-Key": this.options.token,
      "Content-Type": "application/json",
    };
  }

  private url(path: string): string {
    const base = this.options.baseUrl.replace(/\/$/, "");
    const p = path.replace(/^\//, "");
    return `${base}/api/v1/${p}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private calculateDelay(attempt: number, retryAfter: number | null): number {
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

  private isRetryableError(status: number): boolean {
    // Retry on 5xx errors and rate limit (429)
    // Don't retry on 4xx errors (except 429) or 2xx/3xx responses
    if (status >= 500 && status < 600) return true;
    if (status === 429) return true;
    return false;
  }

  private async fetchWithRetry(path: string, options: FetchOptions = {}): Promise<Response> {
    const url = this.url(path);
    const fetchOptions: RequestInit = {
      headers: this.headers,
      ...options,
    };

    let lastError: Error | null = null;

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
            throw new PlaneApiRateLimitError(
              res.status,
              errorText,
              retryAfter,
              options.method,
              path,
              {
                response: errorText,
              },
            );
          }

          // Wait and retry
          const delay = this.calculateDelay(attempt, retryAfter);
          await this.sleep(delay);
          continue;
        }

        // Handle 5xx errors
        if (attempt === this.maxRetries) {
          const errorText = await res.text();
          throw new PlaneApiError(res.status, errorText, options.method, path, {
            response: errorText,
          });
        }

        // Calculate delay with exponential backoff and jitter
        const delay = this.calculateDelay(attempt, null);
        await this.sleep(delay);
      } catch (error) {
        // Network errors (fetch throws on network failure)
        if (error instanceof TypeError || error instanceof Error) {
          // Check if it's a network error (fetch typically throws TypeError for network issues)
          const isNetworkError =
            error instanceof TypeError ||
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
          throw new Error(
            `Request failed after ${this.maxRetries} retries: ${error instanceof Error ? error.message : String(error)}`,
          );
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

  async get<T>(path: string): Promise<T> {
    const res = await this.fetchWithRetry(path);
    if (!res.ok) {
      const errorText = await res.text();
      throw new PlaneApiError(res.status, errorText, "GET", path, { response: errorText });
    }
    return res.json() as Promise<T>;
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const res = await this.fetchWithRetry(path, {
      method: "POST",
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errorText = await res.text();
      throw new PlaneApiError(res.status, errorText, "POST", path, {
        request: body,
        response: errorText,
      });
    }
    return res.json() as Promise<T>;
  }

  async patch<T>(path: string, body: unknown): Promise<T> {
    const res = await this.fetchWithRetry(path, {
      method: "PATCH",
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const errorText = await res.text();
      throw new PlaneApiError(res.status, errorText, "PATCH", path, {
        request: body,
        response: errorText,
      });
    }
    return res.json() as Promise<T>;
  }

  async delete(path: string): Promise<void> {
    const res = await this.fetchWithRetry(path, {
      method: "DELETE",
    });
    if (!res.ok) {
      const errorText = await res.text();
      throw new PlaneApiError(res.status, errorText, "DELETE", path, { response: errorText });
    }
  }
}

export async function fetchAll<T>(client: PlaneApiClient, path: string): Promise<T[]> {
  const sep = path.includes("?") ? "&" : "?";
  let url = `${path}${sep}per_page=100`;
  const results: T[] = [];

  while (true) {
    const res = await client.get<unknown>(url);
    results.push(...unwrap<T>(res));

    const cursor: string | null | undefined =
      res && typeof res === "object" && "next_cursor" in res
        ? (res as { next_cursor?: string | null }).next_cursor
        : null;

    if (cursor) {
      url = `${path}${sep}per_page=100&cursor=${encodeURIComponent(cursor)}`;
    } else {
      break;
    }
  }

  return results;
}

export function unwrap<T>(res: T[] | { results: T[] } | unknown): T[] {
  if (Array.isArray(res)) return res;
  if (
    res &&
    typeof res === "object" &&
    "results" in res &&
    Array.isArray((res as { results: T[] }).results)
  ) {
    return (res as { results: T[] }).results;
  }
  return [];
}
