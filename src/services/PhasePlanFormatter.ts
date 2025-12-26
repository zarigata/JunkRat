import { PhasePlan, PhaseTask } from '../types/conversation';

export class PhasePlanFormatter {
  static toMarkdown(plan: PhasePlan): string {
    const lines: string[] = [];

    lines.push(`# ${plan.title}`);
    lines.push('');
    lines.push(plan.description);
    lines.push('');
    lines.push('## Overview');
    lines.push('');
    lines.push(`- **Total Phases**: ${plan.totalPhases}`);
    lines.push(`- **Complexity**: ${plan.metadata.complexity ?? 'unknown'}`);
    lines.push(
      `- **Technologies**: ${plan.metadata.technologies.length > 0 ? plan.metadata.technologies.join(', ') : 'None'}`
    );
    lines.push(`- **Created**: ${new Date(plan.createdAt).toLocaleString()}`);
    lines.push('');
    lines.push('## Phases');
    lines.push('');

    plan.phases.forEach((phase) => {
      lines.push(`### Phase ${phase.order}: ${phase.title}`);
      lines.push('');
      lines.push(`**ID**: \`${phase.id}\``);
      lines.push(`**Status**: ${phase.status ? phase.status.toUpperCase() : 'PENDING'}`);
      lines.push(`**Complexity**: ${phase.estimatedComplexity ?? 'unspecified'}`);
      lines.push(
        `**Dependencies**: ${phase.dependencies.length > 0 ? phase.dependencies.join(', ') : 'None'}`
      );
      lines.push('');
      lines.push(phase.description);
      lines.push('');

      // Render tasks if present
      if (phase.tasks && phase.tasks.length > 0) {
        lines.push('#### Tasks');
        lines.push('');
        phase.tasks.forEach((task, index) => {
          lines.push(`##### Task ${index + 1}: ${task.title}`);
          lines.push('');
          lines.push(`**Goal**: ${task.goal}`);
          lines.push('');
          if (task.files.length > 0) {
            lines.push(`**Files**: \`${task.files.join('`, `')}\``);
            lines.push('');
          }
          lines.push('**Instructions**:');
          task.instructions.forEach((instruction, i) => {
            lines.push(`${i + 1}. ${instruction}`);
          });
          lines.push('');
          lines.push('**Acceptance Criteria**:');
          task.acceptance_criteria.forEach((criteria) => {
            lines.push(`- [ ] ${criteria}`);
          });
          lines.push('');
        });
      }

      if (phase.files.length > 0) {
        lines.push(`**Files**: \`${phase.files.join('`, `')}\``);
        lines.push('');
      }
      lines.push('---');
      lines.push('');
    });

    return lines.join('\n');
  }

  /**
   * Format a single task for copying to an AI assistant
   */
  static formatTaskForCopy(task: PhaseTask, phaseTitle?: string): string {
    const lines: string[] = [];

    if (phaseTitle) {
      lines.push(`## ${phaseTitle} - ${task.title}`);
    } else {
      lines.push(`## ${task.title}`);
    }
    lines.push('');
    lines.push(`**Goal**: ${task.goal}`);
    lines.push('');

    if (task.files.length > 0) {
      lines.push('**Files to create/modify**:');
      task.files.forEach(file => {
        lines.push(`- \`${file}\``);
      });
      lines.push('');
    }

    lines.push('**Instructions**:');
    task.instructions.forEach((instruction, i) => {
      lines.push(`${i + 1}. ${instruction}`);
    });
    lines.push('');

    lines.push('**When complete, verify**:');
    task.acceptance_criteria.forEach((criteria) => {
      lines.push(`- ${criteria}`);
    });

    return lines.join('\n');
  }

  /**
   * Format task for Roo Code with emphasis on file paths and clear acceptance criteria
   */
  static formatForRooCode(task: PhaseTask, phaseTitle?: string): string {
    const lines: string[] = [];

    lines.push(`I need your help with this task: **${task.title}**${phaseTitle ? ` (from ${phaseTitle})` : ''}`);
    lines.push('');
    lines.push(`**Goal**: ${task.goal}`);
    lines.push('');

    if (task.files.length > 0) {
      lines.push('Please modify/create the following files:');
      task.files.forEach(file => lines.push(`- ${file}`));
      lines.push('');
    }

    lines.push('**Instructions**:');
    task.instructions.forEach((instruction, i) => lines.push(`${i + 1}. ${instruction}`));
    lines.push('');

    lines.push('**Acceptance Criteria** (please verify these before finishing):');
    task.acceptance_criteria.forEach(criteria => lines.push(`- [ ] ${criteria}`));

    return lines.join('\n');
  }

  /**
   * Format task for Windsurf with structured sections and explicit file operations
   */
  static formatForWindsurf(task: PhaseTask, phaseTitle?: string): string {
    const lines: string[] = [];

    lines.push(`# Task: ${task.title}`);
    if (phaseTitle) lines.push(`Phase: ${phaseTitle}`);
    lines.push('');
    lines.push(`## Objective\n${task.goal}`);
    lines.push('');

    if (task.files.length > 0) {
      lines.push('## Relevant Files');
      task.files.forEach(file => lines.push(`- ${file}`));
      lines.push('');
    }

    lines.push('## Steps');
    task.instructions.forEach((instruction, i) => lines.push(`${i + 1}. ${instruction}`));
    lines.push('');

    lines.push('## Verification');
    task.acceptance_criteria.forEach(criteria => lines.push(`- ${criteria}`));

    return lines.join('\n');
  }

  /**
   * Format task for Aider with optimization for file-based workflow
   */
  static formatForAider(task: PhaseTask, phaseTitle?: string): string {
    const lines: string[] = [];

    // Aider works best when you tell it which files to add first
    if (task.files.length > 0) {
      const fileList = task.files.join(' ');
      lines.push(`/add ${fileList}`);
      lines.push('');
    }

    lines.push(`${task.title}: ${task.goal}`);
    lines.push('');

    lines.push('Instructions:');
    task.instructions.forEach((instruction, i) => lines.push(`- ${instruction}`));
    lines.push('');

    lines.push('Requirements:');
    task.acceptance_criteria.forEach(criteria => lines.push(`- ${criteria}`));

    return lines.join('\n');
  }

  /**
   * Format task for Cursor with inline comments and step-by-step instructions
   */
  static formatForCursor(task: PhaseTask, phaseTitle?: string): string {
    const lines: string[] = [];

    lines.push(`/* ${phaseTitle ? `[${phaseTitle}] ` : ''}${task.title} */`);
    lines.push(`// Goal: ${task.goal}`);
    lines.push('');

    if (task.files.length > 0) {
      lines.push('// Context Files:');
      task.files.forEach(file => lines.push(`// @${file}`));
      lines.push('');
    }

    lines.push('// Steps:');
    task.instructions.forEach((instruction, i) => lines.push(`// ${i + 1}. ${instruction}`));
    lines.push('');

    lines.push('// Verify:');
    task.acceptance_criteria.forEach(criteria => lines.push(`// - ${criteria}`));

    return lines.join('\n');
  }

  /**
   * Format task for Continue with context-aware instructions
   */
  static formatForContinue(task: PhaseTask, phaseTitle?: string): string {
    const lines: string[] = [];

    lines.push(`Task: ${task.title}`);
    lines.push(`Goal: ${task.goal}`);
    lines.push('');

    if (task.files.length > 0) {
      lines.push('Files:');
      task.files.forEach(file => lines.push(`- ${file}`));
      lines.push('');
    }

    lines.push('Instructions:');
    task.instructions.forEach(instruction => lines.push(`- ${instruction}`));

    return lines.join('\n');
  }

  /**
   * Format entire phase plan for a specific tool
   */
  static formatPlanForTool(plan: PhasePlan, toolName: string): string {
    const lines: string[] = [];

    lines.push(`# Implementation Plan: ${plan.title}`);
    lines.push(plan.description);
    lines.push('');

    plan.phases.forEach(phase => {
      lines.push(`## Phase ${phase.order}: ${phase.title}`);
      lines.push(phase.description);
      lines.push('');

      if (phase.tasks) {
        phase.tasks.forEach((task, index) => {
          lines.push(`### Task ${phase.order}.${index + 1}: ${task.title}`);

          let taskPrompt = '';
          switch (toolName) {
            case 'roo-code':
              taskPrompt = this.formatForRooCode(task, phase.title);
              break;
            case 'windsurf':
              taskPrompt = this.formatForWindsurf(task, phase.title);
              break;
            case 'aider':
              taskPrompt = this.formatForAider(task, phase.title);
              break;
            case 'cursor':
              taskPrompt = this.formatForCursor(task, phase.title);
              break;
            case 'continue':
              taskPrompt = this.formatForContinue(task, phase.title);
              break;
            default:
              taskPrompt = this.formatTaskForCopy(task, phase.title);
          }

          lines.push(taskPrompt);
          lines.push('\n---\n');
        });
      }
    });

    return lines.join('\n');
  }

  static toJSON(plan: PhasePlan, pretty = true): string {
    return JSON.stringify(plan, null, pretty ? 2 : 0);
  }

  static toCompactJSON(plan: PhasePlan): string {
    return JSON.stringify(plan);
  }

  static toPlainText(plan: PhasePlan): string {
    const lines: string[] = [];

    lines.push(plan.title);
    lines.push(plan.description);
    lines.push('');
    lines.push(`Total Phases: ${plan.totalPhases}`);
    lines.push('');

    plan.phases.forEach((phase) => {
      lines.push(`Phase ${phase.order}: ${phase.title}`);
      lines.push(phase.description);
      lines.push('');
    });

    return lines.join('\n');
  }

  static toPhaseSummary(plan: PhasePlan): string {
    return `Project: ${plan.title} | ${plan.totalPhases} phases | Complexity: ${plan.metadata.complexity}`;
  }
}
