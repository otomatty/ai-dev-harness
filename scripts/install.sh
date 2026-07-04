#!/usr/bin/env bash
set -euo pipefail

# Install ai-dev-harness into the current or given project without git clone.
# Usage: curl -fsSL .../install.sh | bash -s -- [agent] [targetDir] [--ref REF] [--repo REPO] [--force]

DEFAULT_REPO="otomatty/ai-dev-harness"
DEFAULT_REF="main"

usage() {
  cat <<'EOF' >&2
Usage: install.sh [agent] [targetDir] [--ref REF] [--repo REPO] [--force]

Agents: claude, cursor, agents-md
EOF
  exit 1
}

AGENT="${1:-claude}"
shift || true

TARGET=""
REF="$DEFAULT_REF"
REPO="$DEFAULT_REPO"
FORCE=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --ref)
      REF="${2:-}"
      [[ -n "$REF" ]] || usage
      shift 2
      ;;
    --repo)
      REPO="${2:-}"
      [[ -n "$REPO" ]] || usage
      shift 2
      ;;
    --force)
      FORCE=1
      shift
      ;;
    -h|--help)
      usage
      ;;
    *)
      if [[ -z "$TARGET" ]]; then
        TARGET="$1"
      else
        echo "Unknown argument: $1" >&2
        usage
      fi
      shift
      ;;
  esac
done

TARGET="${TARGET:-.}"

run_bun() {
  local -a args=("$AGENT")
  [[ "$TARGET" != "." ]] && args+=("$TARGET")
  [[ "$REF" != "$DEFAULT_REF" ]] && args+=(--ref "$REF")
  [[ "$REPO" != "$DEFAULT_REPO" ]] && args+=(--repo "$REPO")
  [[ "$FORCE" -eq 1 ]] && args+=(--force)
  exec bun x "github:${REPO}" "${args[@]}"
}

dist_source() {
  case "$1" in
    claude) echo "dist/claude/.claude" ;;
    cursor) echo "dist/cursor/.cursor" ;;
    agents-md) echo "dist/agents-md/AGENTS.md" ;;
    *) echo "Unknown agent: $1" >&2; exit 1 ;;
  esac
}

dest_path() {
  case "$1" in
    claude) echo "${TARGET}/.claude" ;;
    cursor) echo "${TARGET}/.cursor" ;;
    agents-md) echo "${TARGET}/AGENTS.md" ;;
    *) echo "Unknown agent: $1" >&2; exit 1 ;;
  esac
}

run_tarball() {
  for cmd in curl tar; do
    command -v "$cmd" >/dev/null 2>&1 || {
      echo "Install requires bun, or curl+tar on PATH." >&2
      exit 1
    }
  done

  local tmpdir src dest root
  tmpdir="$(mktemp -d)"
  trap 'rm -rf "$tmpdir"' EXIT

  curl -fsSL "https://codeload.github.com/${REPO}/tar.gz/${REF}" -o "$tmpdir/archive.tar.gz"
  mkdir -p "$tmpdir/extract"
  tar -xzf "$tmpdir/archive.tar.gz" -C "$tmpdir/extract"

  root="$(find "$tmpdir/extract" -mindepth 1 -maxdepth 1 -type d | head -n 1)"
  if [[ -z "$root" ]]; then
    echo "Unexpected tarball layout under $tmpdir/extract" >&2
    exit 1
  fi

  src="${root}/$(dist_source "$AGENT")"
  dest="$(dest_path "$AGENT")"

  if [[ ! -e "$src" ]]; then
    echo "Distribution missing in ${REPO}@${REF}: $(dist_source "$AGENT")" >&2
    exit 1
  fi

  if [[ -e "$dest" && "$FORCE" -ne 1 ]]; then
    echo "$dest already exists. Re-run with --force to overwrite." >&2
    exit 1
  fi

  if [[ -e "$dest" && "$FORCE" -eq 1 ]]; then
    rm -rf "$dest"
  fi

  mkdir -p "$(dirname "$dest")"
  if [[ -d "$src" ]]; then
    cp -R "$src" "$dest"
  else
    cp "$src" "$dest"
  fi

  echo "✅ Installed $AGENT harness (remote) → $dest"
}

if command -v bun >/dev/null 2>&1; then
  run_bun
fi

run_tarball
