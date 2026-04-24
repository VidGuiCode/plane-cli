import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_PATH = path.resolve(__dirname, "../../dist/cli.js");

// Round-trip regression test for the v0.3.1 silent --due drop bug.
// The bug: `plane issue update --due <YYYY-MM-DD>` accepted the flag and
// reported success, but sent `due_date` in the request body. Plane's API
// expects `target_date` and silently ignored the wrong key, leaving the
// due date unset despite the CLI exiting zero.
// This test creates an issue with --due, fetches it via `issue get --json`
// (which runs the normalizer), and asserts both the raw `target_date`
// passthrough and the normalized `dueDate` alias match. Then updates the
// same way. Then clears via `--due none`. Gated on PLANE_CLI_LIVE_TESTS=1
// plus PLANE_TEST_PROJECT.

const LIVE = process.env.PLANE_CLI_LIVE_TESTS === "1";
const PROJECT = process.env.PLANE_TEST_PROJECT;

const describeLive = LIVE && PROJECT ? describe : describe.skip;

function runCli(args: string[]): string {
  return execFileSync("node", [CLI_PATH, ...args], { encoding: "utf-8" });
}

function fetchIssue(id: string): { target_date: string | null; dueDate: string | null } {
  return JSON.parse(runCli(["issue", "get", id, "--project", PROJECT!, "--json"])) as {
    target_date: string | null;
    dueDate: string | null;
  };
}

describeLive("due date round-trip (live)", () => {
  it("sets, updates, and clears --due on issue create / update", { timeout: 60000 }, () => {
    const title = `due-roundtrip-${Date.now()}`;
    const createOut = runCli([
      "issue",
      "create",
      "--project",
      PROJECT!,
      "--title",
      title,
      "--due",
      "2030-01-01",
      "--json",
    ]);
    const created = JSON.parse(createOut) as { id: string; target_date: string | null };
    try {
      // Raw POST response: target_date should persist (this is the bug surface).
      expect(created.target_date).toBe("2030-01-01");

      // Re-fetch via `issue get` so the normalizer runs and populates `dueDate`.
      const fetched = fetchIssue(created.id);
      expect(fetched.target_date).toBe("2030-01-01");
      expect(fetched.dueDate).toBe("2030-01-01");

      // Update.
      const updateOut = runCli([
        "issue",
        "update",
        created.id,
        "--project",
        PROJECT!,
        "--due",
        "2030-02-02",
        "--json",
      ]);
      const updated = JSON.parse(updateOut) as { target_date: string | null };
      expect(updated.target_date).toBe("2030-02-02");
      const fetchedAfterUpdate = fetchIssue(created.id);
      expect(fetchedAfterUpdate.target_date).toBe("2030-02-02");
      expect(fetchedAfterUpdate.dueDate).toBe("2030-02-02");

      // Clear with --due none.
      runCli([
        "issue",
        "update",
        created.id,
        "--project",
        PROJECT!,
        "--due",
        "none",
        "--json",
      ]);
      const fetchedAfterClear = fetchIssue(created.id);
      expect(fetchedAfterClear.target_date).toBeNull();
      expect(fetchedAfterClear.dueDate).toBeNull();
    } finally {
      runCli(["issue", "delete", created.id, "--project", PROJECT!]);
    }
  });
});
