#!/usr/bin/env node
import process from 'node:process';
import { normalizeStatus, safeJsonParse, run } from '../lib/cli.mjs';
import {
  describeStatusOptions,
  ensureGhAuthenticated,
  findStatusField,
  getProjectNodeFromResponse,
  ghGraphql,
  matchStatusOption,
  MOVE_ITEM_MUTATION,
  PROJECT_READY_QUERY,
} from './lib/github-project.mjs';

function usage() {
  console.error(
    'usage: node scripts/git/project-pr-merge-to-done.mjs <owner> <project_number> <repo_full_name> <pr_number> [done_status]',
  );
}

const owner = process.argv[2] ?? '';
const projectNumberRaw = process.argv[3] ?? '';
const repoFullName = process.argv[4] ?? '';
const prNumberRaw = process.argv[5] ?? '';
const doneStatus = process.argv[6] ?? 'Done';

if (!owner || !projectNumberRaw || !repoFullName || !prNumberRaw) {
  usage();
  process.exit(1);
}

const projectNumber = Number.parseInt(projectNumberRaw, 10);
if (!Number.isInteger(projectNumber) || projectNumber <= 0) {
  console.error(`error: invalid project number '${projectNumberRaw}'`);
  process.exit(1);
}

const prNumber = Number.parseInt(prNumberRaw, 10);
if (!Number.isInteger(prNumber) || prNumber <= 0) {
  console.error(`error: invalid pull request number '${prNumberRaw}'`);
  process.exit(1);
}

const repoMatch = repoFullName.match(/^([^/]+)\/([^/]+)$/);
if (!repoMatch) {
  console.error(`error: invalid repo_full_name '${repoFullName}'. expected owner/repo`);
  process.exit(1);
}

const repoName = repoMatch[2];

function readPullRequest(repo, number) {
  const response = run('gh', ['api', `repos/${repo}/pulls/${number}`], { allowFailure: true });
  if (!response.ok) {
    const details = response.stderr || response.stdout || 'failed to read pull request';
    throw new Error(details);
  }

  const parsed = safeJsonParse(response.stdout);
  if (!parsed) {
    throw new Error('error: invalid pull request JSON response');
  }

  return parsed;
}

function readClosingIssueNumbersFromGraphql(prNum) {
  const query = `
query($owner:String!, $repo:String!, $number:Int!) {
  repository(owner:$owner, name:$repo) {
    pullRequest(number:$number) {
      closingIssuesReferences(first:20) {
        nodes {
          number
          repository { nameWithOwner }
        }
      }
    }
  }
}`;

  const response = ghGraphql(
    query,
    {
      owner,
      repo: repoName,
      number: prNum,
    },
    { retries: 1 },
  );

  const nodes = response?.data?.repository?.pullRequest?.closingIssuesReferences?.nodes ?? [];
  return nodes
    .filter((node) => String(node?.repository?.nameWithOwner ?? '') === repoFullName)
    .map((node) => Number.parseInt(String(node?.number ?? ''), 10))
    .filter((value) => Number.isInteger(value) && value > 0);
}

function parseIssueNumbersFromText(text) {
  const values = new Set();
  const source = String(text ?? '');
  const keywordRegex = /(?:refs?|related to|close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s+#(\d+)/gi;

  let match = keywordRegex.exec(source);
  while (match) {
    const value = Number.parseInt(match[1], 10);
    if (Number.isInteger(value) && value > 0) {
      values.add(value);
    }
    match = keywordRegex.exec(source);
  }

  return values;
}

function readIssueComments(issueNumber) {
  const response = run('gh', ['api', `repos/${repoFullName}/issues/${issueNumber}/comments?per_page=100`], {
    allowFailure: true,
  });

  if (!response.ok) {
    return [];
  }

  const parsed = safeJsonParse(response.stdout, []);
  return Array.isArray(parsed) ? parsed : [];
}

function findIssueNumbersByPrUrlFallback(projectItems, prUrl) {
  if (!prUrl) {
    return [];
  }

  const inReviewIssues = projectItems
    .filter(
      (item) =>
        item?.content?.__typename === 'Issue' &&
        String(item?.content?.repository?.nameWithOwner ?? '') === repoFullName &&
        normalizeStatus(getItemStatus(item)) === 'inreview',
    )
    .map((item) => Number.parseInt(String(item?.content?.number ?? ''), 10))
    .filter((value) => Number.isInteger(value) && value > 0);

  const matches = [];
  for (const issueNumber of inReviewIssues) {
    const comments = readIssueComments(issueNumber);
    const hasReference = comments.some((comment) => String(comment?.body ?? '').includes(prUrl));
    if (hasReference) {
      matches.push(issueNumber);
    }
  }

  return matches;
}

function getItemStatus(item) {
  const values = Array.isArray(item?.fieldValues?.nodes) ? item.fieldValues.nodes : [];
  const statusValue = values.find((node) => normalizeStatus(node?.field?.name) === 'status');
  return String(statusValue?.name ?? '');
}

try {
  ensureGhAuthenticated({ requireProjectWrite: true });

  const pr = readPullRequest(repoFullName, prNumber);
  if (!pr?.merged_at) {
    console.log(
      JSON.stringify({
        status: 'PULL_REQUEST_NOT_MERGED',
        pull_request: prNumber,
      }),
    );
    process.exit(0);
  }

  const issueNumbers = new Set();
  for (const value of readClosingIssueNumbersFromGraphql(prNumber)) {
    issueNumbers.add(value);
  }
  for (const value of parseIssueNumbersFromText(pr.body ?? '')) {
    issueNumbers.add(value);
  }

  const projectResponse = ghGraphql(PROJECT_READY_QUERY, {
    owner,
    number: projectNumber,
  });
  const project = getProjectNodeFromResponse(projectResponse, owner, projectNumber);
  const statusField = findStatusField(project);
  const doneOption = matchStatusOption(statusField, doneStatus);

  if (!doneOption) {
    const options = describeStatusOptions(statusField);
    throw new Error(`error: target status '${doneStatus}' not found. Available: ${options.join(', ')}`);
  }

  const items = Array.isArray(project?.items?.nodes) ? project.items.nodes : [];

  if (issueNumbers.size === 0) {
    for (const value of findIssueNumbersByPrUrlFallback(items, String(pr?.html_url ?? ''))) {
      issueNumbers.add(value);
    }
  }

  const linkedIssues = Array.from(issueNumbers).sort((a, b) => a - b);
  if (linkedIssues.length === 0) {
    console.log(
      JSON.stringify({
        status: 'NO_LINKED_ISSUES',
        pull_request: prNumber,
        repo: repoFullName,
      }),
    );
    process.exit(0);
  }

  const moved = [];
  const alreadyDone = [];
  const notFound = [];

  for (const issueNumber of linkedIssues) {
    const item = items.find(
      (node) =>
        node?.content?.__typename === 'Issue' &&
        Number.parseInt(String(node?.content?.number ?? ''), 10) === issueNumber &&
        String(node?.content?.repository?.nameWithOwner ?? '') === repoFullName,
    );

    if (!item) {
      notFound.push(issueNumber);
      continue;
    }

    const currentStatus = getItemStatus(item);
    if (normalizeStatus(currentStatus) === normalizeStatus(doneStatus)) {
      alreadyDone.push(issueNumber);
      continue;
    }

    ghGraphql(MOVE_ITEM_MUTATION, {
      project: String(project.id),
      item: String(item.id),
      field: String(statusField.id),
      option: String(doneOption.id),
    });

    moved.push(issueNumber);
  }

  console.log(
    JSON.stringify({
      status: 'DONE_SYNC_COMPLETED',
      pull_request: prNumber,
      repo: repoFullName,
      linked_issues: linkedIssues,
      moved_to_done: moved,
      already_done: alreadyDone,
      not_found_in_project: notFound,
      target_status: doneStatus,
    }),
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
