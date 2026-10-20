import { afterEach, describe, expect, it, vi } from "vitest";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createPageCommand } from "../../src/commands/page.js";

const originalArgv = [...process.argv];
const originalConfig = process.env.PLANE_CONFIG;
const originalFetch = globalThis.fetch;

const PAGE_ID = "550e8400-e29b-41d4-a716-446655440000";

const pageFixture = {
  id: PAGE_ID,
  name: "Meeting Notes",
  description_html: "<p>existing</p>",
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-02T00:00:00Z",
};

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
  const dir = mkdtempSync(path.join(tmpdir(), "plane-cli-page-"));
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

/** Fetch mock that lets each URL decide status + body (204s need no body). */
function mockFetch(
  handler: (url: string, init?: RequestInit) => { status?: number; body?: unknown },
): ReturnType<typeof vi.fn> {
  const fetchMock = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const { status = 200, body } = handler(url, init);
    return new Response(body === undefined ? null : JSON.stringify(body), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  });
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  return fetchMock;
}

/** archive/unarchive resolution: the page detail GET, everything else fails. */
function servePage(status = 200): (url: string) => { status?: number; body?: unknown } {
  return (url) => {
    if (url.endsWith(`/pages/${PAGE_ID}/`)) {
      return status === 200 ? { body: pageFixture } : { status, body: { error: "no page" } };
    }
    throw new Error(`Unexpected URL: ${url}`);
  };
}

function spyExit(): {
  exitSpy: ReturnType<typeof vi.spyOn>;
  errorSpy: ReturnType<typeof vi.spyOn>;
} {
  const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => undefined as never);
  const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);
  return { exitSpy, errorSpy };
}

describe("page rich text and update methods", () => {
  const html = "<h2>Plan</h2>\n<ul><li><strong>Ship</strong> &amp; verify</li></ul>";

  it.each(["create", "update"])("%s sends raw HTML unchanged", async (verb) => {
    writeConfig();
    process.argv = ["node", "plane"];
    const fetchMock = mockFetch((_url, init) => {
      expect(init?.method).toBe(verb === "create" ? "POST" : "PUT");
      const body = JSON.parse(init?.body as string);
      expect(body.description_html).toBe(html);
      if (verb === "update") expect(body).not.toHaveProperty("name");
      return { body: { ...pageFixture, description_html: html } };
    });
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await createPageCommand().parseAsync(
      [verb, verb === "create" ? "Plan" : PAGE_ID, "--content-html", html, "--json"],
      { from: "user" },
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(log.mock.calls[0][0] as string).description_html).toBe(html);
  });

  it.each(["--content", "--content-html"])("update accepts an empty %s", async (flag) => {
    writeConfig();
    process.argv = ["node", "plane"];
    const fetchMock = mockFetch((_url, init) => {
      expect(JSON.parse(init?.body as string)).toEqual({
        description_html: flag === "--content" ? "<p></p>" : "",
      });
      return { body: { ...pageFixture, description_html: "" } };
    });
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    await createPageCommand().parseAsync(["update", PAGE_ID, flag, "", "--json"], { from: "user" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each(["create", "update"])("%s rejects text plus HTML even when empty", async (verb) => {
    writeConfig();
    process.argv = ["node", "plane"];
    const fetchMock = mockFetch(() => ({ body: pageFixture }));
    const { exitSpy, errorSpy } = spyExit();
    await createPageCommand().parseAsync(
      [verb, PAGE_ID, "--content", "", "--content-html", "", "--project", "Other"],
      { from: "user" },
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(3);
    expect(errorSpy.mock.calls[0][0]).toContain("mutually exclusive");
  });

  it.each(["PUT", "PATCH"])("dry-run previews the selected %s without writes", async (method) => {
    writeConfig();
    process.argv = ["node", "plane", "--dry-run"];
    const fetchMock = mockFetch(() => ({ body: pageFixture }));
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await createPageCommand().parseAsync(
      ["update", PAGE_ID, "--content-html", html, "--method", method],
      { from: "user" },
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(JSON.parse(log.mock.calls[0][0] as string)).toMatchObject({
      method,
      body: { description_html: html },
    });
  });

  it("name-only updates omit content and an explicit PATCH sends PATCH", async () => {
    writeConfig();
    process.argv = ["node", "plane"];
    const fetchMock = mockFetch((_url, init) => {
      expect(init?.method).toBe("PATCH");
      expect(JSON.parse(init?.body as string)).toEqual({ name: "Renamed" });
      return { body: { ...pageFixture, name: "Renamed" } };
    });
    vi.spyOn(console, "log").mockImplementation(() => undefined);
    await createPageCommand().parseAsync(
      ["update", PAGE_ID, "--name", "Renamed", "--method", "PATCH", "--json"],
      { from: "user" },
    );
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([400, 403, 404, 405])("PUT error %s never triggers a PATCH fallback", async (status) => {
    writeConfig();
    process.argv = ["node", "plane"];
    const fetchMock = mockFetch((_url, init) => {
      expect(init?.method).toBe("PUT");
      return { status, body: { error: "rejected" } };
    });
    const { exitSpy, errorSpy } = spyExit();
    await createPageCommand().parseAsync(["update", PAGE_ID, "--name", "New", "--json"], {
      from: "user",
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(exitSpy).toHaveBeenCalled();
    const message = JSON.parse(errorSpy.mock.calls[0][0] as string).message;
    expect(message).toContain(String(status));
    expect(message).not.toContain("on any edition");
  });

  it("rejects unsupported methods before resolving the project", async () => {
    writeConfig();
    process.argv = ["node", "plane"];
    const fetchMock = mockFetch(() => ({ body: pageFixture }));
    const { exitSpy, errorSpy } = spyExit();
    await createPageCommand().parseAsync(
      ["update", PAGE_ID, "--name", "New", "--method", "POST", "--project", "Other"],
      { from: "user" },
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(3);
    expect(errorSpy.mock.calls[0][0]).toContain("--method must be PUT or PATCH");
  });

  it.each(["network", "server"])("a %s failure never switches update methods", async (failure) => {
    writeConfig();
    process.argv = ["node", "plane"];
    const fetchMock = mockFetch((_url, init) => {
      expect(init?.method).toBe("PUT");
      if (failure === "network") throw new TypeError("fetch failed");
      return { status: 503, body: { error: "document service unavailable" } };
    });
    const { exitSpy } = spyExit();
    vi.useFakeTimers();
    try {
      const pending = createPageCommand().parseAsync(
        ["update", PAGE_ID, "--name", "New", "--json"],
        { from: "user" },
      );
      await vi.runAllTimersAsync();
      await pending;
      // The existing API retry policy can retry PUT, but must never send PATCH.
      expect(fetchMock).toHaveBeenCalledTimes(4);
      expect(exitSpy).toHaveBeenCalledWith(1);
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("page archive / unarchive", () => {
  it("archive --dry-run previews the POST without sending", async () => {
    writeConfig();
    process.argv = ["node", "plane", "--dry-run"];
    const fetchMock = mockFetch(servePage());

    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await createPageCommand().parseAsync(["archive", PAGE_ID], { from: "user" });

    expect(fetchMock).toHaveBeenCalledTimes(1); // resolution GET only
    expect(JSON.parse(log.mock.calls[0][0] as string)).toEqual({
      dryRun: true,
      method: "POST",
      path: `workspaces/workspace/projects/project-123/pages/${PAGE_ID}/archive/`,
      context: { workspace: "workspace", projectId: "project-123", pageId: PAGE_ID },
    });
  });

  it("unarchive --dry-run previews the DELETE without sending", async () => {
    writeConfig();
    process.argv = ["node", "plane", "--dry-run"];
    const fetchMock = mockFetch(servePage());

    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await createPageCommand().parseAsync(["unarchive", PAGE_ID], { from: "user" });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(JSON.parse(log.mock.calls[0][0] as string)).toEqual({
      dryRun: true,
      method: "DELETE",
      path: `workspaces/workspace/projects/project-123/pages/${PAGE_ID}/archive/`,
      context: { workspace: "workspace", projectId: "project-123", pageId: PAGE_ID },
    });
  });

  it("archive succeeds on a 204 and prints the JSON envelope", async () => {
    writeConfig();
    process.argv = ["node", "plane"];
    const fetchMock = mockFetch((url, init) => {
      if (url.endsWith(`/pages/${PAGE_ID}/`)) return { body: pageFixture };
      if (url.endsWith("/archive/")) {
        expect(init?.method).toBe("POST");
        expect(init?.body).toBeUndefined(); // documented as bodyless
        return { status: 204 };
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await createPageCommand().parseAsync(["archive", PAGE_ID, "--json"], { from: "user" });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(log.mock.calls[0][0] as string)).toEqual({
      success: true,
      action: "page.archive",
      pageId: PAGE_ID,
      projectId: "project-123",
      workspace: "workspace",
    });
  });

  it("unarchive succeeds on a 204 and prints the JSON envelope", async () => {
    writeConfig();
    process.argv = ["node", "plane"];
    const fetchMock = mockFetch((url, init) => {
      if (url.endsWith(`/pages/${PAGE_ID}/`)) return { body: pageFixture };
      if (url.endsWith("/archive/")) {
        expect(init?.method).toBe("DELETE");
        return { status: 204 };
      }
      throw new Error(`Unexpected URL: ${url}`);
    });

    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await createPageCommand().parseAsync(["unarchive", PAGE_ID, "--json"], { from: "user" });

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(JSON.parse(log.mock.calls[0][0] as string)).toEqual({
      success: true,
      action: "page.unarchive",
      pageId: PAGE_ID,
      projectId: "project-123",
      workspace: "workspace",
    });
  });

  it("a 404 on the archive call wraps into the no-pages-API message", async () => {
    writeConfig();
    process.argv = ["node", "plane"];
    mockFetch((url) => {
      if (url.endsWith(`/pages/${PAGE_ID}/`)) return { body: pageFixture };
      if (url.endsWith("/archive/")) return { status: 404, body: { error: "Page not found." } };
      throw new Error(`Unexpected URL: ${url}`);
    });

    const { exitSpy, errorSpy } = spyExit();
    await createPageCommand().parseAsync(["archive", PAGE_ID], { from: "user" });

    expect(exitSpy).toHaveBeenCalledWith(3);
    expect(errorSpy.mock.calls[0][0]).toContain("may not support project pages");
  });
});

describe("page create commercial-correct body", () => {
  it("always sends description_html, defaulting to an empty paragraph", async () => {
    writeConfig();
    process.argv = ["node", "plane", "--dry-run"];
    // Non-interactive ask("Content", "") returns "" — no prompt, no error.
    mockFetch(() => {
      throw new Error("dry-run must not hit the network");
    });

    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await createPageCommand().parseAsync(["create", "Meeting Notes"], { from: "user" });

    const dryRun = JSON.parse(log.mock.calls[0][0] as string) as { body: unknown };
    expect(dryRun.body).toEqual({ name: "Meeting Notes", description_html: "<p></p>" });
  });

  it("wraps --content into description_html and passes --access through", async () => {
    writeConfig();
    process.argv = ["node", "plane", "--dry-run"];
    mockFetch(() => {
      throw new Error("dry-run must not hit the network");
    });

    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await createPageCommand().parseAsync(
      ["create", "Private Notes", "--content", "secret", "--access", "1"],
      { from: "user" },
    );

    const dryRun = JSON.parse(log.mock.calls[0][0] as string) as { body: unknown };
    expect(dryRun.body).toEqual({
      name: "Private Notes",
      description_html: "<p>secret</p>",
      access: 1,
    });
  });

  it("accepts the literal 0 for --access", async () => {
    writeConfig();
    process.argv = ["node", "plane", "--dry-run"];
    mockFetch(() => {
      throw new Error("dry-run must not hit the network");
    });

    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await createPageCommand().parseAsync(["create", "Public", "--access", "0"], { from: "user" });

    const dryRun = JSON.parse(log.mock.calls[0][0] as string) as { body: unknown };
    expect(dryRun.body).toEqual({ name: "Public", description_html: "<p></p>", access: 0 });
  });

  it("rejects an invalid --access before any network call", async () => {
    writeConfig();
    process.argv = ["node", "plane"];
    const fetchMock = mockFetch(() => {
      throw new Error("invalid --access must not hit the network");
    });

    const { exitSpy, errorSpy } = spyExit();
    await createPageCommand().parseAsync(["create", "Bad", "--access", "2"], { from: "user" });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(3);
    expect(errorSpy.mock.calls[0][0]).toContain("--access must be 0 (public) or 1 (private)");
  });
});

describe("page update / delete endpoint diagnostics", () => {
  it("a 404 on update identifies the method and missing page or endpoint", async () => {
    writeConfig();
    process.argv = ["node", "plane"];
    mockFetch((url) => {
      expect(url).toBe(
        `https://plane.example.test/api/v1/workspaces/workspace/projects/project-123/pages/${PAGE_ID}/`,
      );
      return { status: 404, body: { error: "Page not found." } };
    });

    const { exitSpy, errorSpy } = spyExit();
    await createPageCommand().parseAsync(["update", PAGE_ID, "--name", "New"], { from: "user" });

    expect(exitSpy).toHaveBeenCalledWith(3);
    const message = errorSpy.mock.calls[0][0] as string;
    expect(message).toContain("Page update failed (PUT");
    expect(message).toContain("HTTP 404");
    expect(message).toContain("page or project-pages endpoint was not found");
    expect(message).not.toContain("on any edition");
  });

  it("a 405 on explicit PATCH reports method rejection without trying PUT", async () => {
    writeConfig();
    process.argv = ["node", "plane"];
    const fetchMock = mockFetch(() => ({ status: 405, body: { error: "Method Not Allowed" } }));

    const { exitSpy, errorSpy } = spyExit();
    await createPageCommand().parseAsync(
      ["update", PAGE_ID, "--content", "x", "--method", "PATCH"],
      { from: "user" },
    );

    expect(exitSpy).toHaveBeenCalledWith(3);
    expect(errorSpy.mock.calls[0][0]).toContain("PATCH is not allowed by this endpoint");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("a 404 on delete identifies the failed operation and suggests archive", async () => {
    writeConfig();
    process.argv = ["node", "plane"];
    mockFetch(() => ({ status: 404, body: { error: "Page not found." } }));

    const { exitSpy, errorSpy } = spyExit();
    await createPageCommand().parseAsync(["delete", PAGE_ID], { from: "user" });

    expect(exitSpy).toHaveBeenCalledWith(3);
    const message = errorSpy.mock.calls[0][0] as string;
    expect(message).toContain("Page delete failed (DELETE");
    expect(message).toContain("plane page archive");
  });

  it("non-404/405 errors propagate untouched", async () => {
    writeConfig();
    process.argv = ["node", "plane"];
    mockFetch(() => ({ status: 403, body: { error: "forbidden" } }));

    const { exitSpy, errorSpy } = spyExit();
    await createPageCommand().parseAsync(["delete", PAGE_ID], { from: "user" });

    expect(exitSpy).toHaveBeenCalledWith(2);
    const message = errorSpy.mock.calls[0][0] as string;
    expect(message).toContain("API error 403");
    expect(message).not.toContain("not exposed by Plane's public API");
  });
});
