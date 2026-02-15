#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./scripts/git/project-ready-to-pr.sh <owner> <project_number> <repo_full_name> [base_branch]
# Optional env:
#   WORK_CMD='npm run test:auth' (command executed before commit/push/PR)
#   READY_STATUS='Ready'
#   IN_PROGRESS_STATUS='In progress'
#   IN_REVIEW_STATUS='In review'

OWNER="${1:-}"
PROJECT_NUMBER="${2:-}"
REPO_FULL_NAME="${3:-}"
BASE_BRANCH="${4:-main}"
READY_STATUS="${READY_STATUS:-Ready}"
IN_PROGRESS_STATUS="${IN_PROGRESS_STATUS:-In progress}"
IN_REVIEW_STATUS="${IN_REVIEW_STATUS:-In review}"

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
if ! command -v git >/dev/null 2>&1; then
  echo "error: git is required" >&2
  exit 1
fi

if ! git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  echo "error: current directory is not a git repository" >&2
  exit 1
fi

if ! git remote get-url origin >/dev/null 2>&1; then
  echo "error: git remote 'origin' not configured" >&2
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
CARD_BODY="$(echo "$READY_JSON" | jq -r '.body // empty')"
ISSUE_NUMBER="$(echo "$READY_JSON" | jq -r '.issue_number // empty')"
CONTENT_TYPE="$(echo "$READY_JSON" | jq -r '.content_type // empty')"
WORK_TYPE="$(echo "$READY_JSON" | jq -r '.work_type // "newTest"')"
PRIORITY_LABEL="$(echo "$READY_JSON" | jq -r '.priority_label // "NONE"')"

slugify() {
  echo "$1" \
    | tr '[:upper:]' '[:lower:]' \
    | sed -E 's/[^a-z0-9]+/-/g; s/^-+//; s/-+$//' \
    | cut -c1-42
}

TITLE_SLUG="$(slugify "$CARD_TITLE")"

case "$WORK_TYPE" in
  bugfix)
    BRANCH_PREFIX="bugfix"
    COMMIT_MESSAGE="fix(e2e): resolve ${CARD_TITLE}"
    PR_TITLE="fix: ${CARD_TITLE}"
    ;;
  newTest)
    BRANCH_PREFIX="newTest"
    COMMIT_MESSAGE="test(e2e): add coverage for ${CARD_TITLE}"
    PR_TITLE="test: ${CARD_TITLE}"
    ;;
  *)
    echo "error: unsupported work_type '$WORK_TYPE'. Expected bugfix or newTest." >&2
    exit 1
    ;;
esac

BRANCH_NAME="${BRANCH_PREFIX}/${TITLE_SLUG:-project-card}"

prepare_branch() {
  local base_branch="$1"
  local target_branch="$2"

  git fetch origin "$base_branch"
  if git show-ref --verify --quiet "refs/heads/$base_branch"; then
    git checkout "$base_branch"
    git pull --ff-only origin "$base_branch"
  else
    git checkout -b "$base_branch" "origin/$base_branch"
  fi

  if git show-ref --verify --quiet "refs/heads/$target_branch"; then
    git checkout "$target_branch"
  else
    git checkout -b "$target_branch"
  fi
}

# 1) Create/switch branch first
prepare_branch "$BASE_BRANCH" "$BRANCH_NAME"

# 2) Immediately mark card as in progress
./scripts/git/project-move-item.sh "$OWNER" "$PROJECT_NUMBER" "$ITEM_ID" "$IN_PROGRESS_STATUS"

# Expose card context for WORK_CMD scripts.
export PROJECT_OWNER="$OWNER"
export PROJECT_NUMBER="$PROJECT_NUMBER"
export PROJECT_REPO_FULL_NAME="$REPO_FULL_NAME"
export PROJECT_BASE_BRANCH="$BASE_BRANCH"
export PROJECT_BRANCH_NAME="$BRANCH_NAME"
export PROJECT_CARD_ITEM_ID="$ITEM_ID"
export PROJECT_CARD_TITLE="$CARD_TITLE"
export PROJECT_CARD_BODY="$CARD_BODY"
export PROJECT_CARD_CONTENT_TYPE="$CONTENT_TYPE"
export PROJECT_CARD_ISSUE_NUMBER="$ISSUE_NUMBER"
export PROJECT_CARD_WORK_TYPE="$WORK_TYPE"
export PROJECT_CARD_PRIORITY_LABEL="$PRIORITY_LABEL"

# 3) Execute implementation command (if provided)
if [[ -n "${WORK_CMD:-}" ]]; then
  echo "Running WORK_CMD..."
  eval "$WORK_CMD"
else
  echo "WORK_CMD not provided; continuing with current branch changes."
fi

# 4) Safety gate before delivery
./scripts/ci/governance-gate.sh governance-gate-report.md

# 5) Commit/push/PR without re-preparing branch
FLOW_OUTPUT_FILE="$(mktemp)"
SKIP_BRANCH_PREP=1 ./scripts/git/create-pr-flow.sh "$BRANCH_NAME" "$COMMIT_MESSAGE" "$BASE_BRANCH" "$PR_TITLE" 2>&1 | tee "$FLOW_OUTPUT_FILE"

PR_URL="$(grep -Eo 'https://github.com/[^ ]+/pull/[0-9]+' "$FLOW_OUTPUT_FILE" | tail -n1 || true)"
rm -f "$FLOW_OUTPUT_FILE"

if [[ -z "$PR_URL" ]]; then
  echo "error: PR URL not detected; item will not be moved to '${IN_REVIEW_STATUS}'." >&2
  exit 1
fi

# 6) Move card to in review after PR creation
./scripts/git/project-move-item.sh "$OWNER" "$PROJECT_NUMBER" "$ITEM_ID" "$IN_REVIEW_STATUS"

if [[ "$CONTENT_TYPE" == "Issue" && -n "$ISSUE_NUMBER" ]]; then
  gh issue comment "$ISSUE_NUMBER" --repo "$REPO_FULL_NAME" --body "Automated PR created: ${PR_URL}"
fi

jq -n \
  --arg status "SUCCESS" \
  --arg item_id "$ITEM_ID" \
  --arg title "$CARD_TITLE" \
  --arg branch "$BRANCH_NAME" \
  --arg work_type "$WORK_TYPE" \
  --arg priority_label "$PRIORITY_LABEL" \
  --arg commit_message "$COMMIT_MESSAGE" \
  --arg pr_url "$PR_URL" \
  --arg moved_to_in_progress "$IN_PROGRESS_STATUS" \
  --arg moved_to_in_review "$IN_REVIEW_STATUS" \
  '{
    status: $status,
    item_id: $item_id,
    title: $title,
    branch: $branch,
    work_type: $work_type,
    priority_label: $priority_label,
    commit_message: $commit_message,
    pr_url: $pr_url,
    moved_to_in_progress: $moved_to_in_progress,
    moved_to_in_review: $moved_to_in_review
  }'
