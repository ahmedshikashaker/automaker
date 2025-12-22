/**
 * Git Commit Utilities - Commit operations for git repositories
 *
 * Provides utilities for staging and committing changes.
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Check if there are uncommitted changes in the working directory
 *
 * @param workDir - The working directory to check
 * @returns True if there are uncommitted changes
 */
export async function hasUncommittedChanges(workDir: string): Promise<boolean> {
  try {
    const { stdout } = await execAsync('git status --porcelain', { cwd: workDir });
    return stdout.trim().length > 0;
  } catch {
    return false;
  }
}

/**
 * Stage all changes and commit with a message
 *
 * @param workDir - The working directory
 * @param message - The commit message
 * @returns The commit hash if successful, null otherwise
 */
export async function commitAll(workDir: string, message: string): Promise<string | null> {
  try {
    // Check for changes first
    const hasChanges = await hasUncommittedChanges(workDir);
    if (!hasChanges) {
      return null;
    }

    // Stage all changes
    await execAsync('git add -A', { cwd: workDir });

    // Commit with message (escape double quotes)
    const escapedMessage = message.replace(/"/g, '\\"');
    await execAsync(`git commit -m "${escapedMessage}"`, { cwd: workDir });

    // Get the commit hash
    const { stdout } = await execAsync('git rev-parse HEAD', { cwd: workDir });
    return stdout.trim();
  } catch {
    return null;
  }
}

/**
 * Get the current HEAD commit hash
 *
 * @param workDir - The working directory
 * @returns The commit hash or null if not a git repo
 */
export async function getHeadHash(workDir: string): Promise<string | null> {
  try {
    const { stdout } = await execAsync('git rev-parse HEAD', { cwd: workDir });
    return stdout.trim();
  } catch {
    return null;
  }
}

/**
 * Get the short version of a commit hash
 *
 * @param hash - The full commit hash
 * @param length - Length of short hash (default 8)
 * @returns The shortened hash
 */
export function shortHash(hash: string, length = 8): string {
  return hash.substring(0, length);
}

/**
 * Run verification commands (lint, typecheck, test, build)
 *
 * @param workDir - The working directory
 * @param checks - Optional custom checks (defaults to npm scripts)
 * @returns Object with success status and failed check name if any
 */
export async function runVerificationChecks(
  workDir: string,
  checks?: Array<{ cmd: string; name: string }>
): Promise<{ success: boolean; failedCheck?: string }> {
  const defaultChecks = [
    { cmd: 'npm run lint', name: 'Lint' },
    { cmd: 'npm run typecheck', name: 'Type check' },
    { cmd: 'npm test', name: 'Tests' },
    { cmd: 'npm run build', name: 'Build' },
  ];

  const checksToRun = checks || defaultChecks;

  for (const check of checksToRun) {
    try {
      await execAsync(check.cmd, { cwd: workDir, timeout: 120000 });
    } catch {
      return { success: false, failedCheck: check.name };
    }
  }

  return { success: true };
}
