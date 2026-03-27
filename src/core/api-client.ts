export interface PlaneClientOptions {
  baseUrl: string;
  token: string;
  apiStyle: "issues" | "work-items";
}

export class PlaneApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(`API error ${status}: ${message}`);
  }
}

export class PlaneApiClient {
  constructor(private readonly options: PlaneClientOptions) {}

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

  async get<T>(path: string): Promise<T> {
    const res = await fetch(this.url(path), { headers: this.headers });
    if (!res.ok) throw new PlaneApiError(res.status, await res.text());
    return res.json() as Promise<T>;
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(this.url(path), {
      method: "POST",
      headers: this.headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new PlaneApiError(res.status, await res.text());
    return res.json() as Promise<T>;
  }

  async patch<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(this.url(path), {
      method: "PATCH",
      headers: this.headers,
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new PlaneApiError(res.status, await res.text());
    return res.json() as Promise<T>;
  }

  async delete(path: string): Promise<void> {
    const res = await fetch(this.url(path), {
      method: "DELETE",
      headers: this.headers,
    });
    if (!res.ok) throw new PlaneApiError(res.status, await res.text());
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
  if (res && typeof res === "object" && "results" in res && Array.isArray((res as { results: T[] }).results)) {
    return (res as { results: T[] }).results;
  }
  return [];
}
