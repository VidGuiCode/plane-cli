export class PlaneApiError extends Error {
    status;
    constructor(status, message) {
        super(`API error ${status}: ${message}`);
        this.status = status;
    }
}
export class PlaneApiClient {
    options;
    constructor(options) {
        this.options = options;
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
    async get(path) {
        const res = await fetch(this.url(path), { headers: this.headers });
        if (!res.ok)
            throw new PlaneApiError(res.status, await res.text());
        return res.json();
    }
    async post(path, body) {
        const res = await fetch(this.url(path), {
            method: "POST",
            headers: this.headers,
            body: JSON.stringify(body),
        });
        if (!res.ok)
            throw new PlaneApiError(res.status, await res.text());
        return res.json();
    }
    async patch(path, body) {
        const res = await fetch(this.url(path), {
            method: "PATCH",
            headers: this.headers,
            body: JSON.stringify(body),
        });
        if (!res.ok)
            throw new PlaneApiError(res.status, await res.text());
        return res.json();
    }
    async delete(path) {
        const res = await fetch(this.url(path), {
            method: "DELETE",
            headers: this.headers,
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
    if (res && typeof res === "object" && "results" in res && Array.isArray(res.results)) {
        return res.results;
    }
    return [];
}
//# sourceMappingURL=api-client.js.map