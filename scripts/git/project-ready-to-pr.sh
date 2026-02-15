#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./scripts/git/project-ready-to-pr.sh <owner> <project_number> <repo_full_name> [base_branch]
# Optional env:
#   WORK_CMD='npm run test:auth' (command executed before commit/push/PR)
#   READY_STATUS='Ready'
#   IN_REVIEW_STATUS='In Review'

OWNER="${1:-}"
PROJECT_NUMBER="${2:-}"
REPO_FULL_NAME="${3:-}"
BASE_BRANCH="${4:-main}"
READY_STATUS="${READY_STATUS:-Ready}"
IN_REVIEW_STATUS="${IN_REVIEW_STATUS:-In Review}"

if [[ -z "$OWNER" || -z "$PROJECT_NUMBER" || -z "$REPO_FULL_NAME" ]]; then
  echo "usage: $0 <owner> <project_number> <repo_full_name> [base_branch]" >&2
  exit 1
fi

if ! command -v gh >/dev/null 2>&1; then
  echo "error: gh CLI is required" >&2
  exit 1
fi
if ! command -v jq >/dev/null 2>&1; then
  echo "error: jq is required" >&2
  exit 1
fi

READY_JSON="$(./scripts/git/project-ready-item.sh "$OWNER" "$PROJECT_NUMBER" "$REPO_FULL_NAME" "$READY_STATUS" || true)"
STATUS="$(echo "$READY_JSON" | jq -r '.status // empty' 2>/dev/null || true)"

if [[ "$STATUS" == "NO_WORK" || -z "$STATUS" ]]; then
  echo "No Ready card available for ${REPO_FULL_NAME}."
  exit 0
fi

ITEM_ID="$(echo "$READY_JSON" | jq -r '.item_id')"
CARD_TITLE="$(echo "$READY_JSON" | jq -r '.title')"
ISSUE_NUMBER="$(echo "$READY_JSON" | jq -r '.issue_number // empty')"
CONTENT_TYPE="$(echo "$READY_JSON" | jq -r '.content_type // empty')"

slugify() {
  echo "$1" \
    | tr '[:upper:]' '[:lower:]' \
    | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//' \
    | cut -c1-42
}

TITLE_SLUG="$(slugify "$CARD_TITLE")"
BRANCH_NAME="feat/tests-${TITLE_SLUG:-project-card}"
COMMIT_MESSAGE="test(e2e): add coverage for ${CARD_TITLE}"
PR_TITLE="test: ${CARD_TITLE}"

if [[ -n "${WORK_CMD:-}" ]]; then
  echo "Running WORK_CMD..."
  eval "$WORK_CMD"
fi

# Safety gate before delivery
./scripts/ci/governance-gate.sh governance-gate-report.md

FLOW_OUTPUT_FILE="$(mktemp)"
./scripts/git/create-pr-flow.sh "$BRANCH_NAME" "$COMMIT_MESSAGE" "$BASE_BRANCH" "$PR_TITLE" 2>&1 | tee "$FLOW_OUTPUT_FILE"

PR_URL="$(grep -Eo 'https://github.com/[^ ]+/pull/[0-9]+' "$FLOW_OUTPUT_FILE" | tail -n1 || true)"
rm -f "$FLOW_OUTPUT_FILE"

if [[ -z "$PR_URL" ]]; then
  echo "error: PR URL not detected; item will not be moved to '${IN_REVIEW_STATUS}'." >&2
  exit 1
fi

./scripts/git/project-move-item.sh "$OWNER" "$PROJECT_NUMBER" "$ITEM_ID" "$IN_REVIEW_STATUS"

if [[ "$CONTENT_TYPE" == "Issue" && -n "$ISSUE_NUMBER" ]]; then
  gh issue comment "$ISSUE_NUMBER" --repo "$REPO_FULL_NAME" --body "Automated PR created: ${PR_URL}"
fi

jq -n \
  --arg status "SUCCESS" \
  --arg item_id "$ITEM_ID" \
  --arg title "$CARD_TITLE" \
  --arg branch "$BRANCH_NAME" \
  --arg commit_message "$COMMIT_MESSAGE" \
  --arg pr_url "$PR_URL" \
  --arg moved_to "$IN_REVIEW_STATUS" \
  '{status: $status, item_id: $item_id, title: $title, branch: $branch, commit_message: $commit_message, pr_url: $pr_url, moved_to: $moved_to}'
