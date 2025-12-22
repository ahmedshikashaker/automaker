/**
 * Auto Mode Services
 *
 * Re-exports all auto-mode related services and types.
 */

// Services
export { PlanApprovalService } from './plan-approval-service.js';
export { TaskExecutor } from './task-executor.js';
export { WorktreeManager, worktreeManager } from './worktree-manager.js';
export { OutputWriter, createFeatureOutputWriter } from './output-writer.js';
export { ProjectAnalyzer } from './project-analyzer.js';
export { FeatureVerificationService } from './feature-verification.js';
export type { VerificationResult, CommitResult } from './feature-verification.js';

// Types
export type {
  RunningFeature,
  AutoLoopState,
  AutoModeConfig,
  PendingApproval,
  ApprovalResult,
  FeatureExecutionOptions,
  RunAgentOptions,
  FeatureWithPlanning,
  TaskExecutionContext,
  TaskProgress,
} from './types.js';
