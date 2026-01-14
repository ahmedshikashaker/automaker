import type { Request, Response } from 'express';
import { GithubAuthService } from '../../../services/github-auth-service.js';
import { getErrorMessage, logError } from './common.js';

/**
 * POST /auth endpoint - Set GitHub token for a project
 */
export function createSetAuthHandler() {
    return async (req: Request, res: Response): Promise<void> => {
        try {
            const { projectPath, token } = req.body;

            if (!projectPath || !token) {
                res.status(400).json({ success: false, error: 'projectPath and token are required' });
                return;
            }

            const authService = GithubAuthService.getInstance();
            await authService.setToken(projectPath, token);

            res.json({ success: true });
        } catch (error) {
            logError(error, 'Failed to set GitHub token');
            res.status(500).json({ success: false, error: getErrorMessage(error) });
        }
    };
}

/**
 * GET /auth endpoint - Check if project has a GitHub token
 */
export function createGetAuthHandler() {
    return async (req: Request, res: Response): Promise<void> => {
        try {
            const { projectPath } = req.query as { projectPath: string };

            if (!projectPath) {
                res.status(400).json({ success: false, error: 'projectPath is required' });
                return;
            }

            const authService = GithubAuthService.getInstance();
            const token = await authService.getToken(projectPath);

            res.json({
                success: true,
                hasToken: !!token
            });
        } catch (error) {
            logError(error, 'Failed to check GitHub token');
            res.status(500).json({ success: false, error: getErrorMessage(error) });
        }
    };
}

/**
 * DELETE /auth endpoint - Remove GitHub token for a project
 */
export function createRemoveAuthHandler() {
    return async (req: Request, res: Response): Promise<void> => {
        try {
            const { projectPath } = req.body;

            if (!projectPath) {
                res.status(400).json({ success: false, error: 'projectPath is required' });
                return;
            }

            const authService = GithubAuthService.getInstance();
            await authService.removeToken(projectPath);

            res.json({ success: true });
        } catch (error) {
            logError(error, 'Failed to remove GitHub token');
            res.status(500).json({ success: false, error: getErrorMessage(error) });
        }
    };
}
