/**
 * Internal types for AutoModeService
 *
 * These types are used internally by the auto-mode services
 * and are not exported to the public API.
 */

import type { PlanningMode, PlanSpec } from '@automaker/types';

/**
 * Running feature state
 */
export interface RunningFeature {
  featureId: string;
  projectPath: string;
  worktreePath: string | null;
  branchName: string | null;
  abortController: AbortController;
  isAutoMode: boolean;
  startTime: number;
}

/**
 * Auto-loop configuration
 */
export interface AutoLoopState {
  projectPath: string;
  maxConcurrency: number;
  abortController: AbortController;
  isRunning: boolean;
}

/**
 * Auto-mode configuration
 */
export interface AutoModeConfig {
  maxConcurrency: number;
  useWorktrees: boolean;
  projectPath: string;
}

/**
 * Pending plan approval state
 */
export interface PendingApproval {
  resolve: (result: ApprovalResult) => void;
  reject: (error: Error) => void;
  featureId: string;
  projectPath: string;
}

/**
 * Result of plan approval
 */
export interface ApprovalResult {
  approved: boolean;
  editedPlan?: string;
  feedback?: string;
}

/**
 * Options for executing a feature
 */
export interface FeatureExecutionOptions {
  continuationPrompt?: string;
}

/**
 * Options for running the agent
 */
export interface RunAgentOptions {
  projectPath: string;
  planningMode?: PlanningMode;
  requirePlanApproval?: boolean;
  previousContent?: string;
  systemPrompt?: string;
}

/**
 * Feature with planning fields for internal use
 */
export interface FeatureWithPlanning {
  id: string;
  description: string;
  spec?: string;
  model?: string;
  imagePaths?: Array<string | { path: string; filename?: string; mimeType?: string }>;
  branchName?: string;
  skipTests?: boolean;
  planningMode?: PlanningMode;
  requirePlanApproval?: boolean;
  planSpec?: PlanSpec;
  [key: string]: unknown;
}

/**
 * Task execution context
 */
export interface TaskExecutionContext {
  workDir: string;
  featureId: string;
  projectPath: string;
  model: string;
  maxTurns: number;
  allowedTools?: string[];
  abortController: AbortController;
  planContent: string;
  userFeedback?: string;
}

/**
 * Task progress event
 */
export interface TaskProgress {
  taskId: string;
  taskIndex: number;
  tasksTotal: number;
  status: 'started' | 'completed' | 'failed';
  output?: string;
  phaseComplete?: number;
}
