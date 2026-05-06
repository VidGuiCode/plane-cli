import { mkdirSync, mkdtempSync, rmSync, unlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const isWindows = process.platform === "win32";
const npm = isWindows ? "npm.cmd" : "npm";

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: options.cwd ?? root,
    encoding: "utf-8",
    shell: isWindows,
    stdio: options.capture ? "pipe" : "inherit",
  });
  if (result.status !== 0) {
    const reason = result.error ? `: ${result.error.message}` : "";
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}${reason}`);
  }
  return result.stdout?.trim() ?? "";
}

function assertIncludes(value, expected, label) {
  if (!value.includes(expected)) {
    throw new Error(`${label}: expected output to include "${expected}"`);
  }
  console.log(`  ${label}: OK`);
}

console.log("=== Packing ===");
const packOutput = run(npm, ["pack", "--silent"], { capture: true });
const tarball = packOutput.split(/\r?\n/).filter(Boolean).at(-1);
if (!tarball) {
  throw new Error("npm pack did not report a tarball name");
}
const tarballPath = path.join(root, tarball);
console.log(`  Packed: ${tarball}`);

const tmpBase = process.env.PLANE_CLI_PACK_TMP
  ? path.resolve(process.env.PLANE_CLI_PACK_TMP)
  : path.join(root, ".pack-smoke");
mkdirSync(tmpBase, { recursive: true });

const dir = mkdtempSync(path.join(tmpBase, "plane-cli-pack-"));
try {
  console.log("");
  console.log("=== Installing into temp directory ===");
  run(npm, ["init", "-y"], { cwd: dir, capture: true });
  run(npm, ["install", tarballPath], { cwd: dir });
  console.log("  Installed successfully");

  const plane = path.join(dir, "node_modules", ".bin", isWindows ? "plane.cmd" : "plane");

  console.log("");
  console.log("=== Smoke tests ===");

  const version = run(plane, ["--version"], { cwd: dir, capture: true });
  console.log(`  version: ${version}`);

  const help = run(plane, ["--help"], { cwd: dir, capture: true });
  assertIncludes(help, "Commands", "help");
  for (const cmd of ["issue", "cycle", "module", "workspace", "project", "profile", "discover"]) {
    assertIncludes(help, cmd, cmd);
  }

  const issueHelp = run(plane, ["issue", "--help"], { cwd: dir, capture: true });
  for (const sub of ["list", "get", "create", "update", "delete", "close", "reopen", "open", "mine"]) {
    assertIncludes(issueHelp, sub, `issue ${sub}`);
  }

  const cycleHelp = run(plane, ["cycle", "--help"], { cwd: dir, capture: true });
  for (const sub of ["list", "issues", "current", "create", "ensure", "add", "delete"]) {
    assertIncludes(cycleHelp, sub, `cycle ${sub}`);
  }

  const moduleHelp = run(plane, ["module", "--help"], { cwd: dir, capture: true });
  for (const sub of ["list", "issues", "create", "ensure", "add", "delete"]) {
    assertIncludes(moduleHelp, sub, `module ${sub}`);
  }

  const pageHelp = run(plane, ["page", "--help"], { cwd: dir, capture: true });
  for (const sub of ["list", "get", "search", "create", "update", "delete"]) {
    assertIncludes(pageHelp, sub, `page ${sub}`);
  }

  console.log("");
  console.log("All smoke tests passed.");
} finally {
  rmSync(dir, { recursive: true, force: true });
  try {
    unlinkSync(tarballPath);
  } catch {
    // Ignore cleanup failures; the tarball is gitignored.
  }
}
