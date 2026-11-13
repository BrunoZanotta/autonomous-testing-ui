# Autonomous Testing UI

![Playwright](https://img.shields.io/badge/Playwright-1.56.1-2EAD33)
![Node.js](https://img.shields.io/badge/Node.js-%3E%3D18-339933)
![Tests](https://img.shields.io/badge/tests-12-1f6feb)
![Spec files](https://img.shields.io/badge/spec%20files-11-1f6feb)

End-to-end UI automation for the [Sauce Demo](https://www.saucedemo.com) storefront: login, inventory, cart, and checkout. The suite uses the Page Object Model, custom Playwright fixtures, tag-based runs, a staged GitHub Actions workflow, a governance gate, and versioned QA agent definitions.

The base URL and account values come from the environment. Page objects hold the store catalog, checkout profiles, and the copy the specs assert.

## Tech stack

Declared in [`package.json`](package.json). [`package-lock.json`](package-lock.json) resolves each range to the version below.

| Package | Range in `package.json` | Resolved version |
| --- | --- | --- |
| `@playwright/test` | `^1.56.1` | `1.56.1` |
| `@types/node` | `^24.10.0` | `24.10.0` |
| `dotenv` | `^17.3.1` | `17.3.1` |

`@playwright/test@1.56.1` requires Node.js `>=18`. The GitHub Actions workflows install Node with `node-version: lts/*`. This repository does not declare a `typescript` dependency or a `tsconfig`. Specs are `.ts` files loaded by Playwright.

## What the suite covers

There are **11 spec files** and **12 tests**. Area tags sit on `test.describe`. `@smoke` and `@regression` sit on each `test`.

| Spec | Test | Tags |
| --- | --- | --- |
| `tests/auth/auth-001-successful-login.spec.ts` | Successful Login | `@auth` `@smoke` |
| `tests/auth/auth-002-failed-login-attempts.spec.ts` | Failed Login Attempts | `@auth` `@smoke` |
| `tests/inventory/inv-001-product-listing.spec.ts` | Product Listing | `@inventory` `@regression` |
| `tests/inventory/inv-002-product-sorting.spec.ts` | Product Sorting | `@inventory` `@regression` |
| `tests/inventory/inv-003-onesie-product-details.spec.ts` | Onesie Product Details | `@inventory` `@regression` |
| `tests/cart/cart-001-add-products.spec.ts` | Add Products to Cart | `@cart` `@smoke` |
| `tests/cart/cart-002-cart-management.spec.ts` | Cart Management | `@cart` `@regression` |
| `tests/cart/cart-003-add-two-products-to-cart.spec.ts` | Cart Two Products Validation | `@cart` `@regression` |
| `tests/cart/cart-004-add-three-products-to-cart.spec.ts` | Cart Three Products Validation | `@cart` `@regression` |
| `tests/cart/cart-005-add-four-products-to-cart.spec.ts` | Cart Four Products Validation | `@cart` `@regression` |
| `tests/checkout/check-001-checkout-information.spec.ts` | Checkout Information | `@checkout` `@smoke` |
| `tests/checkout/check-001-checkout-information.spec.ts` | Checkout Overview Supports Duplicate Product Prices | `@checkout` `@regression` |

Tag totals: `@auth` 2, `@inventory` 3, `@cart` 5, `@checkout` 2, `@smoke` 4, `@regression` 8.

`playwright.config.ts` registers five projects. A command that does not pass `--project` runs each of the 12 tests on every project:

| Project | Device preset |
| --- | --- |
| `chromium` | Desktop Chrome |
| `firefox` | Desktop Firefox |
| `webkit` | Desktop Safari |
| `mobile-chrome` | Pixel 5 |
| `mobile-safari` | iPhone 12 |

The GitHub Actions test jobs pass `--project=chromium`.

## Project structure

```
autonomous-testing-ui/
├── pages/
│   ├── LoginPage.ts            # URLs, users from env, auth errors, login actions
│   ├── AuthSessionPage.ts      # Standard-user session bootstrap
│   ├── InventoryPage.ts        # Catalog, sort options, inventory actions
│   ├── CartPage.ts
│   └── CheckoutPage.ts         # Checkout profiles and expected summary copy
├── fixtures/
│   └── app.fixture.ts          # Page objects and authenticatedPage
├── tests/
│   ├── auth/                   # 2 specs, 2 tests
│   ├── inventory/              # 3 specs, 3 tests
│   ├── cart/                   # 5 specs, 5 tests
│   └── checkout/               # 1 spec, 2 tests
├── scripts/
│   ├── ci/governance-gate.mjs
│   ├── lib/cli.mjs
│   └── git/                    # Project board and pull-request helpers
├── .github/
│   ├── agents/playwright/      # 7 agent definitions
│   └── workflows/              # Test stages and project-board workflows
├── .vscode/mcp.json            # Playwright MCP and GitHub MCP
├── docs/GITHUB_ACTIONS_SETUP.md
├── llms.txt                    # Agent delivery contract
├── playwright.config.ts
└── package.json
```

`fixtures/app.fixture.ts` injects `loginPage`, `inventoryPage`, `cartPage`, `checkoutPage`, and `authSessionPage`. The `authenticatedPage` fixture signs in through `AuthSessionPage.bootstrapAuthenticatedSession()` before the test body runs.

Inventory data lives in `STORE_PRODUCTS` (six products). Checkout data lives in `CHECKOUT_PROFILES`, `CHECKOUT_EXPECTED`, and `CHECKOUT_ERROR_MESSAGES`. Login routes and auth error strings live in `LoginPage.ts`.

## Setup

```bash
git clone https://github.com/BrunoZanotta/autonomous-testing-ui.git
cd autonomous-testing-ui
npm ci
npx playwright install --with-deps
```

`npm run pw:install` runs the same Playwright browser install.

`playwright.config.ts` loads `.env` through `dotenv/config` and throws if `BASE_URL` is missing. `.env` is listed in `.gitignore`. Create it locally with:

```bash
BASE_URL=
APP_USER_STANDARD_USERNAME=
APP_USER_STANDARD_PASSWORD=
APP_USER_LOCKED_USERNAME=
APP_USER_LOCKED_PASSWORD=
APP_USER_INVALID_USERNAME=
APP_USER_INVALID_PASSWORD=
```

`LoginPage` reads `BASE_URL` when the module loads. The three accounts are read when a login method calls them. The standard account is the successful login and the session bootstrap. The locked and invalid accounts are the failed-login spec.

In GitHub Actions, `playwright.yml` and `project-ready-orchestrator.yml` map the same names from repository variables (`BASE_URL` and the three usernames) and secrets (the three passwords). Project automation also uses the `GH_PROJECT_TOKEN` secret. Names and setup commands are in [`docs/GITHUB_ACTIONS_SETUP.md`](docs/GITHUB_ACTIONS_SETUP.md).

`.vscode/mcp.json` points the GitHub MCP server at `Authorization: Bearer ${env:GITHUB_PAT_TOKEN}`. That variable is for the editor MCP server. The test runner does not read it.

## Running tests

| Script | Command |
| --- | --- |
| `npm test` | `playwright test` |
| `npm run test:ci` | `playwright test --retries=2 --reporter=html` |
| `npm run test:auth` | `playwright test --grep @auth` |
| `npm run test:auth:retry` | `playwright test --grep @auth --retries=3` |
| `npm run test:smoke` | `playwright test --grep @smoke` |
| `npm run test:regression` | `playwright test --grep @regression` |
| `npm run test:inventory` | `playwright test --grep @inventory` |
| `npm run test:cart` | `playwright test --grep @cart` |
| `npm run test:checkout` | `playwright test --grep @checkout` |
| `npm run test:update-snapshots` | `playwright test --update-snapshots` |

Local defaults from `playwright.config.ts`: `fullyParallel: true`, retries `0`, workers unset, test timeout `30000`, expect timeout `5000`, action and navigation timeouts `10000`. When `CI` is set, `forbidOnly` is on, retries are `2`, and workers are `1`. The `testIdAttribute` is `data-test`.

Useful filters:

```bash
npx playwright test --grep @auth
npx playwright test --grep-invert @smoke
npx playwright test --grep "@auth.*@smoke"
npx playwright test --project=chromium
npx playwright test --debug
npx playwright test --ui
```

A tagged example from the suite:

```typescript
test.describe('Authentication Tests', { tag: '@auth' }, () => {
  test('Successful Login', { tag: '@smoke' }, async ({ loginPage, inventoryPage }) => {
    await test.step('Step 1: Goto', async () => {
      await loginPage.goto();
      await loginPage.loginAsStandardUser();
      await loginPage.assertLoginSuccess();
      await inventoryPage.assertOnInventoryPage();
      await inventoryPage.assertShoppingCartLinkVisible();
    });
  });
});
```

## Reports

The config reporters are HTML (`open: 'never'`) and list. HTML output goes to `playwright-report/`. Open the last HTML report with:

```bash
npx playwright show-report
```

Traces are `on-first-retry`. Video is `retain-on-failure`. Screenshots are `only-on-failure`. Those files land under `test-results/`. Both directories are gitignored.

`npm run governance:gate` runs `node ./scripts/ci/governance-gate.mjs governance-gate-report.md`. The script writes a Markdown report with status `PASS` or `FAIL`, counts for `CRITICAL`, `HIGH`, `MEDIUM`, `LOW`, and `ENV_BLOCKER`, and one line per finding. It exits with code `1` when any `CRITICAL` or `HIGH` finding is present. The report says that the CI gate does not apply an automatic fix. `governance-gate-report*.md` is gitignored.

The gate checks, inside `fixtures`, `pages`, `tests`, `.github`, `playwright.config.ts`, `package.json`, and `.gitignore`:

- `.env` is ignored and is not tracked
- private-key and token signatures
- hardcoded credential strings in pages, fixtures, tests, `.github`, `playwright.config.ts`, and `README.md`
- `expect(` in `tests/`
- direct `page` or locator calls in `tests/`
- `expect(` in `fixtures/`
- `waitForTimeout`, `sleep`, `setTimeout`, and `networkidle` in `fixtures/`, `pages/`, and `tests/`
- a hardcoded base URL or demo usernames in `pages/LoginPage.ts`
- `npx playwright test --list --project=chromium` (failure is recorded as `ENV_BLOCKER`)

## CI pipeline

Workflow file: [`.github/workflows/playwright.yml`](.github/workflows/playwright.yml), named **Playwright CI - Staged Execution**.

It runs on `pull_request` to `main` or `master` (`opened`, `synchronize`, `reopened`, `ready_for_review`) and on `workflow_dispatch`. Concurrency group `playwright-ci-<workflow>-<pull request or ref>` cancels an in-progress run. Permissions are `contents: write` and `pull-requests: write`. Every job uses `ubuntu-latest` and Node.js `lts/*`.

| Job | Needs | Timeout | What it runs |
| --- | --- | --- | --- |
| Authentication Tests (`auth-tests`) | — | 20 min | `npm run test:auth:retry -- --project=chromium --reporter=html,list` (`@auth`, 3 retries) |
| Smoke Tests (`smoke-tests`) | `auth-tests` | 20 min | `npm run test:smoke -- --project=chromium --retries=2 --reporter=html,list` |
| Regression Tests (`regression-tests`) | `smoke-tests` | 30 min | `npm run test:regression -- --project=chromium --retries=2 --reporter=html,list` |
| Full Suite (Chromium) (`full-test-suite`) | the three jobs above | 45 min | `npx playwright test --project=chromium --retries=2 --reporter=html,list` |
| Auto-Heal Snapshots (`auto-heal`) | the four jobs above | 25 min | Snapshot update on a failing same-repo pull request |
| Governance Gate (`governance-gate`) | the five jobs above | 15 min | `node ./scripts/ci/governance-gate.mjs governance-gate-report.md` |

Each test job checks out the repo, runs `npm ci`, installs Chromium with system dependencies, and uploads `playwright-report/` plus `test-results/` with `if: always()` and `retention-days: 14`. Artifact names: `auth-test-results`, `smoke-test-results`, `regression-test-results`, `full-suite-chromium-results`.

`smoke-tests` waits for `auth-tests`. `regression-tests` waits for `smoke-tests`. `full-test-suite` waits for all three. Those jobs target the `chromium` project.

`auto-heal` runs when the event is `pull_request`, the head repository is this repository, and at least one of the four test jobs has result `failure`. It checks out the pull request head, runs `npx playwright test --project=chromium --update-snapshots --retries=1 --reporter=list` with `continue-on-error: true`, and counts changed snapshot files. When that count is not zero, it commits `chore(heal): update Playwright snapshots [auto-heal]`, pushes to the pull request head branch, and comments on the pull request.

`governance-gate` uses `if: always()`. It uploads `governance-gate-report.md` as `governance-gate-report` for 14 days.

### Other workflows

These files are separate from the staged test jobs.

| Workflow | File | Trigger | Behavior |
| --- | --- | --- | --- |
| Project Ready Scheduler | `project-ready-scheduler.yml` | `workflow_dispatch`, and `workflow_run` when **Project Ready Orchestrator** completes | On `workflow_run`, sleeps 3600 seconds, then dispatches `project-ready-orchestrator.yml` on `main` with `GH_PROJECT_TOKEN` |
| Project Ready Orchestrator | `project-ready-orchestrator.yml` | `workflow_dispatch`, and `repository_dispatch` type `project-ready-tick` | If `GH_PROJECT_TOKEN` is set, looks for a `Ready` card on GitHub Project `BrunoZanotta/3` for `BrunoZanotta/autonomous-testing-ui`. When a card is present, installs dependencies and Chromium, then runs `project-ready-to-pr.mjs` with base branch `main`. Timeout 45 min. |
| Project Done On PR Merge | `project-done-on-merge.yml` | `pull_request` type `closed`, and only when the pull request merged | If `GH_PROJECT_TOKEN` is set, runs `project-pr-merge-to-done.mjs` for project number `vars.PROJECT_NUMBER` or `3`, status `Done` |

The orchestrator job name is `Ready -> Branch/Test/PR -> In review`. Its environment sets `READY_STATUS=Ready`, `IN_PROGRESS_STATUS=In progress`, `IN_REVIEW_STATUS=In review`, and `WORK_CMD` from `vars.PROJECT_READY_WORK_CMD` or `node ./scripts/git/project-ready-work.mjs`.

Helper scripts, also exposed as npm scripts:

```bash
npm run project:ready:item
npm run project:ready:move
npm run project:ready:to-pr
npm run project:pr:merge:done
npm run project:create-pr-flow
npm run project:ready:work
npm run actions:verify
```

`actions:verify` runs `node ./scripts/git/verify-actions-setup.mjs`.

## AI agents

Seven definitions live in [`.github/agents/playwright/`](.github/agents/playwright/). The catalog is [`.github/agents/README.md`](.github/agents/README.md). [`llms.txt`](llms.txt) is the delivery contract for creating a test or picking up a Ready card: branch, implement, validate, run the governance gate, open a pull request, and move the card.

| Agent file | Role written in the file |
| --- | --- |
| `qa-planner.agent.md` | Explores the app with Playwright planner tools and writes a scenario plan (title, tags, preconditions, fixtures, page-object responsibilities, steps, expected outcomes) for the generator and healer. |
| `qa-generator.agent.md` | Turns a plan into layered Playwright tests: fixtures for setup, page objects for selectors, actions, assertions, and domain data, specs for steps. |
| `qa-healer.agent.md` | Re-runs a failing test, reads trace, screenshot, video, console, and network evidence, classifies the failure, and applies a small stabilization fix. |
| `qa-test-refactorer.agent.md` | Refactors existing specs when it finds duplication, inline selectors or assertions, domain literals in tests, or fragile waits, and keeps the scenario intent. |
| `qa-governance-guardian.agent.md` | Final review for secrets, the fixtures/pages/tests split, and prohibited waits. The CI job runs `scripts/ci/governance-gate.mjs`, which reports findings and does not edit files. |
| `gitops-pr-orchestrator.agent.md` | Creates a branch, checks governance, commits with a conventional message, pushes, and opens a pull request. The helper is `scripts/git/create-pr-flow.mjs`. |
| `github-project-ready-pr-orchestrator.agent.md` | Works GitHub Project `BrunoZanotta/3`: takes `Ready` cards (`bugfix` before `newTest`, then `P0`, `P1`, `P2`), moves the card to `In progress`, and to `In review` after the pull request. |

`.vscode/mcp.json` is the versioned MCP config. It starts `@playwright/mcp@latest` over stdio and a GitHub MCP HTTP server. Other files under `.vscode/` are gitignored.

## Highlights

- Page objects for login, session bootstrap, inventory, cart, and checkout, with catalog and checkout data kept next to the actions.
- One fixture module injects those page objects and an authenticated session.
- Twelve tests in eleven spec files, filtered by `@auth`, `@inventory`, `@cart`, `@checkout`, `@smoke`, and `@regression`.
- Five browser and device projects locally. The staged CI jobs run the Chromium project and upload HTML output, traces, videos, and screenshots for 14 days.
- A governance script gates the workflow on secrets, layering, and waits, and writes `governance-gate-report.md`.
- Versioned planner, generator, healer, refactorer, governance, GitOps, and project-board agent definitions, plus the project workflows that call the Node helpers.

## Author

Bruno Zanotta — QA Automation Specialist | AI | Quality Engineering — [LinkedIn](https://www.linkedin.com/in/bruno-zanotta-qa/)
