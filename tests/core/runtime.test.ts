import { afterEach, describe, expect, it, vi } from "vitest";
import { isDryRunEnabled, isNonInteractiveMode } from "../../src/core/runtime.js";

const originalArgv = [...process.argv];
const stdinDescriptor = Object.getOwnPropertyDescriptor(process.stdin, "isTTY");
const stdoutDescriptor = Object.getOwnPropertyDescriptor(process.stdout, "isTTY");

afterEach(() => {
  process.argv = [...originalArgv];
  if (stdinDescriptor) Object.defineProperty(process.stdin, "isTTY", stdinDescriptor);
  if (stdoutDescriptor) Object.defineProperty(process.stdout, "isTTY", stdoutDescriptor);
  vi.restoreAllMocks();
});

describe("runtime flags", () => {
  it("detects dry-run from argv", () => {
    process.argv = [...originalArgv, "--dry-run"];
    expect(isDryRunEnabled()).toBe(true);
  });

  it("detects non-interactive flag from argv", () => {
    process.argv = [...originalArgv, "--no-interactive"];
    expect(isNonInteractiveMode()).toBe(true);
  });

  it("detects non-tty mode", () => {
    process.argv = [...originalArgv];
    Object.defineProperty(process.stdin, "isTTY", { value: false, configurable: true });
    Object.defineProperty(process.stdout, "isTTY", { value: false, configurable: true });
    expect(isNonInteractiveMode()).toBe(true);
  });
});
