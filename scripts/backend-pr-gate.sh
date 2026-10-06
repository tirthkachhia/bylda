#!/usr/bin/env bash
# backend-pr-gate.sh — CI decision for the backend boundary (CLAUDE.md §12 G).
#
# Boundary paths (BACKEND_BOUNDARY.md) may change ONLY in a PR whose head branch
# starts with `backend/` AND that carries the label `backend`. Every other PR runs
# scripts/boundary-check.sh with the backend/* exemption switched off, so any
# boundary path in it fails the job.
#
# Inputs (env):
#   PR_HEAD_REF   head branch name        (github.event.pull_request.head.ref)
#   PR_LABELS     comma-separated labels  (join of github.event.pull_request.labels.*.name)
#   PR_BASE_REF   base branch             (github.event.pull_request.base.ref)
#
# Exit 0 allowed/clean, 1 violation, 2 setup problem.
set -euo pipefail
cd "$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

HEAD_REF="${PR_HEAD_REF:?PR_HEAD_REF is required}"
BASE_REF="${PR_BASE_REF:-integration}"
LABELS=",${PR_LABELS:-},"

has_backend_label=0
[[ "$LABELS" == *",backend,"* ]] && has_backend_label=1

if [[ "$HEAD_REF" == backend/* && $has_backend_label -eq 1 ]]; then
  echo "gate: '$HEAD_REF' + label 'backend' → backend PR. Boundary paths allowed."
  exit 0
fi

if [[ "$HEAD_REF" == backend/* ]]; then
  echo "gate: '$HEAD_REF' is a backend/* branch but the PR has no 'backend' label."
  echo "gate: checking it like any other PR. Add the label to allow boundary paths."
else
  echo "gate: '$HEAD_REF' is not a backend/* branch — boundary paths are forbidden."
fi

BOUNDARY_FORCE=1 BOUNDARY_HEAD_REF="$HEAD_REF" bash scripts/boundary-check.sh "origin/$BASE_REF"
