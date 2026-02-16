#!/usr/bin/env node
import process from 'node:process';
import {
  MOVE_ITEM_MUTATION,
  PROJECT_STATUS_FIELDS_QUERY,
  describeStatusOptions,
  ensureGhAuthenticated,
  findStatusField,
  getProjectNodeFromResponse,
  ghGraphql,
  matchStatusOption,
} from './lib/github-project.mjs';

function usage() {
  console.error('usage: node scripts/git/project-move-item.mjs <owner> <project_number> <item_id> <target_status>');
}

const owner = process.argv[2] ?? '';
const projectNumberRaw = process.argv[3] ?? '';
const itemId = process.argv[4] ?? '';
const targetStatus = process.argv[5] ?? '';

if (!owner || !projectNumberRaw || !itemId || !targetStatus) {
  usage();
  process.exit(1);
}

const projectNumber = Number.parseInt(projectNumberRaw, 10);
if (!Number.isInteger(projectNumber) || projectNumber <= 0) {
  console.error(`error: invalid project number '${projectNumberRaw}'`);
  process.exit(1);
}

try {
  ensureGhAuthenticated({ requireProjectWrite: true });

  const response = ghGraphql(PROJECT_STATUS_FIELDS_QUERY, {
    owner,
    number: projectNumber,
  });

  const project = getProjectNodeFromResponse(response, owner, projectNumber);
  const statusField = findStatusField(project);
  const targetOption = matchStatusOption(statusField, targetStatus);

  if (!targetOption) {
    const options = describeStatusOptions(statusField);
    throw new Error(`error: target status '${targetStatus}' not found in project status options. Available: ${options.join(', ')}`);
  }

  const mutationResponse = ghGraphql(MOVE_ITEM_MUTATION, {
    project: String(project.id),
    item: itemId,
    field: String(statusField.id),
    option: String(targetOption.id),
  });

  const updatedId = mutationResponse?.data?.updateProjectV2ItemFieldValue?.projectV2Item?.id;
  if (!updatedId) {
    throw new Error(`error: failed to move item '${itemId}' to '${targetStatus}'`);
  }

  console.log(
    JSON.stringify({
      status: 'MOVED',
      owner,
      project_number: projectNumber,
      item_id: itemId,
      target_status: targetOption.name,
    }),
  );
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
