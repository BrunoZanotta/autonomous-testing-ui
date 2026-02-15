#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./scripts/git/project-move-item.sh <owner> <project_number> <item_id> <target_status>
# Example:
#   ./scripts/git/project-move-item.sh BrunoZanotta 3 PVTI_xxx "In review"

OWNER="${1:-}"
PROJECT_NUMBER="${2:-}"
ITEM_ID="${3:-}"
TARGET_STATUS="${4:-}"

if [[ -z "$OWNER" || -z "$PROJECT_NUMBER" || -z "$ITEM_ID" || -z "$TARGET_STATUS" ]]; then
  echo "usage: $0 <owner> <project_number> <item_id> <target_status>" >&2
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

AUTH_STATUS="$(gh auth status 2>&1 || true)"
if echo "$AUTH_STATUS" | grep -q "not logged into"; then
  echo "error: gh is not authenticated. Run: gh auth login" >&2
  exit 1
fi

# In CI with GH_TOKEN/GITHUB_TOKEN, gh auth status may not print token scopes.
# In this case, rely on GraphQL mutation permission checks instead of static scope parsing.
if [[ -z "${GH_TOKEN:-}" && -z "${GITHUB_TOKEN:-}" ]]; then
  if ! echo "$AUTH_STATUS" | grep -Eq "Token scopes:.*project"; then
    echo "error: missing GitHub Project write scope (project)." >&2
    echo "run: gh auth refresh -s project" >&2
    exit 1
  fi
fi

QUERY='query($owner:String!, $number:Int!) {
  user(login:$owner) {
    projectV2(number:$number) {
      id
      fields(first:100) {
        nodes {
          ... on ProjectV2FieldCommon { id name }
          ... on ProjectV2SingleSelectField {
            id
            name
            options { id name }
          }
        }
      }
    }
  }
}'

ERR_FILE="$(mktemp)"
if ! RAW_JSON="$(gh api graphql -f query="$QUERY" -F owner="$OWNER" -F number="$PROJECT_NUMBER" 2>"$ERR_FILE")"; then
  cat "$ERR_FILE" >&2
  rm -f "$ERR_FILE"
  echo "hint: confirm project access and token scopes with 'gh auth status'" >&2
  exit 1
fi
rm -f "$ERR_FILE"

PROJECT_JSON="$(echo "$RAW_JSON" | jq -c '.data.user.projectV2')"
if [[ "$PROJECT_JSON" == "null" ]]; then
  echo "error: project not found for user '$OWNER' and number '$PROJECT_NUMBER'" >&2
  exit 1
fi

PROJECT_ID="$(echo "$PROJECT_JSON" | jq -r '.id')"
STATUS_FIELD_ID="$(echo "$PROJECT_JSON" | jq -r '.fields.nodes[] | select(.name == "Status") | .id' | head -n1)"
TARGET_OPTION_ID="$(echo "$PROJECT_JSON" | jq -r --arg target "$TARGET_STATUS" '.fields.nodes[] | select(.name == "Status") | .options[] | select(.name == $target) | .id' | head -n1)"

if [[ -z "$STATUS_FIELD_ID" || "$STATUS_FIELD_ID" == "null" ]]; then
  echo "error: status field not found in project" >&2
  exit 1
fi
if [[ -z "$TARGET_OPTION_ID" || "$TARGET_OPTION_ID" == "null" ]]; then
  echo "error: target status '$TARGET_STATUS' not found in project status options" >&2
  exit 1
fi

MUTATION='mutation($project:ID!, $item:ID!, $field:ID!, $option:String!) {
  updateProjectV2ItemFieldValue(
    input: {
      projectId: $project,
      itemId: $item,
      fieldId: $field,
      value: { singleSelectOptionId: $option }
    }
  ) {
    projectV2Item { id }
  }
}'

ERR_FILE="$(mktemp)"
if ! RESPONSE="$(gh api graphql -f query="$MUTATION" -F project="$PROJECT_ID" -F item="$ITEM_ID" -F field="$STATUS_FIELD_ID" -F option="$TARGET_OPTION_ID" 2>"$ERR_FILE")"; then
  cat "$ERR_FILE" >&2
  rm -f "$ERR_FILE"
  echo "hint: make sure token has 'project' scope and you have write permission to this project" >&2
  exit 1
fi
rm -f "$ERR_FILE"

UPDATED_ITEM_ID="$(echo "$RESPONSE" | jq -r '.data.updateProjectV2ItemFieldValue.projectV2Item.id // empty')"
if [[ -z "$UPDATED_ITEM_ID" ]]; then
  echo "error: failed to move item '$ITEM_ID' to '$TARGET_STATUS'" >&2
  exit 1
fi

jq -n \
  --arg status "MOVED" \
  --arg owner "$OWNER" \
  --argjson project_number "$PROJECT_NUMBER" \
  --arg item_id "$ITEM_ID" \
  --arg target_status "$TARGET_STATUS" \
  '{status: $status, owner: $owner, project_number: $project_number, item_id: $item_id, target_status: $target_status}'
