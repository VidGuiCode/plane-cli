import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_PATH = path.resolve(__dirname, "../../dist/cli.js");

// Round-trip regression test for the v0.3.0 silent --label drop bug.
// The bug: `plane issue create --label X` accepted the flag, resolved the name to a
// UUID, but sent `label_ids` in the request body, which Plane's API silently ignores.
// This test creates an issue with --label, re-fetches it via --json, and asserts the
// labels array is non-empty. It must be run against a live workspace, so it is gated
// on PLANE_CLI_LIVE_TESTS=1 plus PLANE_TEST_PROJECT / PLANE_TEST_LABEL env vars.

const LIVE = process.env.PLANE_CLI_LIVE_TESTS === "1";
const PROJECT = process.env.PLANE_TEST_PROJECT;
const LABEL = process.env.PLANE_TEST_LABEL;

const describeLive = LIVE && PROJECT && LABEL ? describe : describe.skip;

function runCli(args: string[]): string {
  return execFileSync("node", [CLI_PATH, ...args], { encoding: "utf-8" });
}

describeLive("label round-trip (live)", () => {
  it("attaches a label via --label and reads it back", () => {
    const title = `label-roundtrip-${Date.now()}`;
    const createOut = runCli([
      "issue",
      "create",
      "--project",
      PROJECT!,
      "--title",
      title,
      "--label",
      LABEL!,
      "--json",
    ]);
    const created = JSON.parse(createOut) as { id: string; labels: string[] };
    try {
      expect(Array.isArray(created.labels)).toBe(true);
      expect(created.labels.length).toBeGreaterThan(0);
    } finally {
      runCli(["issue", "delete", created.id, "--project", PROJECT!]);
    }
  });
});
