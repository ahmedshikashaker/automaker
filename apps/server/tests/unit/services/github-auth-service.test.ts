
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { GithubAuthService } from '@/services/github-auth-service.js';
import fs from 'fs/promises';
import * as secureFs from '@/lib/secure-fs.js';

// Mock dependencies
vi.mock('fs/promises');
vi.mock('@/lib/secure-fs.js');
vi.mock('@automaker/utils', () => ({
    createLogger: () => ({
        error: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
    }),
}));

describe('GithubAuthService', () => {
    let authService: GithubAuthService;
    const originalEnv = process.env;

    beforeEach(() => {
        // Reset singleton instance if possible, or just re-get it.
        // Since it's a singleton, we need to be careful.
        // Ideally we would mock the constructor or instance property, but for now we'll just use the instance
        // and rely on internal state reset if we could, or mocks.
        // In this specific singleton implementation, config is loaded on first call.
        // We can mock loadConfig behavior by mocking fs.readFile.
        authService = GithubAuthService.getInstance();

        // Reset env vars - CRITICAL: create a copy first
        process.env = { ...originalEnv };
        delete process.env.GITHUB_TOKEN;

        // Access private property 'config' and 'loaded' to reset state if possible
        // or just rely on loadConfig being called and we mocking fs.readFile each time.
        // But 'loaded' flag prevents reloading.
        // We can cast to any to reset internal state for testing purposes.
        (authService as any).loaded = false;
        (authService as any).config = { projects: {} };

        vi.resetAllMocks();

        // Mock secureFs.access to succeed by default for config path check
        vi.mocked(secureFs.access).mockResolvedValue(undefined);
    });

    afterEach(() => {
        process.env = originalEnv;
        vi.clearAllMocks();
    });

    describe('getToken', () => {
        it('should return token from config if it exists', async () => {
            const mockConfig = {
                projects: {
                    '/path/to/project': 'project-token'
                }
            };
            vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConfig));

            const token = await authService.getToken('/path/to/project');
            expect(token).toBe('project-token');
        });

        it('should return null if token does not exist in config and no env var', async () => {
            const mockConfig = { projects: {} };
            vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConfig));

            const token = await authService.getToken('/path/to/project');
            expect(token).toBeNull();
        });

        it('should return GITHUB_TOKEN from env if not in config', async () => {
            const mockConfig = { projects: {} };
            vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConfig));
            process.env.GITHUB_TOKEN = 'env-token';

            // Note: This test expects the NEW behavior which is not yet implemented.
            // It will fail until we implement the fallback.
            const token = await authService.getToken('/path/to/project');
            expect(token).toBe('env-token');
        });

        it('should prioritize config token over env var', async () => {
            const mockConfig = {
                projects: {
                    '/path/to/project': 'project-token'
                }
            };
            vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConfig));
            process.env.GITHUB_TOKEN = 'env-token';

            const token = await authService.getToken('/path/to/project');
            expect(token).toBe('project-token');
        });
    });

    describe('findTokenForPath', () => {
        it('should return exact match from config', async () => {
            const mockConfig = {
                projects: {
                    '/path/to/project': 'project-token'
                }
            };
            vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConfig));

            const token = await authService.findTokenForPath('/path/to/project');
            expect(token).toBe('project-token');
        });

        it('should return parent match from config', async () => {
            const mockConfig = {
                projects: {
                    '/path/to': 'parent-token'
                }
            };
            vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConfig));

            const token = await authService.findTokenForPath('/path/to/project');
            expect(token).toBe('parent-token');
        });

        it('should return GITHUB_TOKEN from env if no match in config', async () => {
            const mockConfig = { projects: {} };
            vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConfig));
            process.env.GITHUB_TOKEN = 'env-token';

            const token = await authService.findTokenForPath('/path/to/project');
            expect(token).toBe('env-token');
        });

        it('should prioritize config token (parent) over env var', async () => {
            const mockConfig = {
                projects: {
                    '/path/to': 'parent-token'
                }
            };
            vi.mocked(fs.readFile).mockResolvedValue(JSON.stringify(mockConfig));
            process.env.GITHUB_TOKEN = 'env-token';

            const token = await authService.findTokenForPath('/path/to/project');
            expect(token).toBe('parent-token');
        });
    });
});
