/**
 * POST /clone endpoint - Clone a git project
 */
import { Request, Response } from 'express';
import path from 'path';
import fs from 'fs/promises';
import { isPathAllowed, PathNotAllowedError } from '@automaker/platform';
import { GithubAuthService } from '../../../services/github-auth-service.js';
import { getErrorMessage, logError, logger, execGitCommand } from '../common.js';

export function createCloneHandler() {
    return async (req: Request, res: Response) => {
        try {
            const { repoUrl, parentPath, projectName, token } = req.body;

            if (!repoUrl || !parentPath || !projectName) {
                res.status(400).json({
                    success: false,
                    error: 'repoUrl, parentPath, and projectName are required',
                });
                return;
            }

            const targetDir = path.join(parentPath, projectName);

            // Validate path is allowed
            if (!isPathAllowed(targetDir)) {
                res.status(403).json({
                    success: false,
                    error: `Path not allowed: ${targetDir}`,
                });
                return;
            }

            // Check if directory exists
            try {
                await fs.access(targetDir);
                res.status(400).json({
                    success: false,
                    error: `Directory already exists: ${targetDir}`,
                });
                return;
            } catch {
                // Directory doesn't exist, proceed
            }

            logger.info(`Cloning ${repoUrl} to ${targetDir}`);

            // If no explicit token provided, fall back to environment variable
            const effectiveToken = token || process.env.GITHUB_TOKEN;
            if (!effectiveToken) {
                logger.warn('No authentication token found. Cloning private repositories may fail.');
            }

            // Perform clone
            await execGitCommand(['clone', repoUrl, targetDir], parentPath, { token });

            // If token was provided, save it for future operations
            if (token) {
                try {
                    const authService = GithubAuthService.getInstance();
                    await authService.setToken(targetDir, token);
                    logger.info(`Saved GitHub token for project: ${targetDir}`);
                } catch (error) {
                    logger.error('Failed to save GitHub token:', error);
                    // Don't fail the request if token saving fails, but log it
                }
            }

            res.json({
                success: true,
                path: targetDir,
                name: projectName
            });
        } catch (error) {
            logError(error, 'Failed to clone repository');
            res.status(500).json({
                success: false,
                error: getErrorMessage(error)
            });
        }
    };
}
