#!/usr/bin/env bash
# Post-pack verification: install the .tgz into a temp directory and smoke test it.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"

cd "$PROJECT_DIR"

echo "=== Packing ==="
TARBALL=$(npm pack 2>/dev/null | tail -1)
echo "  Packed: $TARBALL"

# Create a temp directory and clean it up on exit
TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR" "$PROJECT_DIR/$TARBALL"' EXIT

echo ""
echo "=== Installing into temp directory ==="
cd "$TMPDIR"
npm init -y > /dev/null 2>&1
npm install "$PROJECT_DIR/$TARBALL" > /dev/null 2>&1
echo "  Installed successfully"

# Resolve the binary path
PLANE="$TMPDIR/node_modules/.bin/plane"

echo ""
echo "=== Smoke tests ==="

# Test: --version
VERSION=$("$PLANE" --version 2>&1)
echo "  version: $VERSION"

# Test: --help
HELP=$("$PLANE" --help 2>&1)
echo "$HELP" | grep -q "Commands" && echo "  help: OK" || { echo "  help: FAIL"; exit 1; }

# Test: key subcommands exist in help
for cmd in issue cycle module workspace project profile discover; do
  echo "$HELP" | grep -q "$cmd" && echo "  $cmd: OK" || { echo "  $cmd: FAIL"; exit 1; }
done

# Test: issue subcommands
ISSUE_HELP=$("$PLANE" issue --help 2>&1)
for sub in list get create update delete close reopen open mine; do
  echo "$ISSUE_HELP" | grep -q "$sub" && echo "  issue $sub: OK" || { echo "  issue $sub: FAIL"; exit 1; }
done

# Test: cycle subcommands
CYCLE_HELP=$("$PLANE" cycle --help 2>&1)
for sub in list issues current create delete; do
  echo "$CYCLE_HELP" | grep -q "$sub" && echo "  cycle $sub: OK" || { echo "  cycle $sub: FAIL"; exit 1; }
done

echo ""
echo "All smoke tests passed."
