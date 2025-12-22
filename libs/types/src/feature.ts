/**
 * Feature types for AutoMaker feature management
 */

import type { PlanningMode } from './settings.js';
import type { PlanSpec } from './planning.js';

export interface FeatureImagePath {
  id: string;
  path: string;
  filename: string;
  mimeType: string;
  [key: string]: unknown;
}

export interface FeatureTextFilePath {
  id: string;
  path: string;
  filename: string;
  mimeType: string;
  content: string; // Text content of the file
  [key: string]: unknown;
}

export interface Feature {
  id: string;
  title?: string;
  titleGenerating?: boolean;
  category: string;
  description: string;
  passes?: boolean;
  priority?: number;
  status?: string;
  dependencies?: string[];
  spec?: string;
  model?: string;
  imagePaths?: Array<string | FeatureImagePath | { path: string; [key: string]: unknown }>;
  textFilePaths?: FeatureTextFilePath[];
  // Branch info - worktree path is derived at runtime from branchName
  branchName?: string; // Name of the feature branch (undefined = use current worktree)
  skipTests?: boolean;
  thinkingLevel?: string;
  planningMode?: PlanningMode;
  requirePlanApproval?: boolean;
  /** Specification state for spec-driven development modes */
  planSpec?: PlanSpec;
  error?: string;
  summary?: string;
  startedAt?: string;
  [key: string]: unknown; // Keep catch-all for extensibility
}

export type FeatureStatus =
  | 'pending'
  | 'ready'
  | 'backlog'
  | 'in_progress'
  | 'running'
  | 'completed'
  | 'failed'
  | 'verified'
  | 'waiting_approval';
