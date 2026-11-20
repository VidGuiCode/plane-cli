import { mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PlaneApiClient } from "../../src/core/api-client.js";
import { createClient } from "../../src/core/config-store.js";
import { resolveIssueUpdateState } from "../../src/core/issue-update.js";
import { ResolverCache } from "../../src/core/resolver-cache.js";
import { resolveLabel, resolveMember, resolveProject } from "../../src/core/resolvers.js";

const baseUrl = "https://plane.example.test";
const projectPath = "workspaces/test/projects/";
const memberPath = "workspaces/test/members/";
const statePath = `${projectPath}project-id/states/`;
const labelPath = `${projectPath}project-id/labels/`;
const otherLabelPath = `${projectPath}other-project/labels/`;

describe("resolver cache", () => {
  let directory: string;
  let responses: Map<string, unknown>;
  let requests: string[];

  function client(token = "fixture-token") {
    return new PlaneApiClient({
      baseUrl,
      token,
      apiStyle: "issues",
      resolverCache: new ResolverCache(directory, baseUrl, token),
      retries: 0,
    });
  }

  beforeEach(() => {
    directory = mkdtempSync(path.join(tmpdir(), "plane-resolver-cache-"));
    responses = new Map();
    requests = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string, init?: RequestInit) => {
        const route = new URL(input).pathname.replace("/api/v1/", "");
        const method = init?.method ?? "GET";
        requests.push(`${method} ${route}`);
        if (method === "PATCH") return Response.json({ id: "label-id" });
        if (responses.has(route)) return Response.json(responses.get(route));
        return Response.json({ detail: "Missing fixture" }, { status: 404 });
      }),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    rmSync(directory, { recursive: true, force: true });
  });

  it("shares matching lookups across clients with the same credentials, workspace and project", async () => {
    responses.set(projectPath, [{ id: "project-id", identifier: "PROJ", name: "Project" }]);
    responses.set(memberPath, [{ member: "member-id", display_name: "Member" }]);
    responses.set(statePath, [{ id: "state-id", name: "Ready" }]);
    responses.set(labelPath, [{ id: "label-id", name: "Label", color: "#222222" }]);
    responses.set(otherLabelPath, [{ id: "other-id", name: "Label", color: "#333333" }]);
    const lookup = async (api: PlaneApiClient) =>
      Promise.all([
        resolveProject(api, "test", "PROJ").then((project) => project.id),
        resolveMember(api, "test", "Member"),
        resolveIssueUpdateState(api, "test", "project-id", "Ready"),
        resolveLabel(api, "test", "project-id", "Label"),
        resolveLabel(api, "test", "other-project", "Label"),
      ]);

    const expected = ["project-id", "member-id", "state-id", "label-id", "other-id"];
    expect(await lookup(client())).toEqual(expected);
    expect(await lookup(client())).toEqual(expected);
    expect(requests).toHaveLength(5);

    await lookup(client("another-token"));
    expect(requests).toHaveLength(10);
  });

  it("refreshes once when a cached list does not contain the requested names", async () => {
    responses.set(labelPath, [{ id: "old-id", name: "Old", color: "#222222" }]);
    await resolveLabel(client(), "test", "project-id", "Old");
    responses.set(labelPath, [
      { id: "next-id", name: "Next", color: "#333333" },
      { id: "last-id", name: "Last", color: "#444444" },
    ]);

    const api = client();
    expect(
      await Promise.all([
        resolveLabel(api, "test", "project-id", "Next"),
        resolveLabel(api, "test", "project-id", "Last"),
      ]),
    ).toEqual(["next-id", "last-id"]);
    expect(requests).toHaveLength(2);
  });

  it("discards expired and unusable entries", async () => {
    const clock = vi.spyOn(Date, "now").mockReturnValue(100_000);
    responses.set(statePath, [{ id: "old-id", name: "Ready" }]);
    await resolveIssueUpdateState(client(), "test", "project-id", "Ready");

    clock.mockReturnValue(160_000);
    responses.set(statePath, [{ id: "new-id", name: "Ready" }]);
    expect(await resolveIssueUpdateState(client(), "test", "project-id", "Ready")).toBe("new-id");

    const [cacheFile] = readdirSync(directory);
    writeFileSync(
      path.join(directory, cacheFile),
      JSON.stringify({ fetchedAt: 160_000, rows: [null] }),
    );
    expect(await resolveIssueUpdateState(client(), "test", "project-id", "Ready")).toBe("new-id");
    expect(requests).toHaveLength(3);
  });

  it("invalidates the affected lookup on API errors and successful metadata writes", async () => {
    responses.set(labelPath, [{ id: "label-id", name: "Label", color: "#222222" }]);
    responses.set(otherLabelPath, [{ id: "other-id", name: "Label", color: "#333333" }]);
    const api = client();
    await resolveLabel(api, "test", "project-id", "Label");
    await resolveLabel(api, "test", "other-project", "Label");

    await expect(api.get(`${projectPath}project-id/issues/missing/`)).rejects.toMatchObject({
      status: 404,
    });
    await resolveLabel(client(), "test", "other-project", "Label");
    await resolveLabel(client(), "test", "project-id", "Label");
    expect(requests.filter((request) => request.startsWith("GET "))).toHaveLength(4);

    await api.patch(`${labelPath}label-id/`, { name: "Renamed" });
    await resolveLabel(client(), "test", "project-id", "Label");
    expect(requests.filter((request) => request === `GET ${labelPath}`)).toHaveLength(3);
  });

  it("opts out for a command and uses no disk cache for environment-only authentication", () => {
    vi.stubEnv("PLANE_BASE_URL", undefined);
    vi.stubEnv("PLANE_API_TOKEN", undefined);
    vi.stubEnv("PLANE_CONFIG", path.join(directory, "config.json"));
    const config = {
      profiles: [{ name: "fixture", baseUrl, token: "fixture-token", apiStyle: "issues" as const }],
      context: { activeProfile: "fixture" },
    };
    const args = process.argv;
    try {
      process.argv = ["node", "plane"];
      expect(createClient(config).resolverCache).toBeDefined();
      process.argv.push("--no-resolver-cache");
      expect(createClient(config).resolverCache).toBeUndefined();
      process.argv.pop();

      vi.stubEnv("PLANE_BASE_URL", baseUrl);
      vi.stubEnv("PLANE_API_TOKEN", "fixture-token");
      expect(createClient(config).resolverCache).toBeUndefined();
    } finally {
      process.argv = args;
    }
  });
});
