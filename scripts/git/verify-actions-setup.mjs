#!/usr/bin/env node
import process from 'node:process';
import { requireCommand, run, safeJsonParse } from '../lib/cli.mjs';

const REQUIRED_SECRETS = [
  'GH_PROJECT_TOKEN',
  'APP_USER_STANDARD_PASSWORD',
  'APP_USER_LOCKED_PASSWORD',
  'APP_USER_INVALID_PASSWORD',
];

const REQUIRED_VARIABLES = [
  'BASE_URL',
  'APP_USER_STANDARD_USERNAME',
  'APP_USER_LOCKED_USERNAME',
  'APP_USER_INVALID_USERNAME',
];

const REQUIRED_WORKFLOWS = [
  '.github/workflows/playwright.yml',
  '.github/workflows/project-ready-orchestrator.yml',
  '.github/workflows/project-ready-scheduler.yml',
];

function parseRepoFromOrigin() {
  const origin = run('git', ['remote', 'get-url', 'origin']).stdout.trim();
  const normalized = origin.replace(/^git@github\.com:/, 'https://github.com/').replace(/\.git$/, '');
  const match = normalized.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)$/i);

  if (!match) {
    throw new Error(`error: unable to parse owner/repo from origin '${origin}'`);
  }

  return {
    owner: match[1],
    repo: match[2],
    fullName: `${match[1]}/${match[2]}`,
  };
}

function hasArg(name) {
  return process.argv.includes(name);
}

function argValue(name) {
  const idx = process.argv.indexOf(name);
  if (idx === -1) {
    return '';
  }
  return process.argv[idx + 1] ?? '';
}

function parseRepoArg() {
  const byFlag = argValue('--repo');
  if (!byFlag) {
    return null;
  }

  const match = byFlag.match(/^([^/]+)\/([^/]+)$/);
  if (!match) {
    throw new Error(`error: invalid --repo value '${byFlag}'. expected owner/repo`);
  }

  return {
    owner: match[1],
    repo: match[2],
    fullName: byFlag,
  };
}

function getRepoTarget() {
  const repoArg = parseRepoArg();
  if (repoArg) {
    return repoArg;
  }
  return parseRepoFromOrigin();
}

function readJsonFromGh(args) {
  const response = run('gh', args, { allowFailure: true });
  if (!response.ok) {
    const details = response.stderr || response.stdout || `gh command failed: ${args.join(' ')}`;
    throw new Error(details);
  }

  const parsed = safeJsonParse(response.stdout);
  if (!parsed) {
    throw new Error(`error: invalid JSON from gh ${args.join(' ')}`);
  }

  return parsed;
}

function checkWorkflowFiles() {
  const result = [];

  for (const file of REQUIRED_WORKFLOWS) {
    const exists = run('bash', ['-lc', `[ -f "${file}" ]`], { allowFailure: true }).ok;
    result.push({ file, exists });
  }

  return result;
}

function checkAuth() {
  const auth = run('gh', ['auth', 'status'], { allowFailure: true });
  if (!auth.ok) {
    const details = `${auth.stdout}\n${auth.stderr}`.trim();
    throw new Error(`error: gh auth status failed.\n${details}`);
  }
}

try {
  requireCommand('gh');
  requireCommand('git');
  checkAuth();

  const target = getRepoTarget();

  const secretJson = readJsonFromGh(['api', `repos/${target.owner}/${target.repo}/actions/secrets?per_page=100`]);
  const variableJson = readJsonFromGh(['api', `repos/${target.owner}/${target.repo}/actions/variables?per_page=100`]);

  const existingSecrets = new Set((secretJson.secrets ?? []).map((item) => String(item.name)));
  const variableItems = variableJson.variables ?? [];
  const existingVariables = new Set(variableItems.map((item) => String(item.name)));
  const variableValues = new Map(variableItems.map((item) => [String(item.name), String(item.value ?? '')]));

  const missingSecrets = REQUIRED_SECRETS.filter((name) => !existingSecrets.has(name));
  const missingVariables = REQUIRED_VARIABLES.filter((name) => !existingVariables.has(name));
  const invalidVariables = [];

  const workCmdValue = variableValues.get('PROJECT_READY_WORK_CMD') ?? '';
  if (workCmdValue && /project-ready-work\.sh\b/.test(workCmdValue)) {
    invalidVariables.push("PROJECT_READY_WORK_CMD uses deprecated '.sh' command");
  }

  const workflowChecks = checkWorkflowFiles();
  const missingWorkflows = workflowChecks.filter((item) => !item.exists).map((item) => item.file);

  const result = {
    repo: target.fullName,
    status:
      missingSecrets.length === 0 &&
      missingVariables.length === 0 &&
      missingWorkflows.length === 0 &&
      invalidVariables.length === 0
        ? 'OK'
        : 'MISSING_CONFIGURATION',
    required: {
      secrets: REQUIRED_SECRETS,
      variables: REQUIRED_VARIABLES,
      workflows: REQUIRED_WORKFLOWS,
    },
    missing: {
      secrets: missingSecrets,
      variables: missingVariables,
      workflows: missingWorkflows,
    },
    invalid: {
      variables: invalidVariables,
    },
  };

  if (hasArg('--json')) {
    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  } else {
    process.stdout.write(`Repository: ${result.repo}\n`);
    process.stdout.write(`Status: ${result.status}\n`);
    process.stdout.write(`Missing secrets: ${missingSecrets.length ? missingSecrets.join(', ') : 'none'}\n`);
    process.stdout.write(`Missing variables: ${missingVariables.length ? missingVariables.join(', ') : 'none'}\n`);
    process.stdout.write(`Missing workflows: ${missingWorkflows.length ? missingWorkflows.join(', ') : 'none'}\n`);
    process.stdout.write(`Invalid variables: ${invalidVariables.length ? invalidVariables.join(', ') : 'none'}\n`);
  }

  if (result.status !== 'OK') {
    process.exit(1);
  }
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exit(2);
}
