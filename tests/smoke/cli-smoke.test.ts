import { describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CLI_PATH = path.resolve(__dirname, "../../dist/cli.js");

describe("CLI smoke tests", () => {
  it("shows version", () => {
    const output = execSync(`node "${CLI_PATH}" --version`, { encoding: "utf-8" });
    expect(output.trim()).toBe("0.2.6");
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
