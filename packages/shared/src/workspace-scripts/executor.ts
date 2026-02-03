/**
 * Workspace Script Runner
 *
 * Executes lifecycle scripts (setup, archive) defined in .agents.json
 * with workspace-specific environment variables.
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import { resolve } from 'path';

const execFileAsync = promisify(execFile);

export interface WorkspaceEnv {
  /** The worktree path */
  AGENT_WORKSPACE_PATH: string;
  /** Original repo root */
  AGENT_ROOT_PATH: string;
  /** Allocated base port for this agent */
  AGENT_PORT: string;
  /** Session ID */
  AGENT_SESSION_ID: string;
  /** Git branch name */
  AGENT_BRANCH: string;
}

export interface ScriptResult {
  exitCode: number;
  stdout: string;
  stderr: string;
}

/**
 * Run a workspace lifecycle script with the given environment.
 */
export async function runWorkspaceScript(
  scriptPath: string,
  cwd: string,
  env: WorkspaceEnv,
  onOutput?: (line: string) => void,
): Promise<ScriptResult> {
  const resolvedScript = resolve(cwd, scriptPath);

  try {
    const result = await execFileAsync(resolvedScript, [], {
      cwd,
      env: {
        ...process.env,
        ...env,
      },
      timeout: 120_000, // 2 minute timeout for setup scripts
      maxBuffer: 5 * 1024 * 1024, // 5MB buffer
    });

    if (onOutput) {
      for (const line of result.stdout.split('\n')) {
        if (line) onOutput(line);
      }
    }

    return {
      exitCode: 0,
      stdout: result.stdout,
      stderr: result.stderr,
    };
  } catch (error: unknown) {
    const execError = error as { code?: number; stdout?: string; stderr?: string };
    return {
      exitCode: execError.code ?? 1,
      stdout: execError.stdout ?? '',
      stderr: execError.stderr ?? String(error),
    };
  }
}
