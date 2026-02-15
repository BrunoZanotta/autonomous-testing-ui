#!/usr/bin/env bash
set -euo pipefail

REPORT_FILE="${1:-governance-gate-report.md}"
TIMESTAMP="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"

CRITICAL=0
HIGH=0
MEDIUM=0
LOW=0
ENV_BLOCKER=0

declare -a FINDINGS=()

audit_files="fixtures pages tests .github playwright.config.ts package.json .gitignore"

inc_severity() {
  local severity="$1"
  case "$severity" in
    CRITICAL) CRITICAL=$((CRITICAL + 1)) ;;
    HIGH) HIGH=$((HIGH + 1)) ;;
    MEDIUM) MEDIUM=$((MEDIUM + 1)) ;;
    LOW) LOW=$((LOW + 1)) ;;
    ENV_BLOCKER) ENV_BLOCKER=$((ENV_BLOCKER + 1)) ;;
  esac
}

add_finding() {
  local severity="$1"
  local location="$2"
  local message="$3"
  inc_severity "$severity"
  FINDINGS+=("- [${severity}] ${location} - ${message}")
}

has_rg=0
if command -v rg >/dev/null 2>&1; then
  has_rg=1
fi

search_in_path() {
  local pattern="$1"
  shift
  if [[ "$has_rg" -eq 1 ]]; then
    rg -n --hidden --glob '!.git' --glob '!node_modules' --glob '!playwright-report' --glob '!test-results' "$pattern" "$@" || true
  else
    grep -RInE --exclude-dir=.git --exclude-dir=node_modules --exclude-dir=playwright-report --exclude-dir=test-results "$pattern" "$@" || true
  fi
}

# 1) .env must be ignored
if ! grep -Eq '^\.env$|(^|/)\.env$' .gitignore; then
  add_finding "HIGH" ".gitignore" "Missing .env ignore rule."
fi

# 2) .env must not be tracked
if git ls-files --error-unmatch .env >/dev/null 2>&1; then
  add_finding "CRITICAL" ".env" "Sensitive environment file is tracked by git."
fi

# 3) hardcoded critical secret patterns
secret_hits="$(search_in_path 'BEGIN (RSA|EC|OPENSSH) PRIVATE KEY|ghp_[A-Za-z0-9]{30,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]+|AIza[0-9A-Za-z_-]{30,}' .)"
if [[ -n "$secret_hits" ]]; then
  add_finding "CRITICAL" "repository" "Potential secret/token signature detected."
fi

# 4) hardcoded auth values outside .env (block specific known leaks)
leak_hits="$(search_in_path 'secret_sauce|standard_user|locked_out_user|invalid_user' pages fixtures tests .github playwright.config.ts README.md)"
if [[ -n "$leak_hits" ]]; then
  add_finding "HIGH" "source" "Found hardcoded test credentials in tracked source files."
fi

# 5) tests must not contain inline expect()
expect_in_tests="$(search_in_path 'expect\(' tests)"
if [[ -n "$expect_in_tests" ]]; then
  add_finding "HIGH" "tests" "Inline assertions found in tests; move to page layer methods."
fi

# 6) tests must not contain raw selector usage / direct page calls
selectors_in_tests="$(search_in_path 'page\.|locator\(|getBy(Role|Label|Text|TestId|Placeholder|AltText|Title)\(' tests)"
if [[ -n "$selectors_in_tests" ]]; then
  add_finding "HIGH" "tests" "Raw selectors/direct page usage found in tests."
fi

# 7) fixtures should not contain assertions
expect_in_fixtures="$(search_in_path 'expect\(' fixtures)"
if [[ -n "$expect_in_fixtures" ]]; then
  add_finding "MEDIUM" "fixtures" "Assertions found in fixtures; keep fixtures focused on setup/injection."
fi

# 8) prohibited wait patterns
wait_hits="$(search_in_path 'waitForTimeout\(|\bsleep\(|setTimeout\(|networkidle' fixtures pages tests)"
if [[ -n "$wait_hits" ]]; then
  add_finding "HIGH" "test-automation" "Prohibited wait/synchronization pattern found."
fi

# 9) LoginPage should rely on env for base URL and app users
hardcoded_login="$(search_in_path 'https://www\.saucedemo\.com|standard_user|locked_out_user|invalid_user' pages/LoginPage.ts)"
if [[ -n "$hardcoded_login" ]]; then
  add_finding "HIGH" "pages/LoginPage.ts" "LoginPage still contains hardcoded base URL or app users."
fi

# 10) executability check (discovery)
if ! npx playwright test --list --project=chromium >/tmp/governance-test-list.log 2>&1; then
  add_finding "ENV_BLOCKER" "playwright" "Test discovery failed in CI environment."
fi

STATUS="PASS"
if [[ "$CRITICAL" -gt 0 || "$HIGH" -gt 0 ]]; then
  STATUS="FAIL"
fi

{
  echo "# Governance Gate Report"
  echo
  echo "- Status: **${STATUS}**"
  echo "- Timestamp (UTC): ${TIMESTAMP}"
  echo "- Scope: ${audit_files}"
  echo
  echo "## Findings Summary"
  echo "- CRITICAL: ${CRITICAL}"
  echo "- HIGH: ${HIGH}"
  echo "- MEDIUM: ${MEDIUM}"
  echo "- LOW: ${LOW}"
  echo "- ENV_BLOCKER: ${ENV_BLOCKER}"
  echo
  echo "## Findings"
  if [[ "${#FINDINGS[@]}" -eq 0 ]]; then
    echo "- No findings."
  else
    for finding in "${FINDINGS[@]}"; do
      echo "${finding}"
    done
  fi
  echo
  echo "## Fixes Applied"
  echo "- No automatic fix applied by CI gate."
  echo
  echo "## Residual Risks"
  if [[ "$STATUS" == "FAIL" ]]; then
    echo "- Merge must be blocked until CRITICAL/HIGH issues are resolved."
  else
    echo "- No blocking risks detected by automated gate."
  fi
  echo
  echo "## Required Follow-ups"
  if [[ "$CRITICAL" -gt 0 ]]; then
    echo "- Rotate potentially exposed credentials/secrets and invalidate compromised tokens."
  fi
  if [[ "$HIGH" -gt 0 ]]; then
    echo "- Refactor violating files to restore architecture and reliability rules."
  fi
  if [[ "$ENV_BLOCKER" -gt 0 ]]; then
    echo "- Fix CI environment issues preventing test discovery."
  fi
  if [[ "$CRITICAL" -eq 0 && "$HIGH" -eq 0 && "$ENV_BLOCKER" -eq 0 ]]; then
    echo "- None."
  fi
} > "$REPORT_FILE"

cat "$REPORT_FILE"

if [[ "$STATUS" == "FAIL" ]]; then
  exit 1
fi
