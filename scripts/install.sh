#!/usr/bin/env bash
set -euo pipefail

# Install ai-dev-harness into the current or given project without git clone.
# Usage: curl -fsSL .../install.sh | bash -s -- [agent] [targetDir] [--force]

AGENT="${1:-claude}"
shift || true

if command -v bun >/dev/null 2>&1; then
  exec bun x "github:otomatty/ai-dev-harness" "$AGENT" "$@"
fi

if command -v npx >/dev/null 2>&1; then
  exec npx --yes "github:otomatty/ai-dev-harness" "$AGENT" "$@"
fi

echo "Install requires bun or npx (Node.js)." >&2
exit 1
