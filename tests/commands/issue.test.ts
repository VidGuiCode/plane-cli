import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
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

// Generic handler-driven fetch mock (mirrors module/cycle command tests).
function mockFetch(handler: (url: string, init?: RequestInit) => unknown): void {
  globalThis.fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    return new Response(JSON.stringify(handler(url, init)), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as unknown as typeof fetch;
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

async function runIssueBatch(rows: unknown, args: string[] = []): Promise<void> {
  const dir = mkdtempSync(path.join(tmpdir(), "plane-cli-batch-test-"));
  const file = path.join(dir, "batch.json");
  try {
    writeFileSync(file, JSON.stringify(rows), "utf8");
    await createIssueCommand().parseAsync(["update", "--from-json", file, "--json", ...args], {
      from: "user",
    });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

describe("issue update --from-json", () => {
  it("shares resolver reads and sends each issue its own update", async () => {
    writeConfig();
    process.argv = ["node", "plane"];
    const reads: string[] = [];
    const writes = new Map<string, unknown>();
    mockFetch((url, init) => {
      const pathname = new URL(url).pathname;
      if (init?.method === "PATCH") {
        const id = pathname.split("/").at(-2)!;
        const body = JSON.parse(String(init.body));
        writes.set(id, body);
        return issue({ id, ...body });
      }
      reads.push(pathname);
      if (pathname.endsWith("/projects/")) {
        return { results: [{ id: "project-123", identifier: "ROADMAP", name: "Roadmap" }] };
      }
      if (pathname.endsWith("/issues/")) {
        return { results: [issue(), issue({ id: "issue-2", sequence_id: 2 })] };
      }
      if (pathname.endsWith("/states/")) {
        return {
          results: [
            { id: "state-1", name: "Todo" },
            { id: "state-2", name: "Done" },
          ],
        };
      }
      throw new Error(`Unexpected GET ${pathname}`);
    });
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    await runIssueBatch([
      { issue: "ROADMAP-1", title: "First", state: "Todo" },
      { issue: "ROADMAP-2", name: "Second", state: "Done" },
    ]);

    expect(reads.filter((url) => url.endsWith("/projects/"))).toHaveLength(1);
    expect(reads.filter((url) => url.endsWith("/issues/"))).toHaveLength(1);
    expect(reads.filter((url) => url.endsWith("/states/"))).toHaveLength(1);
    expect(writes.get("issue-1")).toEqual({ name: "First", state: "state-1" });
    expect(writes.get("issue-2")).toEqual({ name: "Second", state: "state-2" });
    expect(JSON.parse(String(log.mock.calls[0][0]))).toMatchObject({
      updated: 2,
      failed: 0,
      results: [
        { issue: "ROADMAP-1", issueId: "issue-1", status: "updated" },
        { issue: "ROADMAP-2", issueId: "issue-2", status: "updated" },
      ],
    });
  });

  it("previews resolved payloads and fails rows targeting the same issue", async () => {
    writeConfig();
    process.argv = ["node", "plane", "--dry-run"];
    const firstId = "11111111-1111-4111-8111-111111111111";
    const secondId = "22222222-2222-4222-8222-222222222222";
    mockListFetch([issue({ id: firstId }), issue({ id: secondId, sequence_id: 2 })]);
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const exit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);

    await runIssueBatch([
      { issue: "1", title: "First" },
      { issue: firstId, title: "Duplicate" },
      { issue: "2", descriptionHtml: "", due: "none" },
    ]);

    expect(
      vi.mocked(globalThis.fetch).mock.calls.every(([, init]) => init?.method !== "PATCH"),
    ).toBe(true);
    expect(JSON.parse(String(log.mock.calls[0][0]))).toMatchObject({
      updated: 0,
      failed: 2,
      results: [
        { issue: "1", issueId: firstId, status: "failed" },
        { issue: firstId, issueId: firstId, status: "failed" },
        {
          issue: "2",
          issueId: secondId,
          status: "planned",
          method: "PATCH",
          body: { description_html: "", target_date: null },
        },
      ],
    });
    if (exit.mock.calls.length > 0) expect(exit).toHaveBeenCalledWith(expect.any(Number));
    else expect(process.exitCode).not.toBe(0);
    process.exitCode = undefined;
  });

  it("rejects invalid rows and conflicting flags before touching the API", async () => {
    writeConfig();
    mockFetch(() => ({}));
    const exit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await runIssueBatch([
      { issue: "1", title: "Valid" },
      { issue: "2", assignee: "wrong type" },
    ]);
    await runIssueBatch([{ issue: "1", title: "Valid" }], ["--priority", "low"]);

    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(exit).toHaveBeenCalledTimes(2);
    expect(error).toHaveBeenCalledTimes(2);
  });

  it("keeps successful writes and reports resolution and PATCH failures in input order", async () => {
    writeConfig();
    process.argv = ["node", "plane"];
    const targets: string[] = [];
    globalThis.fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
      const url = new URL(String(input));
      if (init?.method !== "PATCH") {
        return Response.json({ results: [issue(), issue({ id: "issue-2", sequence_id: 2 })] });
      }
      const id = url.pathname.split("/").at(-2)!;
      targets.push(id);
      if (id === "issue-1") return Response.json({ detail: "Fixture rejection" }, { status: 400 });
      return Response.json(issue({ id, ...JSON.parse(String(init.body)) }));
    });
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    const originalExitCode = process.exitCode;
    try {
      await runIssueBatch([
        { issue: "1", title: "Rejected" },
        { issue: "99", title: "Missing" },
        { issue: "2", title: "Updated" },
      ]);

      expect(new Set(targets)).toEqual(new Set(["issue-1", "issue-2"]));
      expect(JSON.parse(String(log.mock.calls[0][0]))).toMatchObject({
        updated: 1,
        failed: 2,
        results: [
          { issue: "1", issueId: "issue-1", status: "failed", error: expect.any(String) },
          { issue: "99", status: "failed", error: expect.any(String) },
          { issue: "2", issueId: "issue-2", status: "updated" },
        ],
      });
    } finally {
      process.exitCode = originalExitCode;
    }
  });
});

describe("assertIssueUpdateRoundTrip", () => {
  it("requires an explicitly empty description to actually be empty", () => {
    for (const description_html of ["", "<p></p>"]) {
      expect(() =>
        assertIssueUpdateRoundTrip(issue({ description_html }), {
          description_html: "",
        }),
      ).not.toThrow();
    }
    expect(() =>
      assertIssueUpdateRoundTrip(issue({ description_html: "<p>Still here</p>" }), {
        description_html: "",
      }),
    ).toThrow(/description_html/);
    expect(() => assertIssueUpdateRoundTrip(issue(), { description_html: "" })).toThrow(
      /description_html/,
    );
  });

  it("checks parent assignment and clearing against returned values", () => {
    expect(() =>
      assertIssueUpdateRoundTrip(issue({ parent: null }), { parent: null }),
    ).not.toThrow();
    expect(() =>
      assertIssueUpdateRoundTrip(issue({ parent: "parent-id" }), { parent: "parent-id" }),
    ).not.toThrow();
    expect(() => assertIssueUpdateRoundTrip(issue({ parent: "old-id" }), { parent: null })).toThrow(
      /parent/,
    );
    expect(() => assertIssueUpdateRoundTrip(issue(), { parent: null })).toThrow(/parent/);
  });
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

  it("accepts an escaped description_html-only response (HTML-special characters)", () => {
    // The API wraps content in block tags and entity-escapes &, <, > before
    // returning it, and returns only description_html (no description_stripped).
    // Both sides must go through stripHtml before comparison, or every write
    // whose text contains &, <, > reports a false failure.
    expect(() =>
      assertIssueUpdateRoundTrip(
        issue({
          // description_stripped absent: the API returned only description_html.
          description_html: "<p>A &amp; B &gt; C</p>",
        }),
        {
          description_html: "<p>A & B > C</p>",
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

describe("issue rewrite inputs", () => {
  const html = "<h2>Plan</h2>\n<ol><li><strong>Ship</strong> &amp; verify</li></ol>";

  it.each(["create", "update"])("%s sends HTML without adding a wrapper", async (verb) => {
    writeConfig();
    process.argv = ["node", "plane"];
    const writes: RequestInit[] = [];
    mockFetch((_url, init) => {
      if (init?.method) {
        writes.push(init);
        expect(JSON.parse(init.body as string).description_html).toBe(html);
        return issue({ description_html: html });
      }
      return { results: [issue()] };
    });
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    await createIssueCommand().parseAsync(
      verb === "create"
        ? ["create", "--title", "Plan", "--description-html", html, "--json"]
        : ["update", "1", "--description-html", html, "--json"],
      { from: "user" },
    );
    expect(writes).toHaveLength(1);
    expect(writes[0].method).toBe(verb === "create" ? "POST" : "PATCH");
  });

  it.each(["--description", "--description-html"])("update accepts an empty %s", async (flag) => {
    writeConfig();
    process.argv = ["node", "plane"];
    const writes: RequestInit[] = [];
    mockFetch((_url, init) => {
      if (init?.method) {
        writes.push(init);
        expect(JSON.parse(init.body as string)).toEqual({
          description_html: flag === "--description" ? "<p></p>" : "",
        });
        return issue({ description_html: "" });
      }
      return { results: [issue()] };
    });
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    await createIssueCommand().parseAsync(["update", "1", flag, "", "--json"], { from: "user" });
    expect(writes).toHaveLength(1);
  });

  it.each(["create", "update"])(
    "%s rejects conflicting text/HTML before API calls",
    async (verb) => {
      writeConfig();
      process.argv = ["node", "plane"];
      mockFetch(() => ({}));
      const exit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
      const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
      await createIssueCommand().parseAsync(
        [
          ...(verb === "create" ? ["create", "--title", "Plan"] : ["update", "1"]),
          "--description",
          "",
          "--description-html",
          "",
          "--project",
          "Other",
          "--json",
        ],
        { from: "user" },
      );
      expect(globalThis.fetch).not.toHaveBeenCalled();
      expect(exit).toHaveBeenCalledWith(3);
      expect(JSON.parse(error.mock.calls[0][0] as string).message).toContain("mutually exclusive");
    },
  );

  it.each([false, true])(
    "clears parents without resolving 'none' (dry-run: %s)",
    async (dryRun) => {
      writeConfig();
      process.argv = ["node", "plane", ...(dryRun ? ["--dry-run"] : [])];
      const writes: RequestInit[] = [];
      mockFetch((_url, init) => {
        if (init?.method) {
          writes.push(init);
          expect(JSON.parse(init.body as string)).toEqual({ parent: null });
          return issue({ parent: null });
        }
        return { results: [issue({ parent: "old-parent" })] };
      });
      const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
      await createIssueCommand().parseAsync(["update", "1", "--parent", "none", "--json"], {
        from: "user",
      });
      expect(writes).toHaveLength(dryRun ? 0 : 1);
      const result = JSON.parse(log.mock.calls[0][0] as string);
      if (dryRun) expect(result).toMatchObject({ method: "PATCH", body: { parent: null } });
      else expect(result.parent).toBeNull();
    },
  );

  it("continues to assign a resolved parent", async () => {
    writeConfig();
    process.argv = ["node", "plane"];
    const writes: RequestInit[] = [];
    mockFetch((_url, init) => {
      if (init?.method) {
        writes.push(init);
        expect(JSON.parse(init.body as string)).toEqual({ parent: "parent-id" });
        return issue({ parent: "parent-id" });
      }
      return { results: [issue(), issue({ id: "parent-id", sequence_id: 2 })] };
    });
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    await createIssueCommand().parseAsync(["update", "1", "--parent", "2", "--json"], {
      from: "user",
    });
    expect(writes).toHaveLength(1);
  });

  it("keeps the bulk-parent restriction, including clearing", async () => {
    writeConfig();
    process.argv = ["node", "plane"];
    mockFetch(() => ({}));
    const exit = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);
    await createIssueCommand().parseAsync(["update", "1,2", "--parent", "none", "--json"], {
      from: "user",
    });
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(exit).toHaveBeenCalledWith(3);
    expect(JSON.parse(error.mock.calls[0][0] as string).message).toContain("bulk updates");
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
    await createIssueCommand().parseAsync(
      ["get", "ROADMAP-1", "--json", "--fields", "title,state"],
      {
        from: "user",
      },
    );

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

describe("issue create --module / --cycle", () => {
  it("dry-run previews the create POST plus module and cycle membership POSTs", async () => {
    writeConfig();
    process.argv = ["node", "plane", "--dry-run"];
    mockFetch((url) => {
      if (url.includes("/modules/")) return { results: [{ id: "module-1", name: "M1" }] };
      if (url.includes("/cycles/")) return { results: [{ id: "cycle-1", name: "C1" }] };
      return {};
    });

    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await createIssueCommand().parseAsync(
      [
        "create",
        "--title",
        "New thing",
        "--description",
        "",
        "--module",
        "M1",
        "--cycle",
        "C1",
        "--json",
      ],
      { from: "user" },
    );

    const calls = JSON.parse(log.mock.calls[0][0] as string) as Array<{
      method: string;
      path: string;
      body: unknown;
    }>;
    expect(calls).toHaveLength(3);
    expect(calls[0]).toMatchObject({
      method: "POST",
      path: "workspaces/workspace/projects/project-123/issues/",
      body: { name: "New thing" },
    });
    expect(calls[1]).toMatchObject({
      method: "POST",
      path: "workspaces/workspace/projects/project-123/modules/module-1/module-issues/",
      body: { issues: ["<new-issue-id>"] },
    });
    expect(calls[2]).toMatchObject({
      method: "POST",
      path: "workspaces/workspace/projects/project-123/cycles/cycle-1/cycle-issues/",
      body: { issues: ["<new-issue-id>"] },
    });
  });

  it("dry-run without --module/--cycle stays a single create object", async () => {
    writeConfig();
    process.argv = ["node", "plane", "--dry-run"];
    mockFetch(() => ({}));

    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await createIssueCommand().parseAsync(
      ["create", "--title", "Solo", "--description", "", "--json"],
      { from: "user" },
    );

    const payload = JSON.parse(log.mock.calls[0][0] as string);
    expect(Array.isArray(payload)).toBe(false);
    expect(payload).toMatchObject({
      method: "POST",
      path: "workspaces/workspace/projects/project-123/issues/",
      body: { name: "Solo" },
    });
  });
});

describe("issue creation preflight and import", () => {
  const project = { id: "project-123", identifier: "ROADMAP", name: "Roadmap" };

  async function importIssues(fileName: string, text: string, flags: string[] = []) {
    const dir = mkdtempSync(path.join(tmpdir(), "plane-cli-create-test-"));
    try {
      writeFileSync(path.join(dir, "details.txt"), "First line\r\n<tag> & text", "utf8");
      const file = path.join(dir, fileName);
      writeFileSync(file, text, "utf8");
      await createIssueCommand().parseAsync(
        ["bulk-create", "--file", file, "--project", "ROADMAP", "--json", ...flags],
        { from: "user" },
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }

  it.each(["create", "update"])("reads a description file on issue %s", async (verb) => {
    writeConfig();
    const dir = mkdtempSync(path.join(tmpdir(), "plane-cli-description-test-"));
    const file = path.join(dir, "description.txt");
    const html = "<p>First line<br>&lt;tag&gt; &amp; text</p>";
    try {
      writeFileSync(file, "First line\r\n<tag> & text", "utf8");
      const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
      mockListFetch([issue()]);
      process.argv = ["node", "plane", "--dry-run"];
      const args = verb === "create" ? ["create", "--title", "New issue"] : ["update", "1"];
      await createIssueCommand().parseAsync([...args, "--description-file", file], {
        from: "user",
      });
      expect(JSON.parse(log.mock.calls[0][0] as string).body.description_html).toBe(html);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("previews YAML, relative description files and deduplicated labels without writes", async () => {
    writeConfig();
    process.argv = ["node", "plane", "--dry-run"];
    mockFetch((url, init) => {
      expect(init?.method).toBeUndefined();
      if (url.includes("/labels/")) return [];
      if (url.includes("/states/")) return [{ id: "todo-1", name: "Todo" }];
      return [project];
    });
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await importIssues(
      "issues.yaml",
      "- title: First\n  descriptionFile: details.txt\n  state: Todo\n  due: 2028-02-29\n  label: [Docs]\n- title: Second\n  label: [docs]\n",
      ["--create-labels"],
    );
    expect(JSON.parse(log.mock.calls[0][0] as string)).toMatchObject({
      created: 0,
      failed: 0,
      results: [
        {
          status: "planned",
          requests: [
            { path: expect.stringMatching(/labels\/$/), body: { name: "Docs" } },
            {
              body: {
                name: "First",
                state: "todo-1",
                target_date: "2028-02-29",
                description_html: "<p>First line<br>&lt;tag&gt; &amp; text</p>",
                labels: ["<new-label-id:Docs>"],
              },
            },
          ],
        },
        {
          status: "planned",
          requests: [{ body: { name: "Second", labels: ["<new-label-id:Docs>"] } }],
        },
      ],
    });
  });

  it("reports invalid rows and blocks all writes, including label creation", async () => {
    writeConfig();
    const previousExitCode = process.exitCode;
    mockFetch((url, init) => {
      expect(init?.method).toBeUndefined();
      return url.includes("/labels/") || url.includes("/states/") || url.includes("/members/")
        ? []
        : [project];
    });
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    try {
      await importIssues(
        "issues.json",
        JSON.stringify([
          { title: "Would be valid", label: ["New"] },
          { title: "Bad date", due: "2027-02-29" },
          { title: "Bad state", state: "Missing" },
          { title: "Bad assignee", assignee: ["Nobody"] },
        ]),
        ["--create-labels"],
      );
      expect(process.exitCode).toBe(1);
      expect(JSON.parse(log.mock.calls[0][0] as string)).toMatchObject({
        created: 0,
        failed: 3,
        results: [
          { status: "blocked" },
          { status: "failed", error: expect.stringContaining("valid date") },
          { status: "failed", error: expect.stringContaining('State "Missing"') },
          { status: "failed", error: expect.stringContaining('Member "Nobody"') },
        ],
      });
    } finally {
      process.exitCode = previousExitCode;
    }
  });

  it("creates missing labels once and attaches their IDs to each created issue", async () => {
    writeConfig();
    const writes: unknown[] = [];
    mockFetch((url, init) => {
      if (init?.method === "POST") {
        const body = JSON.parse(init.body as string);
        writes.push(body);
        if (url.includes("/labels/")) return { id: "new-label-1", name: "Docs" };
        return issue({ name: body.name });
      }
      return url.includes("/labels/") ? [] : [project];
    });
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await importIssues(
      "issues.json",
      JSON.stringify([
        { title: "First", label: ["Docs"] },
        { title: "Second", label: ["docs"] },
      ]),
      ["--create-labels"],
    );
    expect(writes).toEqual([
      { name: "Docs" },
      { name: "First", labels: ["new-label-1"] },
      { name: "Second", labels: ["new-label-1"] },
    ]);
    expect(JSON.parse(log.mock.calls[0][0] as string)).toMatchObject({ created: 2, failed: 0 });
  });

  it("validates a single issue and reports skipped labels without creating anything", async () => {
    writeConfig();
    mockFetch((url, init) => {
      expect(init?.method).toBeUndefined();
      return url.includes("/labels/") ? [] : [project];
    });
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await createIssueCommand().parseAsync(
      [
        "create",
        "--project",
        "ROADMAP",
        "--title",
        "First",
        "--label",
        "Missing",
        "--ignore-missing-labels",
        "--validate-only",
      ],
      { from: "user" },
    );
    expect(JSON.parse(log.mock.calls[0][0] as string)).toMatchObject({
      valid: true,
      requests: [{ body: { name: "First" }, ignoredLabels: ["Missing"] }],
    });
  });
});
