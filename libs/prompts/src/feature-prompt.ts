/**
 * Feature Prompt - Prompt building for feature implementation
 *
 * Contains utilities for building prompts from Feature objects.
 */

import type { Feature } from '@automaker/types';

/**
 * Extract a title from feature description
 *
 * Takes the first line of the description and truncates if needed.
 *
 * @param description - The feature description
 * @returns A title string (max 60 chars)
 */
export function extractTitleFromDescription(description: string): string {
  if (!description?.trim()) {
    return 'Untitled Feature';
  }

  const firstLine = description.split('\n')[0].trim();
  return firstLine.length <= 60 ? firstLine : firstLine.substring(0, 57) + '...';
}

/**
 * Build a feature implementation prompt
 *
 * Creates a structured prompt for the AI agent to implement a feature.
 *
 * @param feature - The feature to build a prompt for
 * @returns The formatted prompt string
 */
export function buildFeaturePrompt(feature: Feature): string {
  const title = extractTitleFromDescription(feature.description);

  let prompt = `## Feature Implementation Task

**Feature ID:** ${feature.id}
**Title:** ${title}
**Description:** ${feature.description}
`;

  if (feature.spec) {
    prompt += `\n**Specification:**\n${feature.spec}\n`;
  }

  if (feature.imagePaths && feature.imagePaths.length > 0) {
    const imagesList = feature.imagePaths
      .map((img, idx) => {
        const imgPath = typeof img === 'string' ? img : img.path;
        const filename =
          typeof img === 'string'
            ? imgPath.split('/').pop()
            : (img as { filename?: string }).filename || imgPath.split('/').pop();
        return `   ${idx + 1}. ${filename}\n      Path: ${imgPath}`;
      })
      .join('\n');

    prompt += `\n**Context Images Attached:**\n${imagesList}\n`;
  }

  if (feature.skipTests) {
    prompt += `
## Instructions

Implement this feature by:
1. Explore the codebase to understand the existing structure
2. Plan your implementation approach
3. Write the necessary code changes
4. Ensure the code follows existing patterns

When done, wrap your final summary in <summary> tags.`;
  } else {
    prompt += `
## Instructions

Implement and verify this feature:
1. Explore the codebase
2. Plan your approach
3. Write the code changes
4. Verify with Playwright tests

When done, wrap your final summary in <summary> tags.`;
  }

  return prompt;
}

/**
 * Build a follow-up prompt for continuing work on a feature
 *
 * @param feature - The feature being followed up on
 * @param previousContext - Previous agent work context
 * @param followUpInstructions - New instructions from user
 * @returns The formatted follow-up prompt
 */
export function buildFollowUpPrompt(
  feature: Feature | null,
  featureId: string,
  previousContext: string,
  followUpInstructions: string
): string {
  let prompt = `## Follow-up on Feature Implementation\n\n`;

  if (feature) {
    prompt += buildFeaturePrompt(feature) + '\n';
  } else {
    prompt += `**Feature ID:** ${featureId}\n`;
  }

  if (previousContext) {
    prompt += `\n## Previous Agent Work\n${previousContext}\n`;
  }

  prompt += `\n## Follow-up Instructions\n${followUpInstructions}\n\n## Task\nAddress the follow-up instructions above.`;

  return prompt;
}

/**
 * Build a continuation prompt for resuming work
 *
 * @param feature - The feature to continue
 * @param context - Previous work context
 * @returns The continuation prompt
 */
export function buildContinuationPrompt(feature: Feature, context: string): string {
  return `## Continuing Feature Implementation

${buildFeaturePrompt(feature)}

## Previous Context
${context}

## Instructions
Review the previous work and continue the implementation.`;
}
