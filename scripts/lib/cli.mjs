import { spawnSync } from 'node:child_process';

export function run(command, args = [], options = {}) {
  const {
    cwd,
    env,
    stdio = 'pipe',
    allowFailure = false,
    trimOutput = true,
    input,
  } = options;

  const result = spawnSync(command, args, {
    cwd,
    env: env ? { ...process.env, ...env } : process.env,
    encoding: 'utf8',
    stdio,
    input,
  });

  const stdout = typeof result.stdout === 'string' ? (trimOutput ? result.stdout.trimEnd() : result.stdout) : '';
  const stderr = typeof result.stderr === 'string' ? (trimOutput ? result.stderr.trimEnd() : result.stderr) : '';

  if (result.error) {
    if (allowFailure) {
      return {
        ok: false,
        code: result.status ?? 1,
        stdout,
        stderr: stderr || result.error.message,
        error: result.error,
      };
    }
    throw new Error(`Failed to run '${command}': ${result.error.message}`);
  }

  const code = result.status ?? 0;
  const ok = code === 0;

  if (!ok && !allowFailure) {
    const details = stderr || stdout || `Exited with status ${code}`;
    const err = new Error(`Command failed: ${command} ${args.join(' ')}\n${details}`);
    err.code = code;
    err.stdout = stdout;
    err.stderr = stderr;
    throw err;
  }

  return {
    ok,
    code,
    stdout,
    stderr,
  };
}

export function runShell(script, options = {}) {
  return run('bash', ['-lc', script], options);
}

export function commandExists(command) {
  const result = runShell(`command -v ${command} >/dev/null 2>&1`, { allowFailure: true });
  return result.ok;
}

export function requireCommand(command, hint = '') {
  if (!commandExists(command)) {
    const suffix = hint ? ` ${hint}` : '';
    throw new Error(`error: required command not found: ${command}${suffix}`);
  }
}

export function normalizeStatus(value) {
  return String(value ?? '')
    .normalize('NFKD')
    .replace(/[^a-zA-Z0-9]+/g, '')
    .toLowerCase();
}

export function safeJsonParse(text, fallback = null) {
  try {
    return JSON.parse(text);
  } catch {
    return fallback;
  }
}
