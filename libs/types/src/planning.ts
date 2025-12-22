/**
 * Planning Types - Types for spec-driven development and task execution
 *
 * These types support the planning/specification workflow in auto-mode:
 * - PlanningMode: skip, lite, spec, full
 * - ParsedTask: Individual tasks extracted from specs
 * - PlanSpec: Specification state and content
 * - AutoModeEventType: Type-safe event names for auto-mode
 */

import type { PlanningMode } from './settings.js';

// Re-export PlanningMode for convenience
export type { PlanningMode };

/**
 * TaskStatus - Status of an individual task within a spec
 */
export type TaskStatus = 'pending' | 'in_progress' | 'completed' | 'failed';

/**
 * PlanSpecStatus - Status of a plan/specification document
 */
export type PlanSpecStatus = 'pending' | 'generating' | 'generated' | 'approved' | 'rejected';

/**
 * ParsedTask - A single task extracted from a generated specification
 *
 * Tasks are identified by ID (e.g., "T001") and may belong to a phase.
 * Format in spec: `- [ ] T###: Description | File: path/to/file`
 */
export interface ParsedTask {
  /** Task identifier, e.g., "T001", "T002" */
  id: string;
  /** Human-readable description of what the task accomplishes */
  description: string;
  /** Primary file affected by this task (optional) */
  filePath?: string;
  /** Phase this task belongs to, e.g., "Phase 1: Foundation" (for full mode) */
  phase?: string;
  /** Current execution status of the task */
  status: TaskStatus;
}

/**
 * PlanSpec - Specification/plan state for a feature
 *
 * Tracks the generated spec content, approval status, and task progress.
 * Stored in feature.json as `planSpec` property.
 */
export interface PlanSpec {
  /** Current status of the spec */
  status: PlanSpecStatus;
  /** The spec/plan content (markdown) */
  content?: string;
  /** Version number, incremented on each revision */
  version: number;
  /** ISO timestamp when spec was first generated */
  generatedAt?: string;
  /** ISO timestamp when spec was approved */
  approvedAt?: string;
  /** Whether user has reviewed (approved/rejected) the spec */
  reviewedByUser: boolean;
  /** Number of tasks completed during execution */
  tasksCompleted?: number;
  /** Total number of tasks parsed from spec */
  tasksTotal?: number;
  /** ID of the task currently being executed */
  currentTaskId?: string;
  /** All parsed tasks from the spec */
  tasks?: ParsedTask[];
}

/**
 * AutoModeEventType - Type-safe event names emitted by auto-mode service
 *
 * All events are wrapped as `auto-mode:event` with `type` field containing
 * one of these values.
 */
export type AutoModeEventType =
  // Auto-loop lifecycle events
  | 'auto_mode_started'
  | 'auto_mode_stopped'
  | 'auto_mode_idle'
  // Feature execution events
  | 'auto_mode_feature_start'
  | 'auto_mode_feature_complete'
  | 'auto_mode_progress'
  | 'auto_mode_tool'
  | 'auto_mode_error'
  // Task execution events (multi-agent)
  | 'auto_mode_task_started'
  | 'auto_mode_task_complete'
  | 'auto_mode_phase_complete'
  // Planning/spec events
  | 'planning_started'
  | 'plan_approval_required'
  | 'plan_approved'
  | 'plan_rejected'
  | 'plan_auto_approved'
  | 'plan_revision_requested';

/**
 * AutoModeEvent - Base event payload structure
 */
export interface AutoModeEventPayload {
  /** The specific event type */
  type: AutoModeEventType;
  /** Feature ID this event relates to */
  featureId?: string;
  /** Project path */
  projectPath?: string;
  /** Additional event-specific data */
  [key: string]: unknown;
}

/**
 * TaskProgressPayload - Event payload for task progress events
 */
export interface TaskProgressPayload {
  type: 'auto_mode_task_started' | 'auto_mode_task_complete';
  featureId: string;
  projectPath: string;
  taskId: string;
  taskDescription?: string;
  taskIndex: number;
  tasksTotal: number;
  tasksCompleted?: number;
}

/**
 * PlanApprovalPayload - Event payload for plan approval events
 */
export interface PlanApprovalPayload {
  type: 'plan_approval_required';
  featureId: string;
  projectPath: string;
  planContent: string;
  planningMode: PlanningMode;
  planVersion: number;
}
