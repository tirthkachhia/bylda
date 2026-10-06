#!/usr/bin/env bash
# boundary-check.sh — fail if a change touches a read-only backend path.
#
# Patterns come from the fenced ```boundary-patterns block in BACKEND_BOUNDARY.md,
# so that file is the single source of truth. .github/workflows/backend-guard.yml
# runs this same script in CI.
#
# Usage:
#   scripts/boundary-check.sh                 # working tree + commits vs origin/integration
#   BOUNDARY_HEAD_REF=lane-2-mayur scripts/boundary-check.sh   # pretend to be that branch
#   scripts/boundary-check.sh <base-ref>      # vs an explicit base
#   BOUNDARY_BASE=main scripts/boundary-check.sh
#
# Exit 0 clean, 1 violation, 2 setup problem.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$REPO_ROOT"

BOUNDARY_FILE="BACKEND_BOUNDARY.md"
BASE="${1:-${BOUNDARY_BASE:-origin/integration}}"

# ── Backend track exemption ───────────────────────────────────────────────────
# Tirth's backend work lives on `backend/*` branches (CLAUDE.md §12 D). Those are
# the ONLY branches allowed to touch boundary paths, so the local check skips
# them. In CI the exemption additionally needs the `backend` PR label — that
# decision is made by scripts/backend-pr-gate.sh, which sets BOUNDARY_FORCE=1 to
# switch this exemption off for an unlabelled backend/* PR.
#   Head branch: BOUNDARY_HEAD_REF > GITHUB_HEAD_REF > current local branch.
HEAD_REF="${BOUNDARY_HEAD_REF:-${GITHUB_HEAD_REF:-$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo)}}"
if [[ "${BOUNDARY_FORCE:-0}" != "1" && "$HEAD_REF" == backend/* ]]; then
  echo "boundary: '$HEAD_REF' is a backend/* branch — boundary paths allowed, check skipped."
  echo "boundary: (CI still requires the 'backend' PR label — see scripts/backend-pr-gate.sh)"
  exit 0
fi

if [[ ! -f "$BOUNDARY_FILE" ]]; then
  echo "boundary: cannot find $BOUNDARY_FILE at repo root" >&2
  exit 2
fi

# ── Parse patterns out of the fenced block ────────────────────────────────────
mapfile -t PATTERNS < <(
  awk '
    /^```boundary-patterns[[:space:]]*$/ { inblock = 1; next }
    inblock && /^```[[:space:]]*$/       { inblock = 0; next }
    inblock                              { print }
  ' "$BOUNDARY_FILE" \
  | sed -e 's/[[:space:]]*#.*$//' -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//' \
  | grep -v '^$' || true
)

if [[ ${#PATTERNS[@]} -eq 0 ]]; then
  echo "boundary: no patterns found in the boundary-patterns block of $BOUNDARY_FILE" >&2
  echo "boundary: refusing to pass — a guard with no patterns guards nothing." >&2
  exit 2
fi

# ── Glob → anchored regex ─────────────────────────────────────────────────────
# Paths are repo-root-relative. Semantics:
#   **/   → any number of leading directories   (**/.env  → .env, a/.env, a/b/.env)
#   **    → anything, crossing /                (supabase/** → supabase/a/b.sql)
#   *     → anything except /                   (.env.*  → .env.production)
#   ?     → one character except /
# Anything else is matched literally. Patterns are root-anchored: use **/ to
# match at any depth.
glob_to_regex() {
  local p="$1"
  local out="" i=0 ch
  local n=${#p}
  while (( i < n )); do
    ch="${p:i:1}"
    if [[ "$ch" == '*' ]]; then
      if [[ "${p:i:3}" == '**/' ]]; then out+='(.*/)?'; (( i += 3 )); continue
      elif [[ "${p:i:2}" == '**' ]]; then out+='.*';     (( i += 2 )); continue
      else                                out+='[^/]*'; (( i += 1 )); continue
      fi
    fi
    case "$ch" in
      '?')                                   out+='[^/]' ;;
      '.'|'+'|'('|')'|'['|']'|'{'|'}'|'^'|'$'|'|'|'\\')
                                             out+="\\$ch" ;;
      *)                                     out+="$ch" ;;
    esac
    (( i += 1 ))
  done
  printf '^%s$' "$out"
}

# Self-test: if the matcher is broken, fail loudly rather than pass everything.
_selftest() {
  local re
  re="$(glob_to_regex 'supabase/**')"
  [[ "supabase/migrations/x.sql" =~ $re ]] || return 1
  [[ "src/routes/index.tsx"      =~ $re ]] && return 1
  re="$(glob_to_regex '**/.env.*')"
  [[ "apps/web/.env.production"  =~ $re ]] || return 1
  re="$(glob_to_regex 'spec_schema.ts')"
  [[ "spec_schema.ts"            =~ $re ]] || return 1
  [[ "src/spec_schemaXts"        =~ $re ]] && return 1
  return 0
}
if ! _selftest; then
  echo "boundary: glob matcher self-test FAILED — refusing to report a clean result." >&2
  exit 2
fi

# ── Resolve the base ref ──────────────────────────────────────────────────────
if ! git rev-parse --verify --quiet "$BASE" >/dev/null; then
  for FALLBACK in origin/integration integration origin/main main; do
    if git rev-parse --verify --quiet "$FALLBACK" >/dev/null; then
      echo "boundary: '$BASE' not found, comparing against '$FALLBACK' instead" >&2
      BASE="$FALLBACK"
      break
    fi
  done
fi

if ! git rev-parse --verify --quiet "$BASE" >/dev/null; then
  echo "boundary: no usable base ref (tried '$BASE' and the usual fallbacks)." >&2
  echo "boundary: run 'git fetch origin' first." >&2
  exit 2
fi

MERGE_BASE="$(git merge-base "$BASE" HEAD 2>/dev/null || echo "$BASE")"

# ── Collect changed files: commits since the merge base, plus uncommitted work ─
# --no-renames: with rename detection on, `git mv supabase/x src/x` reports only
# the new path and would slip past the guard. Report both sides.
CHANGED_FILE="$(mktemp)"
VIOL_FILE="$(mktemp)"
trap 'rm -f "$CHANGED_FILE" "$VIOL_FILE"' EXIT

{
  git diff --no-renames --name-only --diff-filter=ACMRD "$MERGE_BASE"...HEAD
  git diff --no-renames --name-only --diff-filter=ACMRD HEAD
  git diff --no-renames --name-only --diff-filter=ACMRD --cached
  git ls-files --others --exclude-standard
} | sed '/^$/d' | sort -u > "$CHANGED_FILE"

CHANGED_COUNT="$(wc -l < "$CHANGED_FILE" | tr -d ' ')"

if [[ "$CHANGED_COUNT" -eq 0 ]]; then
  echo "boundary: ${#PATTERNS[@]} guarded patterns · no changed files vs $BASE — nothing to check."
  exit 0
fi

# ── Match ─────────────────────────────────────────────────────────────────────
: > "$VIOL_FILE"
while IFS= read -r FILE; do
  [[ -n "$FILE" ]] || continue
  for PATTERN in "${PATTERNS[@]}"; do
    RE="$(glob_to_regex "$PATTERN")"
    if [[ "$FILE" =~ $RE ]]; then
      printf '%s\t%s\n' "$FILE" "$PATTERN" >> "$VIOL_FILE"
      break
    fi
  done
done < "$CHANGED_FILE"

VIOLATIONS="$(wc -l < "$VIOL_FILE" | tr -d ' ')"

echo "boundary: ${#PATTERNS[@]} guarded patterns · $CHANGED_COUNT changed file(s) vs $BASE"

if [[ "$VIOLATIONS" -gt 0 ]]; then
  echo ""
  echo "❌ BACKEND BOUNDARY VIOLATION — $VIOLATIONS file(s) touch a read-only backend path:"
  echo ""
  while IFS=$'\t' read -r FILE PATTERN; do
    printf '   %-58s  (matched: %s)\n' "$FILE" "$PATTERN"
  done < "$VIOL_FILE"
  echo ""
  echo "The Bylda V1 rebuild makes ZERO backend changes. See BACKEND_BOUNDARY.md."
  echo "Revert these files. If the change is genuinely needed, log it in"
  echo "LANE_REQUESTS.md and get an owner to rule on it."
  echo ""
  exit 1
fi

echo "✅ boundary clean — no backend paths touched."
exit 0
