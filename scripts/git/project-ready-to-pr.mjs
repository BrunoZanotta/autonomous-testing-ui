#!/usr/bin/env node
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import process from 'node:process';
import { run } from '../lib/cli.mjs';

function usage() {
  console.error('usage: node scripts/git/project-ready-to-pr.mjs <owner> <project_number> <repo_full_name> [base_branch]');
}

const owner = process.argv[2] ?? '';
const projectNumberRaw = process.argv[3] ?? '';
const repoFullName = process.argv[4] ?? '';
const baseBranch = process.argv[5] ?? 'main';

const readyStatus = process.env.READY_STATUS ?? 'Ready';
const inProgressStatus = process.env.IN_PROGRESS_STATUS ?? 'In progress';
const inReviewStatus = process.env.IN_REVIEW_STATUS ?? 'In review';

if (!owner || !projectNumberRaw || !repoFullName) {
  usage();
  process.exit(1);
}

const projectNumber = Number.parseInt(projectNumberRaw, 10);
if (!Number.isInteger(projectNumber) || projectNumber <= 0) {
  console.error(`error: invalid project number '${projectNumberRaw}'`);
  process.exit(1);
}

function slugify(value) {
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 42);
}

function hasLocalBranch(branch) {
  return run('git', ['show-ref', '--verify', '--quiet', `refs/heads/${branch}`], { allowFailure: true }).ok;
}

function prepareBranch(base, target) {
  run('git', ['fetch', 'origin', base], { stdio: 'inherit' });

  if (hasLocalBranch(base)) {
    run('git', ['checkout', base], { stdio: 'inherit' });
    run('git', ['pull', '--ff-only', 'origin', base], { stdio: 'inherit' });
  } else {
    run('git', ['checkout', '-b', base, `origin/${base}`], { stdio: 'inherit' });
  }

  if (hasLocalBranch(target)) {
    run('git', ['checkout', target], { stdio: 'inherit' });
  } else {
    run('git', ['checkout', '-b', target], { stdio: 'inherit' });
  }
}

function parseJsonOutput(raw) {
  try {
    return JSON.parse(raw.trim());
  } catch {
    return null;
  }
}

let selectedItemId = '';
let selectedIssueNumber = '';
let movedToInProgress = false;
let selectedBranchName = '';

try {
  if (!run('git', ['rev-parse', '--is-inside-work-tree'], { allowFailure: true }).ok) {
    throw new Error('error: current directory is not a git repository');
  }

  if (!run('git', ['remote', 'get-url', 'origin'], { allowFailure: true }).ok) {
    throw new Error("error: git remote 'origin' not configured");
  }

  const readyCheck = run(
    'node',
    ['scripts/git/project-ready-item.mjs', owner, String(projectNumber), repoFullName, readyStatus],
    { allowFailure: true },
  );

  const readyRaw = (readyCheck.stdout || '').trim();
  const readyJson = parseJsonOutput(readyRaw);
  const status = readyJson?.status ?? '';

  if (readyCheck.code === 2 || status === 'NO_WORK' || !status) {
    console.log(`No Ready card available for ${repoFullName}.`);
    process.exit(0);
  }

  if (!readyCheck.ok) {
    const details = readyCheck.stderr || readyCheck.stdout || 'error while fetching ready item';
    throw new Error(details);
  }

  const itemId = String(readyJson.item_id ?? '');
  const cardTitle = String(readyJson.title ?? '');
  const cardBody = String(readyJson.body ?? '');
  const issueNumber = String(readyJson.issue_number ?? '');
  const contentType = String(readyJson.content_type ?? '');
  const workType = String(readyJson.work_type ?? 'newTest');
  const priorityLabel = String(readyJson.priority_label ?? 'NONE');
  selectedItemId = itemId;
  selectedIssueNumber = issueNumber;

  let branchPrefix;
  let commitMessage;
  let prTitle;

  if (workType === 'bugfix') {
    branchPrefix = 'bugfix';
    commitMessage = `fix(e2e): resolve ${cardTitle}`;
    prTitle = `fix: ${cardTitle}`;
  } else if (workType === 'newTest') {
    branchPrefix = 'newTest';
    commitMessage = `test(e2e): add coverage for ${cardTitle}`;
    prTitle = `test: ${cardTitle}`;
  } else {
    throw new Error(`error: unsupported work_type '${workType}'. Expected bugfix or newTest.`);
  }

  const titleSlug = slugify(cardTitle);
  const branchName = `${branchPrefix}/${titleSlug || 'project-card'}`;
  selectedBranchName = branchName;

  prepareBranch(baseBranch, branchName);

  run('node', ['scripts/git/project-move-item.mjs', owner, String(projectNumber), itemId, inProgressStatus], {
    stdio: 'inherit',
  });
  movedToInProgress = true;

  const workflowEnv = {
    PROJECT_OWNER: owner,
    PROJECT_NUMBER: String(projectNumber),
    PROJECT_REPO_FULL_NAME: repoFullName,
    PROJECT_BASE_BRANCH: baseBranch,
    PROJECT_BRANCH_NAME: branchName,
    PROJECT_CARD_ITEM_ID: itemId,
    PROJECT_CARD_TITLE: cardTitle,
    PROJECT_CARD_BODY: cardBody,
    PROJECT_CARD_CONTENT_TYPE: contentType,
    PROJECT_CARD_ISSUE_NUMBER: issueNumber,
    PROJECT_CARD_WORK_TYPE: workType,
    PROJECT_CARD_PRIORITY_LABEL: priorityLabel,
  };

  const configuredWorkCmd = String(process.env.WORK_CMD ?? '').trim();
  let effectiveWorkCmd = configuredWorkCmd || 'node ./scripts/git/project-ready-work.mjs';

  if (/project-ready-work\.sh\b/.test(effectiveWorkCmd)) {
    process.stdout.write('WORK_CMD points to deprecated .sh path; using node ./scripts/git/project-ready-work.mjs instead.\n');
    effectiveWorkCmd = 'node ./scripts/git/project-ready-work.mjs';
  }

  process.stdout.write(`Running WORK_CMD: ${effectiveWorkCmd}\n`);
  const workRun = run('bash', ['-lc', effectiveWorkCmd], {
    allowFailure: true,
    env: workflowEnv,
    trimOutput: false,
  });
  if (workRun.stdout) {
    process.stdout.write(workRun.stdout);
  }
  if (workRun.stderr) {
    process.stderr.write(workRun.stderr);
  }
  if (!workRun.ok) {
    const details = workRun.stderr || workRun.stdout || 'work command failed';
    throw new Error(`error: work command failed.\n${details}`);
  }

  const generatedMatch = `${workRun.stdout}\n${workRun.stderr}`.match(/Generated:\s*(.+\.spec\.ts)/i);
  const generatedTestFile = generatedMatch ? String(generatedMatch[1]).trim() : '';

  run('node', ['scripts/ci/governance-gate.mjs', 'governance-gate-report.md'], { stdio: 'inherit' });

  let prBodyFilePath = '';
  const prBodyLines = [
    '## Summary',
    `- Automated Ready flow for issue: ${cardTitle}`,
    `- Branch: \`${branchName}\``,
    generatedTestFile ? `- Test generated: \`${generatedTestFile}\`` : '- Test generated: n/a',
    '',
    '## Validation',
    '- Governance gate executed',
    '- Playwright test discovery attempted',
  ];

  if (contentType === 'Issue' && issueNumber) {
    prBodyLines.push('', `Refs #${issueNumber}`);
  }

  const prBodyTempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'project-ready-pr-'));
  prBodyFilePath = path.join(prBodyTempDir, 'pr-body.md');
  fs.writeFileSync(prBodyFilePath, `${prBodyLines.join('\n')}\n`, 'utf8');

  const flow = run(
    'node',
    ['scripts/git/create-pr-flow.mjs', branchName, commitMessage, baseBranch, prTitle, prBodyFilePath],
    {
      allowFailure: true,
      env: { ...workflowEnv, SKIP_BRANCH_PREP: '1' },
    },
  );

  try {
    fs.rmSync(prBodyTempDir, { recursive: true, force: true });
  } catch {
    // ignore cleanup failure
  }

  if (flow.stdout) {
    process.stdout.write(`${flow.stdout}\n`);
  }
  if (flow.stderr) {
    process.stderr.write(`${flow.stderr}\n`);
  }

  if (!flow.ok) {
    throw new Error('error: create-pr-flow failed; item will not be moved to in review.');
  }

  const combinedOutput = `${flow.stdout || ''}\n${flow.stderr || ''}`;
  const prMatch = combinedOutput.match(/https:\/\/github\.com\/[^\s]+\/pull\/\d+/g);
  const prUrl = prMatch ? prMatch[prMatch.length - 1] : '';

  if (!prUrl) {
    throw new Error(`error: PR URL not detected; item will not be moved to '${inReviewStatus}'.`);
  }

  run('node', ['scripts/git/project-move-item.mjs', owner, String(projectNumber), itemId, inReviewStatus], {
    stdio: 'inherit',
  });

  if (contentType === 'Issue' && issueNumber) {
    const issueCommentLines = [
      'Automated flow completed.',
      `- Branch: ${branchName}`,
      generatedTestFile ? `- Test file: ${generatedTestFile}` : '- Test file: n/a',
      `- PR: ${prUrl}`,
    ];
    run('gh', ['issue', 'comment', issueNumber, '--repo', repoFullName, '--body', issueCommentLines.join('\n')], { stdio: 'inherit' });
  }

  console.log(
    JSON.stringify({
      status: 'SUCCESS',
      item_id: itemId,
      title: cardTitle,
      branch: branchName,
      work_type: workType,
      priority_label: priorityLabel,
      commit_message: commitMessage,
      generated_test_file: generatedTestFile,
      pr_url: prUrl,
      moved_to_in_progress: inProgressStatus,
      moved_to_in_review: inReviewStatus,
    }),
  );
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(message);

  if (movedToInProgress && selectedItemId) {
    try {
      run('node', ['scripts/git/project-move-item.mjs', owner, String(projectNumber), selectedItemId, readyStatus], {
        stdio: 'inherit',
      });

      if (selectedIssueNumber) {
        run(
          'gh',
          [
            'issue',
            'comment',
            selectedIssueNumber,
            '--repo',
            repoFullName,
            '--body',
            [
              'Automated flow failed and card was moved back to Ready.',
              selectedBranchName ? `- Branch: ${selectedBranchName}` : '- Branch: n/a',
              `- Error: ${message}`,
            ].join('\n'),
          ],
          { stdio: 'inherit', allowFailure: true },
        );
      }
    } catch (rollbackError) {
      const rollbackMessage = rollbackError instanceof Error ? rollbackError.message : String(rollbackError);
      console.error(`error: failed to rollback item '${selectedItemId}' to '${readyStatus}': ${rollbackMessage}`);
    }
  }

  process.exit(1);
}
