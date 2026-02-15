#!/usr/bin/env bash
set -euo pipefail

# Usage:
#   ./scripts/git/project-ready-item.sh <owner> <project_number> [repo_full_name] [ready_status]
# Example:
#   ./scripts/git/project-ready-item.sh BrunoZanotta 3 BrunoZanotta/autonomous-testing-ui Ready

OWNER="${1:-}"
PROJECT_NUMBER="${2:-}"
REPO_FILTER="${3:-}"
READY_STATUS="${4:-Ready}"

if [[ -z "$OWNER" || -z "$PROJECT_NUMBER" ]]; then
  echo "usage: $0 <owner> <project_number> [repo_full_name] [ready_status]" >&2
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
# In this case, rely on GraphQL call permission checks instead of static scope parsing.
if [[ -z "${GH_TOKEN:-}" && -z "${GITHUB_TOKEN:-}" ]]; then
  if ! echo "$AUTH_STATUS" | grep -Eq "Token scopes:.*(read:project|project)"; then
    echo "error: missing GitHub Project scope (read:project/project)." >&2
    echo "run: gh auth refresh -s read:project -s project" >&2
    exit 1
  fi
fi

QUERY='query($owner:String!, $number:Int!) {
  user(login:$owner) {
    projectV2(number:$number) {
      id
      title
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
      items(first:100) {
        nodes {
          id
          content {
            __typename
            ... on Issue {
              id
              number
              title
              body
              url
              repository { nameWithOwner }
              labels(first:30) { nodes { name } }
            }
            ... on PullRequest {
              id
              number
              title
              body
              url
              repository { nameWithOwner }
              labels(first:30) { nodes { name } }
            }
            ... on DraftIssue {
              id
              title
              body
            }
          }
          fieldValues(first:20) {
            nodes {
              ... on ProjectV2ItemFieldSingleSelectValue {
                name
                optionId
                field { ... on ProjectV2FieldCommon { name } }
              }
            }
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

STATUS_FIELD_ID="$(echo "$PROJECT_JSON" | jq -r '.fields.nodes[] | select(.name == "Status") | .id' | head -n1)"
if [[ -z "$STATUS_FIELD_ID" || "$STATUS_FIELD_ID" == "null" ]]; then
  echo "error: status field not found in project" >&2
  exit 1
fi

READY_ITEMS_JSON="$(echo "$PROJECT_JSON" | jq -c --arg ready "$READY_STATUS" --arg repo "$REPO_FILTER" '
  .items.nodes
  | map(select(
      ((.fieldValues.nodes | map(select(.field.name == "Status") | .name) | first) == $ready)
      and (
        ($repo == "")
        or (.content.__typename == "Issue" and .content.repository.nameWithOwner == $repo)
        or (.content.__typename == "PullRequest" and .content.repository.nameWithOwner == $repo)
      )
    ))
')"

READY_COUNT="$(echo "$READY_ITEMS_JSON" | jq 'length')"
if [[ "$READY_COUNT" -eq 0 ]]; then
  echo '{"status":"NO_WORK","message":"No Ready item found."}'
  exit 2
fi

ELIGIBLE_READY_ITEMS_JSON="$(echo "$READY_ITEMS_JSON" | jq -c '
  map(
    . as $item
    | ($item.content.__typename // "Unknown") as $content_type
    | (if ($content_type == "Issue" or $content_type == "PullRequest")
       then (($item.content.labels.nodes // []) | map(.name))
       else []
      end) as $labels
    | ($labels | map(ascii_downcase)) as $labels_norm
    | (if ($labels_norm | any(. == "bug" or . == "bugfix")) then "bugfix"
       elif ($labels_norm | any(. == "new test" or . == "newtest" or . == "new-test" or . == "new_test")) then "newTest"
       else "unknown"
      end) as $work_type
    | (if ($labels_norm | any(. == "p0")) then "P0"
       elif ($labels_norm | any(. == "p1")) then "P1"
       elif ($labels_norm | any(. == "p2")) then "P2"
       else "NONE"
      end) as $priority_label
    | . + {
        labels: $labels,
        work_type: $work_type,
        priority_label: $priority_label,
        work_type_rank: (if $work_type == "bugfix" then 0 elif $work_type == "newTest" then 1 else 9 end),
        priority_rank: (if $priority_label == "P0" then 0 elif $priority_label == "P1" then 1 elif $priority_label == "P2" then 2 else 9 end)
      }
  )
  | map(select(.work_type != "unknown"))
  | sort_by(.work_type_rank, .priority_rank, (try (.content.number | tonumber) catch 999999999), (.content.title // ""), .id)
')"

ELIGIBLE_COUNT="$(echo "$ELIGIBLE_READY_ITEMS_JSON" | jq 'length')"
if [[ "$ELIGIBLE_COUNT" -eq 0 ]]; then
  echo '{"status":"NO_WORK","message":"Ready cards found but none eligible. Required labels: bug or new test."}'
  exit 2
fi

READY_ITEM_JSON="$(echo "$ELIGIBLE_READY_ITEMS_JSON" | jq -c 'first')"

PROJECT_ID="$(echo "$PROJECT_JSON" | jq -r '.id')"
ITEM_ID="$(echo "$READY_ITEM_JSON" | jq -r '.id')"
CONTENT_TYPE="$(echo "$READY_ITEM_JSON" | jq -r '.content.__typename // "Unknown"')"
TITLE="$(echo "$READY_ITEM_JSON" | jq -r '.content.title // ""')"
BODY="$(echo "$READY_ITEM_JSON" | jq -r '.content.body // ""')"
CONTENT_URL="$(echo "$READY_ITEM_JSON" | jq -r '.content.url // ""')"
ISSUE_NUMBER="$(echo "$READY_ITEM_JSON" | jq -r '.content.number // empty')"
REPOSITORY="$(echo "$READY_ITEM_JSON" | jq -r '.content.repository.nameWithOwner // empty')"
WORK_TYPE="$(echo "$READY_ITEM_JSON" | jq -r '.work_type // "unknown"')"
PRIORITY_LABEL="$(echo "$READY_ITEM_JSON" | jq -r '.priority_label // "NONE"')"
LABELS_JSON="$(echo "$READY_ITEM_JSON" | jq -c '.labels // []')"

jq -n \
  --arg status "READY_ITEM_FOUND" \
  --arg owner "$OWNER" \
  --argjson project_number "$PROJECT_NUMBER" \
  --arg project_id "$PROJECT_ID" \
  --arg status_field_id "$STATUS_FIELD_ID" \
  --arg ready_status "$READY_STATUS" \
  --arg item_id "$ITEM_ID" \
  --arg content_type "$CONTENT_TYPE" \
  --arg title "$TITLE" \
  --arg body "$BODY" \
  --arg content_url "$CONTENT_URL" \
  --arg issue_number "$ISSUE_NUMBER" \
  --arg repository "$REPOSITORY" \
  --arg work_type "$WORK_TYPE" \
  --arg priority_label "$PRIORITY_LABEL" \
  --argjson labels "$LABELS_JSON" \
  '{
    status: $status,
    owner: $owner,
    project_number: $project_number,
    project_id: $project_id,
    status_field_id: $status_field_id,
    ready_status: $ready_status,
    item_id: $item_id,
    content_type: $content_type,
    title: $title,
    body: $body,
    content_url: $content_url,
    issue_number: $issue_number,
    repository: $repository,
    work_type: $work_type,
    priority_label: $priority_label,
    labels: $labels
  }'
