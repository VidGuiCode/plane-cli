import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  assertIssueUpdateRoundTrip,
  createIssueCommand,
  resolveIssueColumns,
} from "../../src/commands/issue.js";
import type { PlaneIssue } from "../../src/core/types.js";

function issue(overrides: Partial<PlaneIssue> = {}): PlaneIssue {
  return {
    id: "issue-1",
    sequence_id: 1,
    name: "Original",
    priority: "none",
    assignees: [],
    labels: [],
    target_date: null,
    start_date: null,
    created_at: "2026-05-06T00:00:00Z",
    updated_at: "2026-05-06T00:00:00Z",
    ...overrides,
  };
}

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

// Serves the full issue-list / single-issue / states / projects surface.
function mockListFetch(issues: Array<Record<string, unknown>>): void {
  globalThis.fetch = vi.fn(async (input: string | URL | Request) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    let body: unknown = {};
    if (url.includes("/states/")) {
      body = { results: [{ id: "state-1", name: "Todo", group: "unstarted" }] };
    } else if (/\/issues\/[^/?]+\//.test(url)) {
      // single-issue GET (…/issues/<id>/)
      body = issues[0];
    } else if (url.includes("/issues/")) {
      body = { results: issues, next_page_results: false };
    } else if (url.endsWith("/projects/")) {
      body = { results: [{ id: "project-123", identifier: "ROADMAP", name: "Roadmap" }] };
    }
    return new Response(JSON.stringify(body), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as unknown as typeof fetch;
}

describe("assertIssueUpdateRoundTrip", () => {
  it("accepts matching returned fields", () => {
    expect(() =>
      assertIssueUpdateRoundTrip(
        issue({
          name: "Updated",
          description_stripped: "New description",
          priority: "high",
          state: "state-1",
          assignees: ["user-1"],
          labels: [{ id: "label-1", name: "Backend", color: "#000000" }],
          target_date: "2030-01-01",
          start_date: null,
        }),
        {
          name: "Updated",
          description_html: "<p>New description</p>",
          priority: "high",
          state: "state-1",
          assignees: ["user-1"],
          labels: ["label-1"],
          target_date: "2030-01-01",
          start_date: null,
        },
      ),
    ).not.toThrow();
  });

  it("throws when a requested field is silently ignored", () => {
    expect(() =>
      assertIssueUpdateRoundTrip(issue({ target_date: null }), {
        target_date: "2030-01-01",
      }),
    ).toThrow(/target_date/);
  });

  it("throws when returned labels do not include requested label IDs", () => {
    expect(() =>
      assertIssueUpdateRoundTrip(issue({ labels: [] }), {
        labels: ["label-1"],
      }),
    ).toThrow(/labels/);
  });
});

describe("issue get --fields", () => {
  it("warns on unknown field names via stderr while keeping stdout pure JSON", async () => {
    writeConfig();
    process.argv = ["node", "plane"];
    mockListFetch([{ id: "issue-1", sequence_id: 1, name: "Thing", state: "state-1" }]);

    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await createIssueCommand().parseAsync(
      ["get", "ROADMAP-1", "--json", "--fields", "title,description_stripped"],
      { from: "user" },
    );

    // stdout stays pure JSON — only the known field survives, no warning mixed in
    expect(log).toHaveBeenCalledTimes(1);
    expect(JSON.parse(log.mock.calls[0][0] as string)).toEqual({ title: "Thing" });

    // stderr carries the warning naming the unknown field
    expect(err).toHaveBeenCalled();
    const warning = err.mock.calls.map((c) => String(c[0])).join("\n");
    expect(warning).toContain("description_stripped");
    expect(warning).toMatch(/unknown --fields/i);
  });

  it("stays silent when all requested fields are known", async () => {
    writeConfig();
    process.argv = ["node", "plane"];
    mockListFetch([{ id: "issue-1", sequence_id: 1, name: "Thing", state: "state-1" }]);

    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const err = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await createIssueCommand().parseAsync(["get", "ROADMAP-1", "--json", "--fields", "title,state"], {
      from: "user",
    });

    expect(JSON.parse(log.mock.calls[0][0] as string)).toEqual({ title: "Thing", state: "Todo" });
    expect(err).not.toHaveBeenCalled();
  });
});

describe("resolveIssueColumns", () => {
  it("defaults to id/title/state/priority/due (DUE tracking column included)", () => {
    expect(resolveIssueColumns(undefined)).toEqual(["id", "title", "state", "priority", "due"]);
  });

  it("returns the requested columns, lowercased", () => {
    expect(resolveIssueColumns("id,Title,DUE,assignee")).toEqual([
      "id",
      "title",
      "due",
      "assignee",
    ]);
  });

  it("throws a ValidationError naming unknown columns", () => {
    expect(() => resolveIssueColumns("id,bogus")).toThrow(/Unknown --columns name\(s\): bogus/);
  });
});

describe("issue list --columns", () => {
  it("renders exactly the requested columns", async () => {
    writeConfig();
    process.argv = ["node", "plane"];
    mockListFetch([
      {
        id: "issue-1",
        sequence_id: 7,
        name: "Ship it",
        state: "state-1",
        priority: "high",
        target_date: "2030-01-01",
        assignees: ["user-9"],
      },
    ]);

    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await createIssueCommand().parseAsync(["list", "--columns", "id,title,due,assignee"], {
      from: "user",
    });

    const output = log.mock.calls.map((c) => String(c[0]));
    const header = output[0];
    expect(header).toContain("ID");
    expect(header).toContain("TITLE");
    expect(header).toContain("DUE");
    expect(header).toContain("ASSIGNEE");
    expect(header).not.toContain("STATE");
    expect(header).not.toContain("PRIORITY");

    const dataRow = output[output.length - 1];
    expect(dataRow).toContain("ROADMAP-7");
    expect(dataRow).toContain("2030-01-01");
    expect(dataRow).toContain("user-9");
  });
});
