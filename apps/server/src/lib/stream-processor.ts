/**
 * Stream Processor - Unified stream handling for provider messages
 *
 * Eliminates duplication of the stream processing pattern that was
 * repeated 4x in auto-mode-service.ts (main execution, revision,
 * task execution, continuation).
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
 * This eliminates the repeated pattern of:
 * ```
 * for await (const msg of stream) {
 *   if (msg.type === 'assistant' && msg.message?.content) {
 *     for (const block of msg.message.content) {
 *       if (block.type === 'text') { ... }
 *       else if (block.type === 'tool_use') { ... }
 *     }
 *   } else if (msg.type === 'error') { ... }
 *   else if (msg.type === 'result') { ... }
 * }
 * ```
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
 *
 * Useful for cases where you just need the final text output
 * without any side effects during streaming.
 */
export async function collectStreamText(stream: AsyncGenerator<ProviderMessage>): Promise<string> {
  const result = await processStream(stream, {});
  return result.text;
}

/**
 * Process stream with progress callback
 *
 * Simplified interface for the common case of just wanting
 * text updates during streaming.
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
 *
 * Useful for detecting spec generation markers like [SPEC_GENERATED]
 */
export function hasMarker(result: StreamResult, marker: string): boolean {
  return result.text.includes(marker);
}

/**
 * Extract content before a marker
 *
 * Useful for extracting spec content before [SPEC_GENERATED] marker
 */
export function extractBeforeMarker(text: string, marker: string): string | null {
  const index = text.indexOf(marker);
  if (index === -1) {
    return null;
  }
  return text.substring(0, index).trim();
}
