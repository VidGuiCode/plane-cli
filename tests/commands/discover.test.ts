import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createDiscoverCommand } from "../../src/commands/discover.js";

const originalArgv = [...process.argv];
const originalConfig = process.env.PLANE_CONFIG;
const originalFetch = globalThis.fetch;

afterEach(() => {
  process.argv = originalArgv;
  if (originalConfig === undefined) {
    delete process.env.PLANE_CONFIG;
  } else {
    process.env.PLANE_CONFIG = originalConfig;
  }
  vi.restoreAllMocks();
  globalThis.fetch = originalFetch;
});

function writeConfig(): void {
  const dir = mkdtempSync(path.join(tmpdir(), "plane-cli-discover-"));
  const configPath = path.join(dir, "config.json");
  writeFileSync(
    configPath,
    JSON.stringify({
      profiles: [
        {
          name: "test",
          baseUrl: "https://plane.example.test",
          token: "test-token",
          apiStyle: "work-items",
        },
      ],
      context: {
        activeProfile: "test",
        activeWorkspace: "workspace",
        activeProject: "project-123",
        activeProjectIdentifier: "ROADMAP",
      },
    }),
    "utf-8",
  );
  process.env.PLANE_CONFIG = configPath;
}

/** Fetch mock that lets each URL decide status + body (so we can force 404/500 on /pages/). */
function mockFetch(handler: (url: string) => { status?: number; body: unknown }): void {
  const fetchMock = vi.fn(async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const { status = 200, body } = handler(url);
    return new Response(JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  });
  globalThis.fetch = fetchMock as unknown as typeof fetch;
}

/** Route the non-pages selectors that issue-inputs / context need. */
function baseRoutes(url: string): { status?: number; body: unknown } | null {
  if (url.includes("/pages/")) return null; // caller decides
  if (url.includes("/states/"))
    return { body: { results: [{ id: "s2", name: "Done", group: "completed", color: "#000" }] } };
  if (url.includes("/labels/")) return { body: { results: [] } };
  if (url.includes("/cycles/")) return { body: { results: [] } };
  if (url.includes("/modules/")) return { body: { results: [] } };
  if (url.includes("/members/"))
    return { body: { results: [{ id: "m1", display_name: "Alice", email: "a@x", role: 15 }] } };
  if (url.includes("/users/me/"))
    return { body: { id: "u1", email: "a@x", display_name: "Alice" } };
  if (url.includes("/projects/"))
    return { body: { results: [{ id: "project-123", identifier: "ROADMAP", name: "Roadmap" }] } };
  throw new Error(`Unexpected URL: ${url}`);
}

describe("discover pages capability", () => {
  it("issue-inputs reports pages supported=false on a 404 probe", async () => {
    writeConfig();
    process.argv = ["node", "plane"];
    mockFetch((url) => baseRoutes(url) ?? { status: 404, body: { error: "Page not found." } });

    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await createDiscoverCommand().parseAsync(["issue-inputs"], { from: "user" });

    const payload = JSON.parse(log.mock.calls[0][0] as string) as {
      capabilities: { pages: { supported: boolean | null; reason: string | null } };
    };
    expect(payload.capabilities.pages.supported).toBe(false);
    expect(payload.capabilities.pages.reason).toContain("404");
  });

  it("issue-inputs reports pages supported=true when the endpoint answers", async () => {
    writeConfig();
    process.argv = ["node", "plane"];
    mockFetch((url) => baseRoutes(url) ?? { status: 200, body: { results: [] } });

    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await createDiscoverCommand().parseAsync(["issue-inputs"], { from: "user" });

    const payload = JSON.parse(log.mock.calls[0][0] as string) as {
      capabilities: { pages: { supported: boolean | null } };
    };
    expect(payload.capabilities.pages.supported).toBe(true);
  });

  it("a probe error never crashes discover and yields supported=null", async () => {
    writeConfig();
    process.argv = ["node", "plane"];
    // 401 is non-retryable and non-404, so the probe resolves to "unknown" fast.
    mockFetch((url) => baseRoutes(url) ?? { status: 401, body: { error: "unauthorized" } });

    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    // Must not throw / must still print a single pure-JSON payload.
    await createDiscoverCommand().parseAsync(["issue-inputs"], { from: "user" });

    expect(log).toHaveBeenCalledTimes(1);
    const payload = JSON.parse(log.mock.calls[0][0] as string) as {
      capabilities: { pages: { supported: boolean | null } };
    };
    expect(payload.capabilities.pages.supported).toBeNull();
  });

  it("context includes the pages capability when a project is in context", async () => {
    writeConfig();
    process.argv = ["node", "plane"];
    mockFetch((url) => baseRoutes(url) ?? { status: 404, body: { error: "Page not found." } });

    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await createDiscoverCommand().parseAsync(["context"], { from: "user" });

    const payload = JSON.parse(log.mock.calls[0][0] as string) as {
      kind: string;
      capabilities: { pages: { supported: boolean | null } };
    };
    expect(payload.kind).toBe("context");
    expect(payload.capabilities.pages.supported).toBe(false);
  });
});
