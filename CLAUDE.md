# Working on Plane CLI

Read the [contributor guide](CONTRIBUTING.md) for setup and verification. The [architecture guide](docs/architecture.md) explains command registration, context resolution, and API compatibility. The [roadmap](docs/roadmap.md) and [changelog](CHANGELOG.md) cover plans and release history.

## Local checkout guidance

Read `context/docs/briefs/agent.md` before editing code when it is available. Check `context/docs/project/current-state.md` for the local project summary.

Follow `AGENTS.md` and `skills/capture-user-report/SKILL.md` when present. Capture reports verbatim in `context/research/user-reports/` before triage.

For an authorized release, follow `skills/release-plane-cli/SKILL.md` if present. The [release workflow](.github/workflows/release.yml) builds, validates, and uploads the npm tarball when a version tag is pushed. Installation uses that GitHub release asset.
