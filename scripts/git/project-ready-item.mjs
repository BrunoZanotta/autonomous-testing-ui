#!/usr/bin/env node
import process from 'node:process';
import { normalizeStatus } from '../lib/cli.mjs';
import {
  PROJECT_READY_QUERY,
  ensureGhAuthenticated,
  findStatusField,
  getProjectNodeFromResponse,
  ghGraphql,
} from './lib/github-project.mjs';

function usage() {
  console.error('usage: node scripts/git/project-ready-item.mjs <owner> <project_number> [repo_full_name] [ready_status]');
}

const owner = process.argv[2] ?? '';
const projectNumberRaw = process.argv[3] ?? '';
const repoFilter = process.argv[4] ?? '';
const readyStatus = process.argv[5] ?? 'Ready';

if (!owner || !projectNumberRaw) {
  usage();
  process.exit(1);
}

const projectNumber = Number.parseInt(projectNumberRaw, 10);
if (!Number.isInteger(projectNumber) || projectNumber <= 0) {
  console.error(`error: invalid project number '${projectNumberRaw}'`);
  process.exit(1);
}

function printNoWork(message) {
  console.log(JSON.stringify({ status: 'NO_WORK', message }));
}

function getItemStatusName(item) {
  const nodes = Array.isArray(item?.fieldValues?.nodes) ? item.fieldValues.nodes : [];
  const statusNode = nodes.find((node) => normalizeStatus(node?.field?.name) === 'status');
  return statusNode?.name ?? '';
}

function toWorkType(labels) {
  const normalized = labels.map((label) => normalizeStatus(label));
  if (normalized.some((label) => label === 'bug' || label === 'bugfix')) {
    return { workType: 'bugfix', source: 'label' };
  }
  if (normalized.some((label) => label === 'newtest')) {
    return { workType: 'newTest', source: 'label' };
  }

  return null;
}

function inferWorkTypeFromText(title, body) {
  const text = `${title ?? ''} ${body ?? ''}`.toLowerCase();
  if (/(^|\\W)(bug|erro|falha|fix|corrig|defect|hotfix|quebrad|broken|regress)(\\W|$)/.test(text)) {
    return { workType: 'bugfix', source: 'inferred' };
  }
  return { workType: 'newTest', source: 'default' };
}

function toPriority(labels) {
  const normalized = labels.map((label) => normalizeStatus(label));
  if (normalized.includes('p0')) {
    return 'P0';
  }
  if (normalized.includes('p1')) {
    return 'P1';
  }
  if (normalized.includes('p2')) {
    return 'P2';
  }
  return 'NONE';
}

function priorityRank(priority) {
  if (priority === 'P0') return 0;
  if (priority === 'P1') return 1;
  if (priority === 'P2') return 2;
  return 9;
}

function workTypeRank(workType) {
  if (workType === 'bugfix') return 0;
  if (workType === 'newTest') return 1;
  return 9;
}

try {
  ensureGhAuthenticated({ requireProjectRead: true });

  const response = ghGraphql(PROJECT_READY_QUERY, {
    owner,
    number: projectNumber,
  });

  const project = getProjectNodeFromResponse(response, owner, projectNumber);
  const statusField = findStatusField(project);

  const items = Array.isArray(project?.items?.nodes) ? project.items.nodes : [];
  const readyStatusNormalized = normalizeStatus(readyStatus);

  const readyItems = items.filter((item) => {
    const statusName = getItemStatusName(item);
    if (normalizeStatus(statusName) !== readyStatusNormalized) {
      return false;
    }

    if (!repoFilter) {
      return true;
    }

    const type = item?.content?.__typename;
    if (type !== 'Issue' && type !== 'PullRequest') {
      return false;
    }

    return item?.content?.repository?.nameWithOwner === repoFilter;
  });

  if (readyItems.length === 0) {
    printNoWork('No Ready item found.');
    process.exit(2);
  }

  const eligible = readyItems
    .map((item) => {
      const type = item?.content?.__typename ?? 'Unknown';
      const labels = type === 'Issue' || type === 'PullRequest'
        ? (item?.content?.labels?.nodes ?? []).map((node) => node?.name).filter(Boolean)
        : [];

      const workTypeInfo = toWorkType(labels)
        ?? inferWorkTypeFromText(item?.content?.title, item?.content?.body);
      const priority = toPriority(labels);
      const issueNumber = Number.parseInt(String(item?.content?.number ?? ''), 10);

      return {
        item,
        labels,
        workType: workTypeInfo.workType,
        workTypeSource: workTypeInfo.source,
        priority,
        issueNumber: Number.isInteger(issueNumber) ? issueNumber : 999999999,
      };
    })
    .sort((a, b) => {
      const rankDelta = workTypeRank(a.workType) - workTypeRank(b.workType);
      if (rankDelta !== 0) return rankDelta;

      const priorityDelta = priorityRank(a.priority) - priorityRank(b.priority);
      if (priorityDelta !== 0) return priorityDelta;

      const issueDelta = a.issueNumber - b.issueNumber;
      if (issueDelta !== 0) return issueDelta;

      const titleA = String(a.item?.content?.title ?? '');
      const titleB = String(b.item?.content?.title ?? '');
      const titleDelta = titleA.localeCompare(titleB);
      if (titleDelta !== 0) return titleDelta;

      return String(a.item?.id ?? '').localeCompare(String(b.item?.id ?? ''));
    });

  const selected = eligible[0];
  const selectedItem = selected.item;

  const result = {
    status: 'READY_ITEM_FOUND',
    owner,
    project_number: projectNumber,
    project_id: String(project?.id ?? ''),
    status_field_id: String(statusField?.id ?? ''),
    ready_status: readyStatus,
    item_id: String(selectedItem?.id ?? ''),
    content_type: String(selectedItem?.content?.__typename ?? 'Unknown'),
    title: String(selectedItem?.content?.title ?? ''),
    body: String(selectedItem?.content?.body ?? ''),
    content_url: String(selectedItem?.content?.url ?? ''),
    issue_number: selectedItem?.content?.number != null ? String(selectedItem.content.number) : '',
    repository: String(selectedItem?.content?.repository?.nameWithOwner ?? ''),
    work_type: selected.workType,
    work_type_source: selected.workTypeSource,
    priority_label: selected.priority,
    labels: selected.labels,
  };

  console.log(JSON.stringify(result));
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
