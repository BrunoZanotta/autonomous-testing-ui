#!/usr/bin/env node
import fs from 'node:fs';
import process from 'node:process';
import { commandExists, run } from '../lib/cli.mjs';

const reportFile = process.argv[2] ?? 'governance-gate-report.md';
const timestamp = new Date().toISOString().replace('.000Z', 'Z');

const counters = {
  CRITICAL: 0,
  HIGH: 0,
  MEDIUM: 0,
  LOW: 0,
  ENV_BLOCKER: 0,
};

const findings = [];
const auditScope = 'fixtures pages tests .github playwright.config.ts package.json .gitignore';

function addFinding(severity, location, message) {
  counters[severity] += 1;
  findings.push(`- [${severity}] ${location} - ${message}`);
}

function searchInPath(pattern, paths) {
  if (commandExists('rg')) {
    const result = run(
      'rg',
      [
        '-n',
        '--hidden',
        '--glob',
        '!.git',
        '--glob',
        '!node_modules',
        '--glob',
        '!playwright-report',
        '--glob',
        '!test-results',
        pattern,
        ...paths,
      ],
      { allowFailure: true },
    );
    return result.stdout;
  }

  const result = run(
    'grep',
    [
      '-RInE',
      '--exclude-dir=.git',
      '--exclude-dir=node_modules',
      '--exclude-dir=playwright-report',
      '--exclude-dir=test-results',
      pattern,
      ...paths,
    ],
    { allowFailure: true },
  );
  return result.stdout;
}

function fileHasEnvIgnoreRule() {
  if (!fs.existsSync('.gitignore')) {
    return false;
  }
  const content = fs.readFileSync('.gitignore', 'utf8');
  return /^\.env$|(^|\/)\.env$/m.test(content);
}

if (!fileHasEnvIgnoreRule()) {
  addFinding('HIGH', '.gitignore', 'Missing .env ignore rule.');
}

const envTracked = run('git', ['ls-files', '--error-unmatch', '.env'], { allowFailure: true });
if (envTracked.ok) {
  addFinding('CRITICAL', '.env', 'Sensitive environment file is tracked by git.');
}

const secretHits = searchInPath(
  'BEGIN (RSA|EC|OPENSSH) PRIVATE KEY|ghp_[A-Za-z0-9]{30,}|AKIA[0-9A-Z]{16}|xox[baprs]-[A-Za-z0-9-]+|AIza[0-9A-Za-z_-]{30,}',
  ['.'],
);
if (secretHits) {
  addFinding('CRITICAL', 'repository', 'Potential secret/token signature detected.');
}

const leakHits = searchInPath(
  'secret_sauce|standard_user|locked_out_user|invalid_user',
  ['pages', 'fixtures', 'tests', '.github', 'playwright.config.ts', 'README.md'],
);
if (leakHits) {
  addFinding('HIGH', 'source', 'Found hardcoded test credentials in tracked source files.');
}

const expectInTests = searchInPath('expect\\(', ['tests']);
if (expectInTests) {
  addFinding('HIGH', 'tests', 'Inline assertions found in tests; move to page layer methods.');
}

const selectorsInTests = searchInPath('page\\.|locator\\(|getBy(Role|Label|Text|TestId|Placeholder|AltText|Title)\\(', ['tests']);
if (selectorsInTests) {
  addFinding('HIGH', 'tests', 'Raw selectors/direct page usage found in tests.');
}

const expectInFixtures = searchInPath('expect\\(', ['fixtures']);
if (expectInFixtures) {
  addFinding('MEDIUM', 'fixtures', 'Assertions found in fixtures; keep fixtures focused on setup/injection.');
}

const waitHits = searchInPath('waitForTimeout\\(|\\bsleep\\(|setTimeout\\(|networkidle', ['fixtures', 'pages', 'tests']);
if (waitHits) {
  addFinding('HIGH', 'test-automation', 'Prohibited wait/synchronization pattern found.');
}

const loginHardcoded = searchInPath('https://www\\.saucedemo\\.com|standard_user|locked_out_user|invalid_user', ['pages/LoginPage.ts']);
if (loginHardcoded) {
  addFinding('HIGH', 'pages/LoginPage.ts', 'LoginPage still contains hardcoded base URL or app users.');
}

const discovery = run('npx', ['playwright', 'test', '--list', '--project=chromium'], {
  allowFailure: true,
  trimOutput: false,
});
if (!discovery.ok) {
  const log = `${discovery.stdout || ''}${discovery.stderr || ''}`;
  fs.writeFileSync('/tmp/governance-test-list.log', log, 'utf8');
  addFinding('ENV_BLOCKER', 'playwright', 'Test discovery failed in CI environment.');
}

const status = counters.CRITICAL > 0 || counters.HIGH > 0 ? 'FAIL' : 'PASS';

const lines = [];
lines.push('# Governance Gate Report');
lines.push('');
lines.push(`- Status: **${status}**`);
lines.push(`- Timestamp (UTC): ${timestamp}`);
lines.push(`- Scope: ${auditScope}`);
lines.push('');
lines.push('## Findings Summary');
lines.push(`- CRITICAL: ${counters.CRITICAL}`);
lines.push(`- HIGH: ${counters.HIGH}`);
lines.push(`- MEDIUM: ${counters.MEDIUM}`);
lines.push(`- LOW: ${counters.LOW}`);
lines.push(`- ENV_BLOCKER: ${counters.ENV_BLOCKER}`);
lines.push('');
lines.push('## Findings');
if (findings.length === 0) {
  lines.push('- No findings.');
} else {
  lines.push(...findings);
}
lines.push('');
lines.push('## Fixes Applied');
lines.push('- No automatic fix applied by CI gate.');
lines.push('');
lines.push('## Residual Risks');
if (status === 'FAIL') {
  lines.push('- Merge must be blocked until CRITICAL/HIGH issues are resolved.');
} else {
  lines.push('- No blocking risks detected by automated gate.');
}
lines.push('');
lines.push('## Required Follow-ups');
if (counters.CRITICAL > 0) {
  lines.push('- Rotate potentially exposed credentials/secrets and invalidate compromised tokens.');
}
if (counters.HIGH > 0) {
  lines.push('- Refactor violating files to restore architecture and reliability rules.');
}
if (counters.ENV_BLOCKER > 0) {
  lines.push('- Fix CI environment issues preventing test discovery.');
}
if (counters.CRITICAL === 0 && counters.HIGH === 0 && counters.ENV_BLOCKER === 0) {
  lines.push('- None.');
}

const report = `${lines.join('\n')}\n`;
fs.writeFileSync(reportFile, report, 'utf8');
process.stdout.write(report);

if (status === 'FAIL') {
  process.exit(1);
}
