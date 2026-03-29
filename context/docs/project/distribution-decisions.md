# Distribution & Tooling Decisions

## Date
2026-03-27

## Summary

This captures decisions made about how plane-cli will be built and distributed.

## Distribution

- Will **not** be published to the npm registry
- Distributed via **GitHub Releases** as an npm tarball (`.tgz`)
- Users install from the release asset URL:
  ```bash
  npm install -g https://github.com/VidGuiCode/plane-cli/releases/download/v0.1.6/plane-cli-0.1.6.tgz
  ```
- Works on Windows (PowerShell), Linux, Mac — any terminal with Node.js installed

**Why not `github:VidGuiCode/plane-cli`?**
npm creates a Windows directory junction pointing to a temp git-clone directory for git-based installs. That temp directory gets cleaned up after install, leaving a broken junction and a `Cannot find module dist/cli.js` error. This is an npm 7+ behavior on Windows that cannot be fixed in the package itself. Installing from an HTTPS tarball bypasses the git clone path entirely — npm unpacks it as a real directory.

**Release process:** for each new version, run `npm pack` to produce `plane-cli-{version}.tgz`, then `gh release create v{version} plane-cli-{version}.tgz`. The `plane upgrade` command installs from the GitHub release tarball URL automatically.

## Tooling Split

**Bun for development:**
- Run TypeScript natively (no `tsx` needed)
- Faster installs and script execution
- `bun run src/cli.ts` for local dev
- `bun test` as an option (or keep vitest, both work)

**tsc for the release build:**
- Already in the project
- `dist/` is committed to the repo and included in the release tarball — no build step required during install
- No Bun required on the end user's machine
- Bun is invisible to end users

## Why Not Standalone Binaries

Standalone binaries (`.exe`, Linux binary, Mac binary) via `bun build --compile` were considered but rejected:
- Users would have to manually download the right file and add it to PATH
- More friction than a single install command
- Adds CI complexity (build matrix for 3 platforms)
- Overkill for a GitHub-hosted developer tool

## Why Not All-Bun

`bun install -g github:...` would require Bun on the user's machine. The goal is that any developer with Node.js can install and use plane-cli without knowing about Bun.
