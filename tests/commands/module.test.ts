import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createModuleCommand } from "../../src/commands/module.js";

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
  const dir = mkdtempSync(path.join(tmpdir(), "plane-cli-module-"));
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

describe("module command", () => {
  it("returns an existing module from ensure without creating", async () => {
    writeConfig();
    process.argv = ["node", "plane"];
    const existing = { id: "module-1", name: "Website Deployment" };
    const fetchMock = mockFetch((url) => {
      expect(url).toContain("/modules/");
      return { results: [existing] };
    });

    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await createModuleCommand().parseAsync(["ensure", "website deployment", "--json"], {
      from: "user",
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(log.mock.calls[0][0] as string)).toEqual({
      status: "existing",
      module: existing,
    });
  });

  it("dry-runs creating a missing module from ensure", async () => {
    writeConfig();
    process.argv = ["node", "plane", "--dry-run"];
    mockFetch((url) => {
      expect(url).toContain("/modules/");
      return { results: [] };
    });

    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await createModuleCommand().parseAsync(["ensure", "Website Deployment", "--json"], {
      from: "user",
    });

    const dryRun = JSON.parse(log.mock.calls[0][0] as string) as {
      body: { name: string };
    };
    expect(dryRun).toMatchObject({
      dryRun: true,
      method: "POST",
      path: "workspaces/workspace/projects/project-123/modules/",
      body: { name: "Website Deployment" },
    });
  });

  it("adds comma-separated issues to a module in one request", async () => {
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
      if (url.includes("/modules/")) {
        return { results: [{ id: "module-1", name: "Website Deployment" }] };
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await createModuleCommand().parseAsync(["add", "157,158,159", "Website Deployment", "--json"], {
      from: "user",
    });

    const dryRun = JSON.parse(log.mock.calls[0][0] as string) as { body: { issues: string[] } };
    expect(dryRun).toMatchObject({
      dryRun: true,
      method: "POST",
      path: "workspaces/workspace/projects/project-123/modules/module-1/module-issues/",
      body: { issues: ["issue-1", "issue-2", "issue-3"] },
    });
  });

  it("dry-runs a module update PATCH with mapped fields and a resolved lead", async () => {
    writeConfig();
    process.argv = ["node", "plane", "--dry-run"];
    mockFetch((url) => {
      if (url.includes("/members/")) {
        return { results: [{ id: "mem-1", display_name: "Alice", member: "user-1" }] };
      }
      if (url.includes("/modules/")) {
        return { results: [{ id: "module-1", name: "Website Deployment" }] };
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await createModuleCommand().parseAsync(
      [
        "update",
        "Website Deployment",
        "--status",
        "in-progress",
        "--target",
        "2030-06-01",
        "--lead",
        "Alice",
        "--json",
      ],
      { from: "user" },
    );

    expect(JSON.parse(log.mock.calls[0][0] as string)).toMatchObject({
      dryRun: true,
      method: "PATCH",
      path: "workspaces/workspace/projects/project-123/modules/module-1/",
      body: { status: "in-progress", target_date: "2030-06-01", lead: "user-1" },
    });
  });

  it("includes new properties when creating a module", async () => {
    writeConfig();
    process.argv = ["node", "plane", "--dry-run"];
    mockFetch(() => ({}));

    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await createModuleCommand().parseAsync(
      [
        "create",
        "Milestone 1",
        "--description",
        "First milestone",
        "--status",
        "planned",
        "--target",
        "2030-06-01",
        "--json",
      ],
      { from: "user" },
    );

    expect(JSON.parse(log.mock.calls[0][0] as string)).toMatchObject({
      method: "POST",
      path: "workspaces/workspace/projects/project-123/modules/",
      body: {
        name: "Milestone 1",
        description: "First milestone",
        status: "planned",
        target_date: "2030-06-01",
      },
    });
  });
});
