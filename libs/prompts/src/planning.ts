/**
 * Planning Prompts - AI prompt templates for spec-driven development
 *
 * Contains planning mode prompts, task parsing utilities, and prompt builders
 * for the multi-agent task execution workflow.
 */

import type { PlanningMode, ParsedTask } from '@automaker/types';

/**
 * Planning mode prompt templates
 *
 * Each mode has a specific prompt format that instructs the AI to generate
 * a planning document with task breakdowns in a parseable format.
 */
export const PLANNING_PROMPTS = {
  lite: `## Planning Phase (Lite Mode)

IMPORTANT: Do NOT output exploration text, tool usage, or thinking before the plan. Start DIRECTLY with the planning outline format below. Silently analyze the codebase first, then output ONLY the structured plan.

Create a brief planning outline:

1. **Goal**: What are we accomplishing? (1 sentence)
2. **Approach**: How will we do it? (2-3 sentences)
3. **Files to Touch**: List files and what changes
4. **Tasks**: Numbered task list (3-7 items)
5. **Risks**: Any gotchas to watch for

After generating the outline, output:
"[PLAN_GENERATED] Planning outline complete."

Then proceed with implementation.`,

  lite_with_approval: `## Planning Phase (Lite Mode)

IMPORTANT: Do NOT output exploration text, tool usage, or thinking before the plan. Start DIRECTLY with the planning outline format below. Silently analyze the codebase first, then output ONLY the structured plan.

Create a brief planning outline:

1. **Goal**: What are we accomplishing? (1 sentence)
2. **Approach**: How will we do it? (2-3 sentences)
3. **Files to Touch**: List files and what changes
4. **Tasks**: Numbered task list (3-7 items)
5. **Risks**: Any gotchas to watch for

After generating the outline, output:
"[SPEC_GENERATED] Please review the planning outline above. Reply with 'approved' to proceed or provide feedback for revisions."

DO NOT proceed with implementation until you receive explicit approval.`,

  spec: `## Specification Phase (Spec Mode)

IMPORTANT: Do NOT output exploration text, tool usage, or thinking before the spec. Start DIRECTLY with the specification format below. Silently analyze the codebase first, then output ONLY the structured specification.

Generate a specification with an actionable task breakdown. WAIT for approval before implementing.

### Specification Format

1. **Problem**: What problem are we solving? (user perspective)

2. **Solution**: Brief approach (1-2 sentences)

3. **Acceptance Criteria**: 3-5 items in GIVEN-WHEN-THEN format
   - GIVEN [context], WHEN [action], THEN [outcome]

4. **Files to Modify**:
   | File | Purpose | Action |
   |------|---------|--------|
   | path/to/file | description | create/modify/delete |

5. **Implementation Tasks**:
   Use this EXACT format for each task (the system will parse these):
   \`\`\`tasks
   - [ ] T001: [Description] | File: [path/to/file]
   - [ ] T002: [Description] | File: [path/to/file]
   - [ ] T003: [Description] | File: [path/to/file]
   \`\`\`

   Task ID rules:
   - Sequential: T001, T002, T003, etc.
   - Description: Clear action (e.g., "Create user model", "Add API endpoint")
   - File: Primary file affected (helps with context)
   - Order by dependencies (foundational tasks first)

6. **Verification**: How to confirm feature works

After generating the spec, output on its own line:
"[SPEC_GENERATED] Please review the specification above. Reply with 'approved' to proceed or provide feedback for revisions."

DO NOT proceed with implementation until you receive explicit approval.

When approved, execute tasks SEQUENTIALLY in order. For each task:
1. BEFORE starting, output: "[TASK_START] T###: Description"
2. Implement the task
3. AFTER completing, output: "[TASK_COMPLETE] T###: Brief summary"

This allows real-time progress tracking during implementation.`,

  full: `## Full Specification Phase (Full SDD Mode)

IMPORTANT: Do NOT output exploration text, tool usage, or thinking before the spec. Start DIRECTLY with the specification format below. Silently analyze the codebase first, then output ONLY the structured specification.

Generate a comprehensive specification with phased task breakdown. WAIT for approval before implementing.

### Specification Format

1. **Problem Statement**: 2-3 sentences from user perspective

2. **User Story**: As a [user], I want [goal], so that [benefit]

3. **Acceptance Criteria**: Multiple scenarios with GIVEN-WHEN-THEN
   - **Happy Path**: GIVEN [context], WHEN [action], THEN [expected outcome]
   - **Edge Cases**: GIVEN [edge condition], WHEN [action], THEN [handling]
   - **Error Handling**: GIVEN [error condition], WHEN [action], THEN [error response]

4. **Technical Context**:
   | Aspect | Value |
   |--------|-------|
   | Affected Files | list of files |
   | Dependencies | external libs if any |
   | Constraints | technical limitations |
   | Patterns to Follow | existing patterns in codebase |

5. **Non-Goals**: What this feature explicitly does NOT include

6. **Implementation Tasks**:
   Use this EXACT format for each task (the system will parse these):
   \`\`\`tasks
   ## Phase 1: Foundation
   - [ ] T001: [Description] | File: [path/to/file]
   - [ ] T002: [Description] | File: [path/to/file]

   ## Phase 2: Core Implementation
   - [ ] T003: [Description] | File: [path/to/file]
   - [ ] T004: [Description] | File: [path/to/file]

   ## Phase 3: Integration & Testing
   - [ ] T005: [Description] | File: [path/to/file]
   - [ ] T006: [Description] | File: [path/to/file]
   \`\`\`

   Task ID rules:
   - Sequential across all phases: T001, T002, T003, etc.
   - Description: Clear action verb + target
   - File: Primary file affected
   - Order by dependencies within each phase
   - Phase structure helps organize complex work

7. **Success Metrics**: How we know it's done (measurable criteria)

8. **Risks & Mitigations**:
   | Risk | Mitigation |
   |------|------------|
   | description | approach |

After generating the spec, output on its own line:
"[SPEC_GENERATED] Please review the comprehensive specification above. Reply with 'approved' to proceed or provide feedback for revisions."

DO NOT proceed with implementation until you receive explicit approval.

When approved, execute tasks SEQUENTIALLY by phase. For each task:
1. BEFORE starting, output: "[TASK_START] T###: Description"
2. Implement the task
3. AFTER completing, output: "[TASK_COMPLETE] T###: Brief summary"

After completing all tasks in a phase, output:
"[PHASE_COMPLETE] Phase N complete"

This allows real-time progress tracking during implementation.`,
} as const;

/**
 * Get the planning prompt for a given mode
 *
 * @param mode - The planning mode (skip, lite, spec, full)
 * @param requireApproval - Whether to use approval variant for lite mode
 * @returns The prompt string, or empty string for 'skip' mode
 */
export function getPlanningPrompt(mode: PlanningMode, requireApproval?: boolean): string {
  if (mode === 'skip') {
    return '';
  }

  // For lite mode, use approval variant if required
  if (mode === 'lite' && requireApproval) {
    return PLANNING_PROMPTS.lite_with_approval;
  }

  return PLANNING_PROMPTS[mode] || '';
}

/**
 * Get the planning prompt prefix for a feature prompt
 *
 * Used to prepend planning instructions before the feature description.
 *
 * @param mode - The planning mode
 * @param requireApproval - Whether approval is required
 * @returns Formatted prompt prefix with separator, or empty string
 */
export function getPlanningPromptPrefix(mode: PlanningMode, requireApproval?: boolean): string {
  const prompt = getPlanningPrompt(mode, requireApproval);
  if (!prompt) {
    return '';
  }
  return prompt + '\n\n---\n\n## Feature Request\n\n';
}

/**
 * Parse tasks from generated spec content
 *
 * Looks for the ```tasks code block and extracts task lines.
 * Falls back to finding task lines anywhere in content if no block found.
 *
 * @param specContent - The full spec content string
 * @returns Array of parsed tasks
 */
export function parseTasksFromSpec(specContent: string): ParsedTask[] {
  const tasks: ParsedTask[] = [];

  // Extract content within ```tasks ... ``` block
  const tasksBlockMatch = specContent.match(/```tasks\s*([\s\S]*?)```/);
  if (!tasksBlockMatch) {
    // Try fallback: look for task lines anywhere in content
    const taskLines = specContent.match(/- \[ \] T\d{3}:.*$/gm);
    if (!taskLines) {
      return tasks;
    }
    // Parse fallback task lines
    let currentPhase: string | undefined;
    for (const line of taskLines) {
      const parsed = parseTaskLine(line, currentPhase);
      if (parsed) {
        tasks.push(parsed);
      }
    }
    return tasks;
  }

  const tasksContent = tasksBlockMatch[1];
  const lines = tasksContent.split('\n');

  let currentPhase: string | undefined;

  for (const line of lines) {
    const trimmedLine = line.trim();

    // Check for phase header (e.g., "## Phase 1: Foundation")
    const phaseMatch = trimmedLine.match(/^##\s*(.+)$/);
    if (phaseMatch) {
      currentPhase = phaseMatch[1].trim();
      continue;
    }

    // Check for task line
    if (trimmedLine.startsWith('- [ ]')) {
      const parsed = parseTaskLine(trimmedLine, currentPhase);
      if (parsed) {
        tasks.push(parsed);
      }
    }
  }

  return tasks;
}

/**
 * Parse a single task line
 *
 * Format: - [ ] T###: Description | File: path/to/file
 *
 * @param line - The task line to parse
 * @param currentPhase - Optional phase context
 * @returns Parsed task or null if line doesn't match format
 */
export function parseTaskLine(line: string, currentPhase?: string): ParsedTask | null {
  // Match pattern: - [ ] T###: Description | File: path
  const taskMatch = line.match(/- \[ \] (T\d{3}):\s*([^|]+)(?:\|\s*File:\s*(.+))?$/);
  if (!taskMatch) {
    // Try simpler pattern without file
    const simpleMatch = line.match(/- \[ \] (T\d{3}):\s*(.+)$/);
    if (simpleMatch) {
      return {
        id: simpleMatch[1],
        description: simpleMatch[2].trim(),
        phase: currentPhase,
        status: 'pending',
      };
    }
    return null;
  }

  return {
    id: taskMatch[1],
    description: taskMatch[2].trim(),
    filePath: taskMatch[3]?.trim(),
    phase: currentPhase,
    status: 'pending',
  };
}

/**
 * Build a focused prompt for executing a single task
 *
 * Creates a prompt that shows the current task, completed tasks,
 * and remaining tasks to give the agent context while keeping focus.
 *
 * @param task - The current task to execute
 * @param allTasks - All tasks in the spec
 * @param taskIndex - Index of current task in allTasks
 * @param planContent - The full approved plan content
 * @param userFeedback - Optional user feedback to incorporate
 * @returns Formatted prompt for task execution
 */
export function buildTaskPrompt(
  task: ParsedTask,
  allTasks: ParsedTask[],
  taskIndex: number,
  planContent: string,
  userFeedback?: string
): string {
  const completedTasks = allTasks.slice(0, taskIndex);
  const remainingTasks = allTasks.slice(taskIndex + 1);

  let prompt = `# Task Execution: ${task.id}

You are executing a specific task as part of a larger feature implementation.

## Your Current Task

**Task ID:** ${task.id}
**Description:** ${task.description}
${task.filePath ? `**Primary File:** ${task.filePath}` : ''}
${task.phase ? `**Phase:** ${task.phase}` : ''}

## Context

`;

  // Show what's already done
  if (completedTasks.length > 0) {
    prompt += `### Already Completed (${completedTasks.length} tasks)
${completedTasks.map((t) => `- [x] ${t.id}: ${t.description}`).join('\n')}

`;
  }

  // Show remaining tasks
  if (remainingTasks.length > 0) {
    prompt += `### Coming Up Next (${remainingTasks.length} tasks remaining)
${remainingTasks
  .slice(0, 3)
  .map((t) => `- [ ] ${t.id}: ${t.description}`)
  .join('\n')}
${remainingTasks.length > 3 ? `... and ${remainingTasks.length - 3} more tasks` : ''}

`;
  }

  // Add user feedback if any
  if (userFeedback) {
    prompt += `### User Feedback
${userFeedback}

`;
  }

  // Add relevant excerpt from plan (just the task-related part to save context)
  prompt += `### Reference: Full Plan
<details>
${planContent}
</details>

## Instructions

1. Focus ONLY on completing task ${task.id}: "${task.description}"
2. Do not work on other tasks
3. Use the existing codebase patterns
4. When done, summarize what you implemented

Begin implementing task ${task.id} now.`;

  return prompt;
}

/**
 * Check if a planning mode requires spec generation
 */
export function isSpecGeneratingMode(mode: PlanningMode): boolean {
  return mode === 'spec' || mode === 'full' || mode === 'lite';
}

/**
 * Check if a planning mode can require approval
 */
export function canRequireApproval(mode: PlanningMode): boolean {
  return mode !== 'skip';
}

/**
 * Get display name for a planning mode
 */
export function getPlanningModeDisplayName(mode: PlanningMode): string {
  const names: Record<PlanningMode, string> = {
    skip: 'Skip Planning',
    lite: 'Lite Planning',
    spec: 'Specification',
    full: 'Full SDD',
  };
  return names[mode] || mode;
}
