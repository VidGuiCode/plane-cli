import { describe, expect, it } from "vitest";
import { execSync, spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_PATH = path.resolve(__dirname, "../../dist/cli.js");
const PKG_PATH = path.resolve(__dirname, "../../package.json");
const expectedVersion = (JSON.parse(readFileSync(PKG_PATH, "utf-8")) as { version: string })
  .version;

describe("CLI smoke tests", () => {
  it("reports the command name in structured errors without including argument values", () => {
    const result = spawnSync(
      process.execPath,
      [
        CLI_PATH,
        "issue",
        "create",
        "--description",
        "private-input",
        "--description-html",
        "",
        "--json",
      ],
      { encoding: "utf-8" },
    );
    expect(result.status).toBe(3);
    expect(result.stdout).toBe("");
    expect(result.stderr).not.toContain("private-input");
    expect(JSON.parse(result.stderr)).toMatchObject({
      status: "error",
      code: "ValidationError",
      command: "plane issue create",
      retryable: false,
      suggestedFix: expect.any(String),
    });
  });

  it("shows the version from package.json", () => {
    const output = execSync(`node "${CLI_PATH}" --version`, { encoding: "utf-8" });
    expect(output.trim()).toBe(expectedVersion);
  });

  it("shows help", () => {
    const output = execSync(`node "${CLI_PATH}" --help`, { encoding: "utf-8" });
    expect(output).toContain("plane");
    expect(output).toContain("Commands");
  });

  it("lists all top-level commands", () => {
    const output = execSync(`node "${CLI_PATH}" --help`, { encoding: "utf-8" });
    const commands = [
      "login",
      "logout",
      "completion",
      "account",
      "where",
      "workspace",
      "project",
      "members",
      "issue",
      "module",
      "label",
      "comment",
      "cycle",
      "page",
      "state",
      "profile",
      "discover",
      "upgrade",
    ];
    for (const cmd of commands) {
      expect(output).toContain(cmd);
    }
  });
});
