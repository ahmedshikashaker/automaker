/**
 * Plan Approval Service - Handles plan/spec approval workflow
 *
 * Manages the async approval flow where:
 * 1. Agent generates a spec with [SPEC_GENERATED] marker
 * 2. Service emits plan_approval_required event
 * 3. User reviews and approves/rejects via API
 * 4. Service resolves the waiting promise to continue execution
 */

import type { EventEmitter } from '../../lib/events.js';
import type { PlanSpec, PlanningMode } from '@automaker/types';
import { createLogger } from '@automaker/utils';
import type { PendingApproval, ApprovalResult } from './types.js';

const logger = createLogger('PlanApprovalService');

/**
 * Manages plan approval workflow for spec-driven development
 */
export class PlanApprovalService {
  private pendingApprovals = new Map<string, PendingApproval>();
  private events: EventEmitter;

  constructor(events: EventEmitter) {
    this.events = events;
  }

  /**
   * Wait for plan approval from the user
   *
   * Returns a promise that resolves when the user approves or rejects
   * the plan via the API.
   *
   * @param featureId - The feature awaiting approval
   * @param projectPath - The project path
   * @returns Promise resolving to approval result
   */
  waitForApproval(featureId: string, projectPath: string): Promise<ApprovalResult> {
    logger.debug(`Registering pending approval for feature ${featureId}`);
    logger.debug(
      `Current pending approvals: ${Array.from(this.pendingApprovals.keys()).join(', ') || 'none'}`
    );

    return new Promise((resolve, reject) => {
      this.pendingApprovals.set(featureId, {
        resolve,
        reject,
        featureId,
        projectPath,
      });
      logger.debug(`Pending approval registered for feature ${featureId}`);
    });
  }

  /**
   * Resolve a pending plan approval
   *
   * Called when the user approves or rejects the plan via API.
   *
   * @param featureId - The feature ID
   * @param approved - Whether the plan was approved
   * @param editedPlan - Optional edited plan content
   * @param feedback - Optional user feedback
   * @returns Result indicating success or error
   */
  resolve(
    featureId: string,
    approved: boolean,
    editedPlan?: string,
    feedback?: string
  ): { success: boolean; error?: string; projectPath?: string } {
    logger.debug(`resolvePlanApproval called for feature ${featureId}, approved=${approved}`);
    logger.debug(
      `Current pending approvals: ${Array.from(this.pendingApprovals.keys()).join(', ') || 'none'}`
    );

    const pending = this.pendingApprovals.get(featureId);

    if (!pending) {
      logger.warn(`No pending approval found for feature ${featureId}`);
      return {
        success: false,
        error: `No pending approval for feature ${featureId}`,
      };
    }

    logger.debug(`Found pending approval for feature ${featureId}, resolving...`);

    // Resolve the promise with all data including feedback
    pending.resolve({ approved, editedPlan, feedback });
    this.pendingApprovals.delete(featureId);

    return { success: true, projectPath: pending.projectPath };
  }

  /**
   * Cancel a pending plan approval
   *
   * Called when a feature is stopped while waiting for approval.
   *
   * @param featureId - The feature ID to cancel
   */
  cancel(featureId: string): void {
    logger.debug(`cancelPlanApproval called for feature ${featureId}`);
    const pending = this.pendingApprovals.get(featureId);

    if (pending) {
      logger.debug(`Found and cancelling pending approval for feature ${featureId}`);
      pending.reject(new Error('Plan approval cancelled - feature was stopped'));
      this.pendingApprovals.delete(featureId);
    } else {
      logger.debug(`No pending approval to cancel for feature ${featureId}`);
    }
  }

  /**
   * Check if a feature has a pending plan approval
   *
   * @param featureId - The feature ID to check
   * @returns True if there's a pending approval
   */
  hasPending(featureId: string): boolean {
    return this.pendingApprovals.has(featureId);
  }

  /**
   * Get the project path for a pending approval
   *
   * Useful for recovery scenarios where we need to know which
   * project a pending approval belongs to.
   *
   * @param featureId - The feature ID
   * @returns The project path or undefined
   */
  getProjectPath(featureId: string): string | undefined {
    return this.pendingApprovals.get(featureId)?.projectPath;
  }

  /**
   * Get all pending approval feature IDs
   *
   * @returns Array of feature IDs with pending approvals
   */
  getAllPending(): string[] {
    return Array.from(this.pendingApprovals.keys());
  }

  /**
   * Emit a plan-related event
   */
  emitPlanEvent(
    eventType: string,
    featureId: string,
    projectPath: string,
    data: Record<string, unknown> = {}
  ): void {
    this.events.emit('auto-mode:event', {
      type: eventType,
      featureId,
      projectPath,
      ...data,
    });
  }

  /**
   * Emit plan approval required event
   */
  emitApprovalRequired(
    featureId: string,
    projectPath: string,
    planContent: string,
    planningMode: PlanningMode,
    planVersion: number
  ): void {
    this.emitPlanEvent('plan_approval_required', featureId, projectPath, {
      planContent,
      planningMode,
      planVersion,
    });
  }

  /**
   * Emit plan approved event
   */
  emitApproved(
    featureId: string,
    projectPath: string,
    hasEdits: boolean,
    planVersion: number
  ): void {
    this.emitPlanEvent('plan_approved', featureId, projectPath, {
      hasEdits,
      planVersion,
    });
  }

  /**
   * Emit plan rejected event
   */
  emitRejected(featureId: string, projectPath: string, feedback?: string): void {
    this.emitPlanEvent('plan_rejected', featureId, projectPath, { feedback });
  }

  /**
   * Emit plan auto-approved event
   */
  emitAutoApproved(
    featureId: string,
    projectPath: string,
    planContent: string,
    planningMode: PlanningMode
  ): void {
    this.emitPlanEvent('plan_auto_approved', featureId, projectPath, {
      planContent,
      planningMode,
    });
  }

  /**
   * Emit plan revision requested event
   */
  emitRevisionRequested(
    featureId: string,
    projectPath: string,
    feedback: string | undefined,
    hasEdits: boolean,
    planVersion: number
  ): void {
    this.emitPlanEvent('plan_revision_requested', featureId, projectPath, {
      feedback,
      hasEdits,
      planVersion,
    });
  }
}
