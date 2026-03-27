# Contributing

Thanks for contributing to `plane-cli`.

Bun is used for local development. Node.js 20+ is required for users installing the CLI — Bun is only needed if you are working on the source.

## Principles

- Keep the CLI API-driven
- Avoid Plane-server-specific assumptions
- Prefer stable command verbs over ad hoc flags
- Keep human-readable output clean and add machine-readable output deliberately

## Development

```bash
bun install
bun run typecheck
bun run build
bun test
```

## Project Boundaries

- Commands live in `src/commands/`
- Shared logic belongs in `src/core/`
- Avoid coupling command handlers directly to HTTP details
- Keep auth/context behavior reusable across command groups
