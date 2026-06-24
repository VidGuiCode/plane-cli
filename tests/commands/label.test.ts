import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createLabelCommand } from "../../src/commands/label.js";

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
  const dir = mkdtempSync(path.join(tmpdir(), "plane-cli-label-"));
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

describe("label ensure", () => {
  it("returns an existing label without creating", async () => {
    writeConfig();
    process.argv = ["node", "plane"];
    const existing = { id: "label-1", name: "Accounting", color: "#27AE60" };
    const fetchMock = mockFetch((url) => {
      expect(url).toContain("/labels/");
      return { results: [existing] };
    });

    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await createLabelCommand().parseAsync(["ensure", "accounting", "--json"], { from: "user" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(log.mock.calls[0][0] as string)).toEqual({
      status: "existing",
      label: existing,
    });
  });

  it("dry-runs creating a missing label with the provided color", async () => {
    writeConfig();
    process.argv = ["node", "plane", "--dry-run"];
    mockFetch((url) => {
      expect(url).toContain("/labels/");
      return { results: [] };
    });

    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await createLabelCommand().parseAsync(["ensure", "Compliance", "#ff0000", "--json"], {
      from: "user",
    });

    expect(JSON.parse(log.mock.calls[0][0] as string)).toMatchObject({
      dryRun: true,
      method: "POST",
      path: "workspaces/workspace/projects/project-123/labels/",
      body: { name: "Compliance", color: "#ff0000" },
    });
  });

  it("omits color from the body when not provided", async () => {
    writeConfig();
    process.argv = ["node", "plane", "--dry-run"];
    mockFetch(() => ({ results: [] }));

    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await createLabelCommand().parseAsync(["ensure", "Compliance", "--json"], { from: "user" });

    const dryRun = JSON.parse(log.mock.calls[0][0] as string) as { body: Record<string, unknown> };
    expect(dryRun.body).toEqual({ name: "Compliance" });
  });
});
