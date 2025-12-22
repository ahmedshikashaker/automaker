/**
 * Worktree Manager - Git worktree operations for feature isolation
 *
 * Handles finding and resolving git worktrees for feature branches.
 * Worktrees are created when features are added/edited, this service
 * finds existing worktrees for execution.
 */

import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';
import { createLogger } from '@automaker/utils';

const execAsync = promisify(exec);
const logger = createLogger('WorktreeManager');

/**
 * Result of resolving a working directory
 */
export interface WorkDirResult {
  /** The resolved working directory path */
  workDir: string;
  /** The worktree path if using a worktree, null otherwise */
  worktreePath: string | null;
}

/**
 * Manages git worktree operations for feature isolation
 */
export class WorktreeManager {
  /**
   * Find existing worktree path for a branch
   *
   * Parses `git worktree list --porcelain` output to find the worktree
   * associated with a specific branch.
   *
   * @param projectPath - The main project path
   * @param branchName - The branch to find a worktree for
   * @returns The absolute path to the worktree, or null if not found
   */
  async findWorktreeForBranch(projectPath: string, branchName: string): Promise<string | null> {
    try {
      const { stdout } = await execAsync('git worktree list --porcelain', {
        cwd: projectPath,
      });

      const lines = stdout.split('\n');
      let currentPath: string | null = null;
      let currentBranch: string | null = null;

      for (const line of lines) {
        if (line.startsWith('worktree ')) {
          currentPath = line.slice(9);
        } else if (line.startsWith('branch ')) {
          currentBranch = line.slice(7).replace('refs/heads/', '');
        } else if (line === '' && currentPath && currentBranch) {
          // End of a worktree entry
          if (currentBranch === branchName) {
            // Resolve to absolute path - git may return relative paths
            // On Windows, this is critical for cwd to work correctly
            const resolvedPath = path.isAbsolute(currentPath)
              ? path.resolve(currentPath)
              : path.resolve(projectPath, currentPath);
            return resolvedPath;
          }
          currentPath = null;
          currentBranch = null;
        }
      }

      // Check the last entry (if file doesn't end with newline)
      if (currentPath && currentBranch && currentBranch === branchName) {
        const resolvedPath = path.isAbsolute(currentPath)
          ? path.resolve(currentPath)
          : path.resolve(projectPath, currentPath);
        return resolvedPath;
      }

      return null;
    } catch (error) {
      logger.warn(`Failed to find worktree for branch ${branchName}`, error);
      return null;
    }
  }

  /**
   * Resolve the working directory for feature execution
   *
   * If worktrees are enabled and a branch name is provided, attempts to
   * find an existing worktree. Falls back to the project path if no
   * worktree is found.
   *
   * @param projectPath - The main project path
   * @param branchName - Optional branch name to look for
   * @param useWorktrees - Whether to use worktrees
   * @returns The resolved work directory and worktree path
   */
  async resolveWorkDir(
    projectPath: string,
    branchName: string | undefined,
    useWorktrees: boolean
  ): Promise<WorkDirResult> {
    let worktreePath: string | null = null;

    if (useWorktrees && branchName) {
      worktreePath = await this.findWorktreeForBranch(projectPath, branchName);

      if (worktreePath) {
        logger.info(`Using worktree for branch "${branchName}": ${worktreePath}`);
      } else {
        logger.warn(`Worktree for branch "${branchName}" not found, using project path`);
      }
    }

    const workDir = worktreePath ? path.resolve(worktreePath) : path.resolve(projectPath);

    return { workDir, worktreePath };
  }

  /**
   * Check if a path is a valid worktree
   *
   * @param worktreePath - Path to check
   * @returns True if the path is a valid git worktree
   */
  async isValidWorktree(worktreePath: string): Promise<boolean> {
    try {
      // Check if .git file exists (worktrees have a .git file, not directory)
      const { stdout } = await execAsync('git rev-parse --is-inside-work-tree', {
        cwd: worktreePath,
      });
      return stdout.trim() === 'true';
    } catch {
      return false;
    }
  }

  /**
   * Get the branch name for a worktree
   *
   * @param worktreePath - Path to the worktree
   * @returns The branch name or null if not a valid worktree
   */
  async getWorktreeBranch(worktreePath: string): Promise<string | null> {
    try {
      const { stdout } = await execAsync('git rev-parse --abbrev-ref HEAD', {
        cwd: worktreePath,
      });
      return stdout.trim();
    } catch {
      return null;
    }
  }
}

// Export a singleton instance for convenience
export const worktreeManager = new WorktreeManager();
