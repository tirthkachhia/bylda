#!/usr/bin/env bash
# lint-changed.sh — ESLint only the .ts/.tsx files this branch changed.
#
# `bun run lint` (eslint .) reports ~208 pre-existing errors, most of them
# Prettier formatting inside supabase/functions/** and workers/** — backend
# paths nobody on this rebuild may touch. That makes the repo-wide signal
# useless for a lane. This script gives a signal about your own code.
#
# Usage:
#   scripts/lint-changed.sh              # vs origin/integration
#   scripts/lint-changed.sh <base-ref>
#   LINT_BASE=main scripts/lint-changed.sh

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

BASE="${1:-${LINT_BASE:-origin/integration}}"

if ! git rev-parse --verify --quiet "$BASE" >/dev/null; then
  for FALLBACK in origin/integration integration origin/main main; do
    if git rev-parse --verify --quiet "$FALLBACK" >/dev/null; then
      echo "lint-changed: '$BASE' not found, using '$FALLBACK'" >&2
      BASE="$FALLBACK"
      break
    fi
  done
fi

if ! git rev-parse --verify --quiet "$BASE" >/dev/null; then
  echo "lint-changed: no usable base ref. Run 'git fetch origin' first." >&2
  exit 2
fi

MERGE_BASE="$(git merge-base "$BASE" HEAD 2>/dev/null || echo "$BASE")"

mapfile -t FILES < <(
  {
    git diff --name-only --diff-filter=ACMR "$MERGE_BASE"...HEAD
    git diff --name-only --diff-filter=ACMR HEAD
    git diff --name-only --diff-filter=ACMR --cached
    git ls-files --others --exclude-standard
  } \
  | grep -E '\.(ts|tsx)$' \
  | grep -vE '^(supabase|workers|n8n|N8N)/' \
  | grep -vE '^src/routeTree\.gen\.ts$' \
  | sort -u \
  | while IFS= read -r f; do [[ -f "$f" ]] && printf '%s\n' "$f"; done
)

# Raw-colour gate first (whole tree, ratcheting baseline — cheap and total).
node scripts/tokens-check.mjs

if [[ ${#FILES[@]} -eq 0 ]]; then
  echo "lint-changed: no changed .ts/.tsx files vs $BASE — nothing to lint."
  exit 0
fi

echo "lint-changed: ${#FILES[@]} changed file(s) vs $BASE"
npx eslint --max-warnings=0 "${FILES[@]}"
