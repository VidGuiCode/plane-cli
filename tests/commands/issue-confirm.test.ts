import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createIssueCommand } from "../../src/commands/issue.js";

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
  const dir = mkdtempSync(path.join(tmpdir(), "plane-cli-issue-"));
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

// Handles the full slug-resolution flow: project list, issue list, states, and the mutation.
function mockFetch(): void {
  globalThis.fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    let body: unknown = {};
    if (url.includes("/states/")) {
      body = { results: [{ id: "state-done", group: "completed", name: "Done" }] };
    } else if (url.endsWith("/projects/")) {
      body = { results: [{ id: "project-123", identifier: "ROADMAP", name: "Roadmap" }] };
    } else if (url.includes("/issues/")) {
      body =
        init?.method === "PATCH"
          ? { id: "issue-1", sequence_id: 1, name: "Thing", state: "state-done" }
          : { results: [{ id: "issue-1", sequence_id: 1 }] };
    }
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as unknown as typeof fetch;
}

describe("issue confirmation strings (identifier once, resolved UUID surfaced)", () => {
  it("close PROJ-N prints the identifier once and the resolved UUID", async () => {
    writeConfig();
    process.argv = ["node", "plane"];
    mockFetch();

    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await createIssueCommand().parseAsync(["close", "ROADMAP-1"], { from: "user" });

    expect(log).toHaveBeenCalledWith("Closed ROADMAP-1 (uuid: issue-1).");
  });

  it("delete PROJ-N prints the identifier once and the resolved UUID", async () => {
    writeConfig();
    process.argv = ["node", "plane"];
    mockFetch();

    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await createIssueCommand().parseAsync(["delete", "ROADMAP-1"], { from: "user" });

    expect(log).toHaveBeenCalledWith("Deleted ROADMAP-1 (uuid: issue-1).");
  });

  it("update PROJ-N prints the resolved UUID", async () => {
    writeConfig();
    process.argv = ["node", "plane"];
    mockFetch();

    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await createIssueCommand().parseAsync(["update", "ROADMAP-1", "--title", "Thing"], {
      from: "user",
    });

    expect(log).toHaveBeenCalledWith("Updated ROADMAP-1: Thing (uuid: issue-1)");
  });
});
