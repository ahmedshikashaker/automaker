import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { createLogger } from '@automaker/utils';
import * as secureFs from '../lib/secure-fs.js';

const logger = createLogger('GithubAuthService');

interface AuthConfig {
    projects: Record<string, string>; // path -> token
}

export class GithubAuthService {
    private static instance: GithubAuthService;
    private configPath: string;
    private config: AuthConfig = { projects: {} };
    private loaded = false;

    private constructor() {
        this.configPath = path.join(os.homedir(), '.automaker', 'github-tokens.json');
    }

    static getInstance(): GithubAuthService {
        if (!GithubAuthService.instance) {
            GithubAuthService.instance = new GithubAuthService();
        }
        return GithubAuthService.instance;
    }

    private async loadConfig(): Promise<void> {
        if (this.loaded) return;

        try {
            try {
                await secureFs.access(this.configPath);
                const content = await fs.readFile(this.configPath, 'utf-8');
                this.config = JSON.parse(content);
            } catch {
                // File doesn't exist or not accessible
                this.config = { projects: {} };
            }
        } catch (error) {
            logger.error('Failed to load GitHub auth config:', error);
            // Initialize with empty config
            this.config = { projects: {} };
        }
        this.loaded = true;
    }

    private async saveConfig(): Promise<void> {
        try {
            const dir = path.dirname(this.configPath);
            // Always try to ensure directory exists
            try {
                await secureFs.mkdir(dir, { recursive: true });
            } catch (error) {
                // Ignore if it already exists, otherwise log
                if ((error as any).code !== 'EEXIST') {
                    logger.warn(`Failed to create directory ${dir}:`, error);
                }
            }

            await fs.writeFile(this.configPath, JSON.stringify(this.config, null, 2), { mode: 0o600 });
            logger.info(`Saved GitHub auth config to ${this.configPath}`);
        } catch (error) {
            logger.error('Failed to save GitHub auth config:', error);
            throw error;
        }
    }

    /**
     * Set authentication token for a project
     */
    async setToken(projectPath: string, token: string): Promise<void> {
        await this.loadConfig();
        this.config.projects[projectPath] = token;
        await this.saveConfig();
    }

    /**
     * Remove authentication token for a project
     */
    async removeToken(projectPath: string): Promise<void> {
        await this.loadConfig();
        if (this.config.projects[projectPath]) {
            delete this.config.projects[projectPath];
            await this.saveConfig();
        }
    }

    /**
     * Get token for a specific path directly
     */
    async getToken(projectPath: string): Promise<string | null> {
        await this.loadConfig();
        return this.config.projects[projectPath] || process.env.GITHUB_TOKEN || null;
    }

    /**
     * Find the closest token for a path (checking parent directories)
     * This allows sub-directories or worktrees to inherit auth from the project root
     */
    async findTokenForPath(targetPath: string): Promise<string | null> {
        await this.loadConfig();

        // Check exact match first
        if (this.config.projects[targetPath]) {
            return this.config.projects[targetPath];
        }

        // Check parents
        // We sort keys by length descending to find the most specific match first
        const projectPaths = Object.keys(this.config.projects).sort((a, b) => b.length - a.length);

        for (const p of projectPaths) {
            // Check if targetPath starts with p AND strictly is a subdirectory (guards against partial name matches)
            // e.g. /foo/bar matches /foo, but /foo-bar does NOT match /foo
            if (targetPath.startsWith(p) && (targetPath.length === p.length || targetPath[p.length] === path.sep)) {
                return this.config.projects[p];
            }
        }

        return process.env.GITHUB_TOKEN || null;
    }
}
