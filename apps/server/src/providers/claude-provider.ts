/**
 * Claude Provider - Executes queries using Claude Agent SDK
 *
 * Wraps the @anthropic-ai/claude-agent-sdk for seamless integration
 * with the provider architecture.
 *
 * Supports authentication via:
 * 1. ~/.claude/settings.json - Loads env variables from settings file
 * 2. Claude CLI (via claude login) - uses OAuth tokens from ~/.claude/
 * 3. Anthropic API Key - via ANTHROPIC_API_KEY env var or in-memory storage
 */

import { query, type Options } from '@anthropic-ai/claude-agent-sdk';
import { BaseProvider } from './base-provider.js';
import { classifyError, getUserFriendlyErrorMessage, createLogger } from '@automaker/utils';

const logger = createLogger('ClaudeProvider');
import { getThinkingTokenBudget, validateBareModelId } from '@automaker/types';
import type {
  ExecuteOptions,
  ProviderMessage,
  InstallationStatus,
  ModelDefinition,
} from './types.js';
import { getSettingsEnv, hasSettingsFileAuth } from '../lib/claude-settings.js';

/**
 * Helper to get Anthropic API key from in-memory storage.
 * Used as fallback when no env var or settings file is available.
 */
function getInMemoryApiKey(): string | undefined {
  // Try dynamic import of in-memory storage
  try {
    // Dynamic import to avoid circular dependency
    const setupCommon = require('../routes/setup/common.js');
    const apiKey = setupCommon.getApiKey?.('anthropic');
    if (apiKey) {
      return apiKey;
    }
  } catch {
    // Setup routes not available
  }

  return undefined;
}

// Explicit allowlist of environment variables to pass to the SDK.
// Only these vars are passed - nothing else from process.env leaks through.
const ALLOWED_ENV_VARS = [
  'ANTHROPIC_API_KEY',
  'PATH',
  'HOME',
  'SHELL',
  'TERM',
  'USER',
  'LANG',
  'LC_ALL',
];

/**
 * Build environment for the SDK with only explicitly allowed variables
 */
function buildEnv(): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = {};
  for (const key of ALLOWED_ENV_VARS) {
    if (process.env[key]) {
      env[key] = process.env[key];
    }
  }
  return env;
}

export class ClaudeProvider extends BaseProvider {
  getName(): string {
    return 'claude';
  }

  /**
   * Execute a query using Claude Agent SDK
   *
   * Loads environment variables from ~/.claude/settings.json if available.
   * This allows the SDK to use authentication tokens and other settings.
   */
  async *executeQuery(options: ExecuteOptions): AsyncGenerator<ProviderMessage> {
    // Validate that model doesn't have a provider prefix
    // AgentService should strip prefixes before passing to providers
    validateBareModelId(options.model, 'ClaudeProvider');

    const {
      prompt,
      model,
      cwd,
      systemPrompt,
      maxTurns = 20,
      allowedTools,
      abortController,
      conversationHistory,
      sdkSessionId,
      thinkingLevel,
    } = options;

    // Convert thinking level to token budget
    const maxThinkingTokens = getThinkingTokenBudget(thinkingLevel);

    // Track original environment to restore later
    const originalEnv: Record<string, string | undefined> = {};
    const envKeysToRestore: string[] = [];

    // Load settings from ~/.claude/settings.json
    const settingsEnv = await getSettingsEnv();

    // Set environment variables from settings file if available
    if (settingsEnv) {
      for (const [key, value] of Object.entries(settingsEnv)) {
        // Save original value if it exists
        if (key in process.env) {
          originalEnv[key] = process.env[key];
        }
        envKeysToRestore.push(key);
        // Set the environment variable
        process.env[key] = value;
      }
      // Map ANTHROPIC_AUTH_TOKEN to ANTHROPIC_API_KEY if present
      if (settingsEnv.ANTHROPIC_AUTH_TOKEN && !settingsEnv.ANTHROPIC_API_KEY) {
        if ('ANTHROPIC_API_KEY' in process.env) {
          originalEnv.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
        }
        if (!envKeysToRestore.includes('ANTHROPIC_API_KEY')) {
          envKeysToRestore.push('ANTHROPIC_API_KEY');
        }
        process.env.ANTHROPIC_API_KEY = settingsEnv.ANTHROPIC_AUTH_TOKEN;
      }
    }

    // If no API key env var is set yet (from settings or original env), try in-memory storage
    if (!process.env.ANTHROPIC_API_KEY) {
      const inMemoryApiKey = getInMemoryApiKey();
      if (inMemoryApiKey) {
        originalEnv.ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
        envKeysToRestore.push('ANTHROPIC_API_KEY');
        process.env.ANTHROPIC_API_KEY = inMemoryApiKey;
      }
    }

    // Build Claude SDK options
    const defaultTools = ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash', 'WebSearch', 'WebFetch'];
    const toolsToUse = allowedTools || defaultTools;

    // Build Claude SDK options
    const sdkOptions: Options = {
      model,
      systemPrompt,
      maxTurns,
      cwd,
      // Pass only explicitly allowed environment variables to SDK
      env: buildEnv(),
      // Pass through allowedTools if provided by caller (decided by sdk-options.ts)
      ...(allowedTools && { allowedTools }),
      // AUTONOMOUS MODE: Always bypass permissions for fully autonomous operation
      permissionMode: 'bypassPermissions',
      allowDangerouslySkipPermissions: true,
      abortController,
      // Resume existing SDK session if we have a session ID
      ...(sdkSessionId && conversationHistory && conversationHistory.length > 0
        ? { resume: sdkSessionId }
        : {}),
      // Forward settingSources for CLAUDE.md file loading
      ...(options.settingSources && { settingSources: options.settingSources }),
      // Forward MCP servers configuration
      ...(options.mcpServers && { mcpServers: options.mcpServers }),
      // Extended thinking configuration
      ...(maxThinkingTokens && { maxThinkingTokens }),
      // Subagents configuration for specialized task delegation
      ...(options.agents && { agents: options.agents }),
    };

    // Build prompt payload
    let promptPayload: string | AsyncIterable<any>;

    if (Array.isArray(prompt)) {
      // Multi-part prompt (with images)
      promptPayload = (async function* () {
        const multiPartPrompt = {
          type: 'user' as const,
          session_id: '',
          message: {
            role: 'user' as const,
            content: prompt,
          },
          parent_tool_use_id: null,
        };
        yield multiPartPrompt;
      })();
    } else {
      // Simple text prompt
      promptPayload = prompt;
    }

    // Execute via Claude Agent SDK
    try {
      const stream = query({ prompt: promptPayload, options: sdkOptions });

      // Stream messages directly - they're already in the correct format
      for await (const msg of stream) {
        yield msg as ProviderMessage;
      }
    } catch (error) {
      // Enhance error with user-friendly message and classification
      const errorInfo = classifyError(error);
      const userMessage = getUserFriendlyErrorMessage(error);

      logger.error('executeQuery() error during execution:', {
        type: errorInfo.type,
        message: errorInfo.message,
        isRateLimit: errorInfo.isRateLimit,
        retryAfter: errorInfo.retryAfter,
        stack: (error as Error).stack,
      });

      // Build enhanced error message with additional guidance for rate limits
      const message = errorInfo.isRateLimit
        ? `${userMessage}\n\nTip: If you're running multiple features in auto-mode, consider reducing concurrency (maxConcurrency setting) to avoid hitting rate limits.`
        : userMessage;

      const enhancedError = new Error(message);
      (enhancedError as any).originalError = error;
      (enhancedError as any).type = errorInfo.type;

      if (errorInfo.isRateLimit) {
        (enhancedError as any).retryAfter = errorInfo.retryAfter;
      }

      throw enhancedError;
    } finally {
      // Restore original environment
      for (const key of envKeysToRestore) {
        if (originalEnv[key] !== undefined) {
          process.env[key] = originalEnv[key];
        } else {
          delete process.env[key];
        }
      }
    }
  }

  /**
   * Detect Claude SDK installation (always available via npm)
   */
  async detectInstallation(): Promise<InstallationStatus> {
    // Claude SDK is always available since it's a dependency
    // Check for authentication from multiple sources
    const hasEnvApiKey = !!process.env.ANTHROPIC_API_KEY;
    const hasInMemoryApiKey = !!getInMemoryApiKey();
    const hasSettingsAuth = await hasSettingsFileAuth();

    // Authenticated if we have any auth source
    const authenticated = hasEnvApiKey || hasInMemoryApiKey || hasSettingsAuth;

    const status: InstallationStatus = {
      installed: true,
      method: 'sdk',
      hasApiKey: hasEnvApiKey || hasInMemoryApiKey,
      authenticated,
      // Additional info about auth method
      authMethod: hasSettingsAuth
        ? 'settings_file'
        : hasEnvApiKey || hasInMemoryApiKey
          ? 'api_key'
          : 'none',
    } as unknown as InstallationStatus;

    return status;
  }

  /**
   * Get available Claude models
   */
  getAvailableModels(): ModelDefinition[] {
    const models = [
      {
        id: 'claude-opus-4-5-20251101',
        name: 'Claude Opus 4.5',
        modelString: 'claude-opus-4-5-20251101',
        provider: 'anthropic',
        description: 'Most capable Claude model',
        contextWindow: 200000,
        maxOutputTokens: 16000,
        supportsVision: true,
        supportsTools: true,
        tier: 'premium' as const,
        default: true,
      },
      {
        id: 'claude-sonnet-4-20250514',
        name: 'Claude Sonnet 4',
        modelString: 'claude-sonnet-4-20250514',
        provider: 'anthropic',
        description: 'Balanced performance and cost',
        contextWindow: 200000,
        maxOutputTokens: 16000,
        supportsVision: true,
        supportsTools: true,
        tier: 'standard' as const,
      },
      {
        id: 'claude-3-5-sonnet-20241022',
        name: 'Claude 3.5 Sonnet',
        modelString: 'claude-3-5-sonnet-20241022',
        provider: 'anthropic',
        description: 'Fast and capable',
        contextWindow: 200000,
        maxOutputTokens: 8000,
        supportsVision: true,
        supportsTools: true,
        tier: 'standard' as const,
      },
      {
        id: 'claude-haiku-4-5-20251001',
        name: 'Claude Haiku 4.5',
        modelString: 'claude-haiku-4-5-20251001',
        provider: 'anthropic',
        description: 'Fastest Claude model',
        contextWindow: 200000,
        maxOutputTokens: 8000,
        supportsVision: true,
        supportsTools: true,
        tier: 'basic' as const,
      },
    ] satisfies ModelDefinition[];
    return models;
  }

  /**
   * Check if the provider supports a specific feature
   */
  supportsFeature(feature: string): boolean {
    const supportedFeatures = ['tools', 'text', 'vision', 'thinking'];
    return supportedFeatures.includes(feature);
  }
}
