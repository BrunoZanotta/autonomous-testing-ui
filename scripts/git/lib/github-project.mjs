import { normalizeStatus, requireCommand, run, safeJsonParse } from '../../lib/cli.mjs';

function isCiTokenMode() {
  return Boolean(process.env.GH_TOKEN || process.env.GITHUB_TOKEN);
}

function parseAuthOutput() {
  const auth = run('gh', ['auth', 'status'], { allowFailure: true });
  return {
    ok: auth.ok,
    output: `${auth.stdout}\n${auth.stderr}`.trim(),
  };
}

export function ensureGhAuthenticated({ requireProjectRead = false, requireProjectWrite = false } = {}) {
  requireCommand('gh');

  const { ok, output } = parseAuthOutput();

  if (/not logged into/i.test(output)) {
    throw new Error('error: gh is not authenticated. Run: gh auth login');
  }

  if (!ok && !isCiTokenMode()) {
    throw new Error(`error: unable to validate gh authentication.\n${output}`);
  }

  if (isCiTokenMode()) {
    return;
  }

  if (requireProjectWrite && !/Token scopes:.*\bproject\b/i.test(output)) {
    throw new Error('error: missing GitHub Project write scope (project).\nrun: gh auth refresh -s project');
  }

  if (requireProjectRead && !/Token scopes:.*\b(read:project|project)\b/i.test(output)) {
    throw new Error('error: missing GitHub Project scope (read:project/project).\nrun: gh auth refresh -s read:project -s project');
  }
}

function shouldRetry(stderr) {
  return /(timeout|timed out|temporar|connection reset|502|503|504|eof|tls|rate limit|service unavailable)/i.test(stderr);
}

export function ghGraphql(query, variables = {}, { retries = 2 } = {}) {
  const args = ['api', 'graphql', '-f', `query=${query}`];

  for (const [key, value] of Object.entries(variables)) {
    if (typeof value === 'number' || typeof value === 'boolean') {
      args.push('-F', `${key}=${value}`);
    } else {
      args.push('-f', `${key}=${value}`);
    }
  }

  let lastError = null;
  const maxAttempts = Math.max(1, retries + 1);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const result = run('gh', args, { allowFailure: true });
    if (result.ok) {
      const parsed = safeJsonParse(result.stdout);
      if (!parsed) {
        throw new Error('error: failed to parse JSON response from gh GraphQL API.');
      }
      return parsed;
    }

    lastError = result.stderr || result.stdout || `GraphQL request failed (attempt ${attempt}/${maxAttempts}).`;

    if (attempt < maxAttempts && shouldRetry(lastError)) {
      continue;
    }
    break;
  }

  throw new Error(lastError || 'error: GraphQL request failed.');
}

function pickProjectNode(data) {
  return data?.repositoryOwner?.projectV2 ?? null;
}

export function getProjectNodeFromResponse(response, owner, projectNumber) {
  const project = pickProjectNode(response?.data);
  if (!project) {
    throw new Error(`error: project not found for owner '${owner}' and number '${projectNumber}'`);
  }
  return project;
}

export function findStatusField(project) {
  const fields = Array.isArray(project?.fields?.nodes) ? project.fields.nodes : [];
  const statusField = fields.find((field) => normalizeStatus(field?.name) === 'status' && Array.isArray(field?.options));

  if (!statusField) {
    throw new Error('error: status field not found in project');
  }

  return statusField;
}

export function matchStatusOption(statusField, requestedStatus) {
  const options = Array.isArray(statusField?.options) ? statusField.options : [];
  const normalizedRequested = normalizeStatus(requestedStatus);

  const exact = options.find((option) => normalizeStatus(option?.name) === normalizedRequested);
  if (exact) {
    return exact;
  }

  return null;
}

export function describeStatusOptions(statusField) {
  return (statusField?.options ?? []).map((option) => option?.name).filter(Boolean);
}

export const PROJECT_READY_QUERY = `
query($owner:String!, $number:Int!) {
  repositoryOwner(login:$owner) {
    ... on User {
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
    ... on Organization {
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
  }
}`;

export const PROJECT_STATUS_FIELDS_QUERY = `
query($owner:String!, $number:Int!) {
  repositoryOwner(login:$owner) {
    ... on User {
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
    ... on Organization {
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
  }
}`;

export const MOVE_ITEM_MUTATION = `
mutation($project:ID!, $item:ID!, $field:ID!, $option:String!) {
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
}`;
