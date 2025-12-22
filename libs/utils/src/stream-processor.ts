/**
 * Stream Processor - Unified stream handling for provider messages
 *
 * Eliminates duplication of the stream processing pattern for handling
 * async generators from AI providers.
 */

import type { ProviderMessage, ContentBlock } from '@automaker/types';

/**
 * Callbacks for handling different stream events
 */
export interface StreamHandlers {
  /** Called for each text block in the stream */
  onText?: (text: string) => void | Promise<void>;
  /** Called for each tool use in the stream */
  onToolUse?: (name: string, input: unknown) => void | Promise<void>;
  /** Called when an error occurs in the stream */
  onError?: (error: string) => void | Promise<void>;
  /** Called when the stream completes successfully */
  onComplete?: (result: string) => void | Promise<void>;
  /** Called for thinking blocks (if present) */
  onThinking?: (thinking: string) => void | Promise<void>;
}

/**
 * Result from processing a stream
 */
export interface StreamResult {
  /** All accumulated text from the stream */
  text: string;
  /** Whether the stream completed successfully */
  success: boolean;
  /** Error message if stream failed */
  error?: string;
  /** Final result message if stream completed */
  result?: string;
}

/**
 * Process a provider message stream with unified handling
 *
 * @param stream - The async generator from provider.executeQuery()
 * @param handlers - Callbacks for different event types
 * @returns Accumulated result with text and status
 */
export async function processStream(
  stream: AsyncGenerator<ProviderMessage>,
  handlers: StreamHandlers
): Promise<StreamResult> {
  let accumulatedText = '';
  let success = true;
  let errorMessage: string | undefined;
  let resultMessage: string | undefined;

  try {
    for await (const msg of stream) {
      if (msg.type === 'assistant' && msg.message?.content) {
        for (const block of msg.message.content) {
          await processContentBlock(block, handlers, (text) => {
            accumulatedText += text;
          });
        }
      } else if (msg.type === 'error') {
        success = false;
        errorMessage = msg.error || 'Unknown error';
        if (handlers.onError) {
          await handlers.onError(errorMessage);
        }
        throw new Error(errorMessage);
      } else if (msg.type === 'result' && msg.subtype === 'success') {
        resultMessage = msg.result || '';
        if (handlers.onComplete) {
          await handlers.onComplete(resultMessage);
        }
      }
    }
  } catch (error) {
    if (!errorMessage) {
      success = false;
      errorMessage = error instanceof Error ? error.message : String(error);
    }
    throw error;
  }

  return {
    text: accumulatedText,
    success,
    error: errorMessage,
    result: resultMessage,
  };
}

/**
 * Process a single content block
 */
async function processContentBlock(
  block: ContentBlock,
  handlers: StreamHandlers,
  appendText: (text: string) => void
): Promise<void> {
  switch (block.type) {
    case 'text':
      if (block.text) {
        appendText(block.text);
        if (handlers.onText) {
          await handlers.onText(block.text);
        }
      }
      break;

    case 'tool_use':
      if (block.name && handlers.onToolUse) {
        await handlers.onToolUse(block.name, block.input);
      }
      break;

    case 'thinking':
      if (block.thinking && handlers.onThinking) {
        await handlers.onThinking(block.thinking);
      }
      break;

    // tool_result blocks are handled internally by the SDK
    case 'tool_result':
      break;
  }
}

/**
 * Create a simple stream processor that just collects text
 */
export async function collectStreamText(stream: AsyncGenerator<ProviderMessage>): Promise<string> {
  const result = await processStream(stream, {});
  return result.text;
}

/**
 * Process stream with progress callback
 */
export async function processStreamWithProgress(
  stream: AsyncGenerator<ProviderMessage>,
  onProgress: (text: string) => void
): Promise<StreamResult> {
  return processStream(stream, {
    onText: onProgress,
  });
}

/**
 * Check if a stream result contains a specific marker
 */
export function hasMarker(result: StreamResult, marker: string): boolean {
  return result.text.includes(marker);
}

/**
 * Extract content before a marker
 */
export function extractBeforeMarker(text: string, marker: string): string | null {
  const index = text.indexOf(marker);
  if (index === -1) {
    return null;
  }
  return text.substring(0, index).trim();
}

/**
 * Sleep utility - delay execution for specified milliseconds
 */
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
