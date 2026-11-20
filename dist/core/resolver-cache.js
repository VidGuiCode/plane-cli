import { createHash, randomUUID } from "node:crypto";
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import path from "node:path";
const lookupTtlMs = 60_000;
export class ResolverCache {
    directory;
    namespace;
    cached = new Map();
    refreshed = new Map();
    constructor(directory, baseUrl, token) {
        this.directory = directory;
        this.namespace = createHash("sha256")
            .update(JSON.stringify(["resolver-cache-v1", baseUrl.replace(/\/$/, ""), token]))
            .digest("hex");
    }
    async find(lookupPath, load, select) {
        const refreshed = this.refreshed.get(lookupPath);
        if (refreshed)
            return select((await refreshed));
        const cached = this.cached.get(lookupPath) ?? this.read(lookupPath);
        if (cached) {
            this.cached.set(lookupPath, cached);
            try {
                const match = select(cached);
                if (match !== undefined)
                    return match;
            }
            catch {
                // Refresh a stored list with entries the resolver cannot use.
            }
        }
        // Multiple name misses can share a single fresh list within the command.
        const pending = load().then((rows) => {
            if (this.refreshed.get(lookupPath) === pending)
                this.write(lookupPath, rows);
            return rows;
        }, (error) => {
            if (this.refreshed.get(lookupPath) === pending)
                this.refreshed.delete(lookupPath);
            throw error;
        });
        this.refreshed.set(lookupPath, pending);
        return select(await pending);
    }
    observeResponse(requestPath, method, status) {
        const notFound = status === 404;
        const successfulWrite = method !== "GET" && status >= 200 && status < 300;
        if (!notFound && !successfulWrite)
            return;
        const [root, workspace, collection, projectId, resource] = requestPath
            .split("?")[0]
            .split("/")
            .filter(Boolean);
        if (root !== "workspaces" || !workspace)
            return;
        const workspacePath = `workspaces/${workspace}/`;
        const projects = `${workspacePath}projects/`;
        if (notFound || (collection === "projects" && !resource))
            this.invalidate(projects);
        if (notFound || collection === "members")
            this.invalidate(`${workspacePath}members/`);
        if (collection !== "projects" || !projectId)
            return;
        const project = `${projects}${projectId}/`;
        if (notFound || !resource || resource === "states")
            this.invalidate(`${project}states/`);
        if (notFound || !resource || resource === "labels")
            this.invalidate(`${project}labels/`);
    }
    file(lookupPath) {
        const key = createHash("sha256")
            .update(JSON.stringify([this.namespace, lookupPath]))
            .digest("hex");
        return path.join(this.directory, `${key}.json`);
    }
    read(lookupPath) {
        try {
            const entry = JSON.parse(readFileSync(this.file(lookupPath), "utf8"));
            if (typeof entry?.fetchedAt !== "number" || !Array.isArray(entry.rows))
                return;
            const age = Date.now() - entry.fetchedAt;
            if (age >= 0 && age < lookupTtlMs)
                return entry.rows;
        }
        catch {
            // Missing, damaged, or inaccessible files behave as cache misses.
        }
    }
    write(lookupPath, rows) {
        const file = this.file(lookupPath);
        const temporary = `${file}.${randomUUID()}.tmp`;
        try {
            mkdirSync(this.directory, { recursive: true, mode: 0o700 });
            writeFileSync(temporary, JSON.stringify({ fetchedAt: Date.now(), rows }), {
                encoding: "utf8",
                mode: 0o600,
                flag: "wx",
            });
            renameSync(temporary, file);
        }
        catch {
            // Cache persistence must never fail an API operation.
            this.remove(temporary);
        }
    }
    invalidate(lookupPath) {
        this.cached.delete(lookupPath);
        this.refreshed.delete(lookupPath);
        this.remove(this.file(lookupPath));
    }
    remove(file) {
        try {
            rmSync(file, { force: true });
        }
        catch {
            // The cache directory may be read-only.
        }
    }
}
//# sourceMappingURL=resolver-cache.js.map