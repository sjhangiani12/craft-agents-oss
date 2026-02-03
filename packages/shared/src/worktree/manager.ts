/**
 * Git Worktree Manager
 *
 * Manages isolated git worktrees for agent sessions.
 * Each session gets its own worktree with a dedicated branch,
 * enabling parallel work without interference.
 */

import { execFile } from 'child_process';
import { promisify } from 'util';
import { existsSync } from 'fs';
import { mkdir, rm } from 'fs/promises';
import { join, resolve } from 'path';

const execFileAsync = promisify(execFile);

export interface WorktreeInfo {
  path: string;
  branch: string;
  sessionId: string;
  createdAt: number;
  status: 'active' | 'archived' | 'error';
}

export class WorktreeManager {
  private repoRoot: string;
  private worktreeBase: string;

  constructor(repoRoot: string, worktreeBase: string) {
    this.repoRoot = resolve(repoRoot);
    this.worktreeBase = resolve(worktreeBase);
  }

  /**
   * Create a new worktree for a session.
   * Runs: git worktree add <path> -b <branchName> [baseBranch]
   */
  async create(sessionId: string, branchName: string, baseBranch?: string): Promise<WorktreeInfo> {
    const worktreePath = this.getPath(sessionId);

    // Ensure parent directory exists
    await mkdir(this.worktreeBase, { recursive: true });

    const args = ['worktree', 'add', worktreePath, '-b', branchName];
    if (baseBranch) {
      args.push(baseBranch);
    }

    await execFileAsync('git', args, { cwd: this.repoRoot });

    return {
      path: worktreePath,
      branch: branchName,
      sessionId,
      createdAt: Date.now(),
      status: 'active',
    };
  }

  /**
   * List all worktrees managed by this instance.
   * Parses output from: git worktree list --porcelain
   */
  async list(): Promise<WorktreeInfo[]> {
    const { stdout } = await execFileAsync('git', ['worktree', 'list', '--porcelain'], {
      cwd: this.repoRoot,
    });

    const worktrees: WorktreeInfo[] = [];
    const entries = stdout.split('\n\n').filter(Boolean);

    for (const entry of entries) {
      const lines = entry.split('\n');
      let path = '';
      let branch = '';

      for (const line of lines) {
        if (line.startsWith('worktree ')) {
          path = line.slice('worktree '.length);
        } else if (line.startsWith('branch ')) {
          // branch refs/heads/agent/my-branch -> agent/my-branch
          branch = line.slice('branch '.length).replace('refs/heads/', '');
        }
      }

      // Only include worktrees under our managed base directory
      if (path && path.startsWith(this.worktreeBase)) {
        const sessionId = path.slice(this.worktreeBase.length + 1); // strip base + separator
        worktrees.push({
          path,
          branch,
          sessionId,
          createdAt: 0, // Not available from porcelain output
          status: 'active',
        });
      }
    }

    return worktrees;
  }

  /**
   * Remove a worktree and its associated branch.
   * Runs: git worktree remove <path> --force && git branch -D <branch>
   */
  async remove(sessionId: string): Promise<void> {
    const worktreePath = this.getPath(sessionId);

    // Get the branch name before removing
    let branch: string | undefined;
    try {
      const { stdout } = await execFileAsync('git', ['-C', worktreePath, 'rev-parse', '--abbrev-ref', 'HEAD'], {
        cwd: this.repoRoot,
      });
      branch = stdout.trim();
    } catch {
      // Worktree may already be in a bad state
    }

    // Remove the worktree (--force handles uncommitted changes)
    try {
      await execFileAsync('git', ['worktree', 'remove', worktreePath, '--force'], {
        cwd: this.repoRoot,
      });
    } catch {
      // If git worktree remove fails, try manual cleanup
      if (existsSync(worktreePath)) {
        await rm(worktreePath, { recursive: true, force: true });
      }
      // Prune stale worktree references
      await execFileAsync('git', ['worktree', 'prune'], { cwd: this.repoRoot }).catch(() => {});
    }

    // Delete the branch
    if (branch && branch !== 'HEAD') {
      try {
        await execFileAsync('git', ['branch', '-D', branch], { cwd: this.repoRoot });
      } catch {
        // Branch may already be deleted or not exist
      }
    }
  }

  /**
   * Get the git status of a session's worktree.
   * Runs: git -C <path> status --porcelain
   */
  async getStatus(sessionId: string): Promise<{ branch: string; modified: number; untracked: number }> {
    const worktreePath = this.getPath(sessionId);

    const [branchResult, statusResult] = await Promise.all([
      execFileAsync('git', ['-C', worktreePath, 'rev-parse', '--abbrev-ref', 'HEAD']),
      execFileAsync('git', ['-C', worktreePath, 'status', '--porcelain']),
    ]);

    const branch = branchResult.stdout.trim();
    const lines = statusResult.stdout.split('\n').filter(Boolean);

    let modified = 0;
    let untracked = 0;
    for (const line of lines) {
      if (line.startsWith('??')) {
        untracked++;
      } else {
        modified++;
      }
    }

    return { branch, modified, untracked };
  }

  /**
   * Get the diff for a session's worktree.
   * Runs: git -C <path> diff
   */
  async getDiff(sessionId: string): Promise<string> {
    const worktreePath = this.getPath(sessionId);
    const { stdout } = await execFileAsync('git', ['-C', worktreePath, 'diff'], {
      cwd: this.repoRoot,
      maxBuffer: 10 * 1024 * 1024, // 10MB buffer for large diffs
    });
    return stdout;
  }

  /**
   * Get the filesystem path for a session's worktree.
   */
  getPath(sessionId: string): string {
    return join(this.worktreeBase, sessionId);
  }
}
