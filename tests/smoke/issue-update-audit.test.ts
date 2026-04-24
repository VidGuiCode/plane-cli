import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_PATH = path.resolve(__dirname, "../../dist/cli.js");

// Silent-drop audit for `plane issue update` flags.
// Companion to due-date-roundtrip and label-roundtrip: the same class of bug
// (v0.3.1 `label_ids` → `labels`, v0.3.2 `due_date` → `target_date`) could
// easily hide in any flag whose request-body key doesn't match what the Plane
// API actually accepts. This test round-trips each update flag and asserts
// the persisted value matches the requested one. Any silent drop shows up as
// a failing assertion.
//
// Gated on PLANE_CLI_LIVE_TESTS=1 + PLANE_TEST_PROJECT. Optional env vars:
//   PLANE_TEST_STATE     — state name to test --state transition (required for --state subtest)
//   PLANE_TEST_PARENT    — identifier of an issue to use as parent (required for --parent subtest)
// Subtests that need an optional env var skip themselves if it's missing.

const LIVE = process.env.PLANE_CLI_LIVE_TESTS === "1";
const PROJECT = process.env.PLANE_TEST_PROJECT;
const STATE = process.env.PLANE_TEST_STATE;
const PARENT = process.env.PLANE_TEST_PARENT;

const describeLive = LIVE && PROJECT ? describe : describe.skip;

function runCli(args: string[]): string {
  return execFileSync("node", [CLI_PATH, ...args], { encoding: "utf-8" });
}

describeLive("issue update silent-drop audit (live)", () => {
  it("--priority round-trips", { timeout: 60000 }, () => {
    const title = `audit-priority-${Date.now()}`;
    const created = JSON.parse(
      runCli(["issue", "create", "--project", PROJECT!, "--title", title, "--json"]),
    ) as { id: string };
    try {
      const updated = JSON.parse(
        runCli([
          "issue",
          "update",
          created.id,
          "--project",
          PROJECT!,
          "--priority",
          "high",
          "--json",
        ]),
      ) as { priority: string };
      expect(updated.priority).toBe("high");
    } finally {
      runCli(["issue", "delete", created.id, "--project", PROJECT!]);
    }
  });

  it("--description round-trips", { timeout: 60000 }, () => {
    const title = `audit-description-${Date.now()}`;
    const created = JSON.parse(
      runCli(["issue", "create", "--project", PROJECT!, "--title", title, "--json"]),
    ) as { id: string };
    try {
      const updated = JSON.parse(
        runCli([
          "issue",
          "update",
          created.id,
          "--project",
          PROJECT!,
          "--description",
          "audit description set by test",
          "--json",
        ]),
      ) as { description_html?: string; description_stripped?: string; description?: string };
      const desc =
        updated.description ??
        updated.description_stripped ??
        updated.description_html ??
        "";
      expect(desc).toContain("audit description set by test");
    } finally {
      runCli(["issue", "delete", created.id, "--project", PROJECT!]);
    }
  });

  it("--assignee me round-trips", { timeout: 60000 }, () => {
    const title = `audit-assignee-${Date.now()}`;
    const created = JSON.parse(
      runCli(["issue", "create", "--project", PROJECT!, "--title", title, "--json"]),
    ) as { id: string };
    try {
      const updated = JSON.parse(
        runCli([
          "issue",
          "update",
          created.id,
          "--project",
          PROJECT!,
          "--assignee",
          "me",
          "--json",
        ]),
      ) as { assignees?: string[] };
      expect(Array.isArray(updated.assignees)).toBe(true);
      expect((updated.assignees ?? []).length).toBeGreaterThan(0);
    } finally {
      runCli(["issue", "delete", created.id, "--project", PROJECT!]);
    }
  });

  (STATE ? it : it.skip)("--state round-trips (requires PLANE_TEST_STATE)", { timeout: 60000 }, () => {
    const title = `audit-state-${Date.now()}`;
    const created = JSON.parse(
      runCli(["issue", "create", "--project", PROJECT!, "--title", title, "--json"]),
    ) as { id: string };
    try {
      const updated = JSON.parse(
        runCli([
          "issue",
          "update",
          created.id,
          "--project",
          PROJECT!,
          "--state",
          STATE!,
          "--json",
        ]),
      ) as { state?: string; state_name?: string };
      const stateValue = updated.state_name ?? updated.state ?? "";
      expect(stateValue.toLowerCase()).toBe(STATE!.toLowerCase());
    } finally {
      runCli(["issue", "delete", created.id, "--project", PROJECT!]);
    }
  });

  (PARENT ? it : it.skip)("--parent round-trips (requires PLANE_TEST_PARENT)", { timeout: 60000 }, () => {
    const title = `audit-parent-${Date.now()}`;
    const created = JSON.parse(
      runCli(["issue", "create", "--project", PROJECT!, "--title", title, "--json"]),
    ) as { id: string };
    try {
      const updated = JSON.parse(
        runCli([
          "issue",
          "update",
          created.id,
          "--project",
          PROJECT!,
          "--parent",
          PARENT!,
          "--json",
        ]),
      ) as { parent?: string | null };
      expect(updated.parent).toBeTruthy();
    } finally {
      runCli(["issue", "delete", created.id, "--project", PROJECT!]);
    }
  });
});
