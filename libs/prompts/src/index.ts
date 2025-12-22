/**
 * @automaker/prompts
 * AI prompt templates for AutoMaker
 */

// Enhancement prompts
export {
  IMPROVE_SYSTEM_PROMPT,
  TECHNICAL_SYSTEM_PROMPT,
  SIMPLIFY_SYSTEM_PROMPT,
  ACCEPTANCE_SYSTEM_PROMPT,
  IMPROVE_EXAMPLES,
  TECHNICAL_EXAMPLES,
  SIMPLIFY_EXAMPLES,
  ACCEPTANCE_EXAMPLES,
  getEnhancementPrompt,
  getSystemPrompt,
  getExamples,
  buildUserPrompt,
  isValidEnhancementMode,
  getAvailableEnhancementModes,
} from './enhancement.js';

// Planning prompts (spec-driven development)
export {
  PLANNING_PROMPTS,
  getPlanningPrompt,
  getPlanningPromptPrefix,
  parseTasksFromSpec,
  parseTaskLine,
  buildTaskPrompt,
  isSpecGeneratingMode,
  canRequireApproval,
  getPlanningModeDisplayName,
} from './planning.js';

// Feature prompts (implementation)
export {
  buildFeaturePrompt,
  buildFollowUpPrompt,
  buildContinuationPrompt,
  extractTitleFromDescription,
} from './feature-prompt.js';

// Re-export types from @automaker/types
export type {
  EnhancementMode,
  EnhancementExample,
  PlanningMode,
  ParsedTask,
} from '@automaker/types';
