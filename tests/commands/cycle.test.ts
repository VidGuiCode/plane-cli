import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createCycleCommand } from "../../src/commands/cycle.js";

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

function writeConfig(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "plane-cli-cycle-"));
  const configPath = path.join(dir, "config.json");
  writeFileSync(
    configPath,
    JSON.stringify({
      profiles: [
        {
          name: "test",
          baseUrl: "https://plane.example.test",
          token: "test-token",
          apiStyle: "issues",
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
  return configPath;
}

function mockFetch(handler: (url: string, init?: RequestInit) => unknown): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const body = handler(url, init);
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  });
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

describe("cycle command", () => {
  it("includes project_id in the cycle create dry-run body", async () => {
    writeConfig();
    process.argv = ["node", "plane", "--dry-run"];

    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await createCycleCommand().parseAsync(
      [
        "create",
        "May 2026 Website Deployment Foundation",
        "--start",
        "2026-05-06",
        "--end",
        "2026-05-19",
        "--json",
      ],
      { from: "user" },
    );

    const dryRun = JSON.parse(log.mock.calls[0][0] as string) as {
      body: { name: string; project_id?: string; start_date?: string; end_date?: string };
    };
    expect(dryRun.body).toMatchObject({
      name: "May 2026 Website Deployment Foundation",
      project_id: "project-123",
      start_date: "2026-05-06",
      end_date: "2026-05-19",
    });
  });

  it("returns an existing cycle from ensure without creating", async () => {
    writeConfig();
    process.argv = ["node", "plane"];
    const existing = { id: "cycle-1", name: "Website Deployment" };
    const fetchMock = mockFetch((url) => {
      expect(url).toContain("/cycles/");
      return { results: [existing] };
    });

    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await createCycleCommand().parseAsync(["ensure", "website deployment", "--json"], {
      from: "user",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(log.mock.calls[0][0] as string)).toEqual({
      status: "existing",
      cycle: existing,
    });
  });

  it("dry-runs creating a missing cycle from ensure", async () => {
    writeConfig();
    process.argv = ["node", "plane", "--dry-run"];
    mockFetch((url) => {
      expect(url).toContain("/cycles/");
      return { results: [] };
    });

    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await createCycleCommand().parseAsync(
      ["ensure", "Website Deployment", "--start", "2026-05-06", "--end", "2026-05-19", "--json"],
      { from: "user" },
    );

    const dryRun = JSON.parse(log.mock.calls[0][0] as string) as {
      body: { name: string; project_id?: string; start_date?: string; end_date?: string };
    };
    expect(dryRun).toMatchObject({
      dryRun: true,
      method: "POST",
      path: "workspaces/workspace/projects/project-123/cycles/",
      body: {
        name: "Website Deployment",
        project_id: "project-123",
        start_date: "2026-05-06",
        end_date: "2026-05-19",
      },
    });
  });

  it("adds comma-separated issues to a cycle in one request", async () => {
    writeConfig();
    process.argv = ["node", "plane", "--dry-run"];
    mockFetch((url) => {
      if (url.includes("/issues/")) {
        return {
          results: [
            { id: "issue-1", sequence_id: 157 },
            { id: "issue-2", sequence_id: 158 },
            { id: "issue-3", sequence_id: 159 },
          ],
        };
      }
      if (url.includes("/cycles/")) {
        return { results: [{ id: "cycle-1", name: "Website Deployment" }] };
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await createCycleCommand().parseAsync(["add", "157,158,159", "Website Deployment", "--json"], {
      from: "user",
    });

    const dryRun = JSON.parse(log.mock.calls[0][0] as string) as { body: { issues: string[] } };
    expect(dryRun).toMatchObject({
      dryRun: true,
      method: "POST",
      path: "workspaces/workspace/projects/project-123/cycles/cycle-1/issues/",
      body: { issues: ["issue-1", "issue-2", "issue-3"] },
    });
  });
});
