# Contributing to Plane CLI

[Documentation](docs/README.md) · [Architecture](docs/architecture.md) · [Roadmap](docs/roadmap.md)

## Develop locally

Use Node.js 20 or later. Install dependencies with npm and run the compiled CLI from the checkout.

```bash
npm ci
npm run build
node dist/cli.js --help
```

If you use Bun, `bun install` installs dependencies and `bun run dev --help` runs the CLI directly from TypeScript. Use `bun run test` to run the repository's Vitest script.

## Verify changes

Run the CI checks from the repository root.

```bash
npm run typecheck
npm run lint
npm run format:check
npm run build
npm test
```

The build refreshes `dist/cli.js` before the CLI smoke tests use it. Test suites under `tests/core/` exercise shared utilities, `tests/commands/` cover command behavior, and `tests/smoke/` cover the compiled entry point and opt-in live checks. Live tests create or modify issues. They require `PLANE_CLI_LIVE_TESTS=1` and a dedicated `PLANE_TEST_PROJECT`. See the individual tests for additional variables.

## Work on commands

- Keep command registration and orchestration in `src/commands/` and reusable behavior in `src/core/`.
- Use the Plane public API and account for the supported issue endpoint styles.
- Preserve existing command syntax and machine-readable output when adding options.
- Update command help and the relevant guide when behavior changes. Record user-facing changes in the changelog.
