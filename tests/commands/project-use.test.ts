import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createProjectCommand } from "../../src/commands/project.js";

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

const PROJECT_UUID = "beff0626-6b95-4c46-a591-d63de364ca19";

function writeConfig(): void {
  const dir = mkdtempSync(path.join(tmpdir(), "plane-cli-project-"));
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
        activeProject: null,
        activeProjectIdentifier: null,
      },
    }),
    "utf-8",
  );
  process.env.PLANE_CONFIG = configPath;
}

function mockFetch(): void {
  globalThis.fetch = vi.fn(async () => {
    const body = {
      results: [{ id: PROJECT_UUID, identifier: "MEETING", name: "Team Meetings" }],
    };
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as unknown as typeof fetch;
}

describe("project use accepts a UUID copied from a browser URL", () => {
  it("resolves the project when given its UUID id", async () => {
    writeConfig();
    process.argv = ["node", "plane"];
    mockFetch();

    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await createProjectCommand().parseAsync(["use", PROJECT_UUID], { from: "user" });

    expect(log).toHaveBeenCalledWith('Active project set to "Team Meetings" (MEETING).');
  });

  it("still resolves the project by identifier", async () => {
    writeConfig();
    process.argv = ["node", "plane"];
    mockFetch();

    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await createProjectCommand().parseAsync(["use", "MEETING"], { from: "user" });

    expect(log).toHaveBeenCalledWith('Active project set to "Team Meetings" (MEETING).');
  });
});
