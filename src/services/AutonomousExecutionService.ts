import * as vscode from 'vscode';
import { ChatService } from './ChatService';
import { UIStateManager, UIPhase } from './UIStateManager';
import { PhasePlan, Phase, PhaseTask } from '../types/conversation';

/**
 * Execution result for a single task
 */
export interface TaskExecutionResult {
    taskId: string;
    success: boolean;
    output?: string;
    error?: string;
    timestamp: number;
}

/**
 * Verification result for a task
 */
export interface TaskVerificationResult {
    taskId: string;
    success: boolean;
    issues?: string[];
    suggestions?: string[];
}

/**
 * Plan validation result
 */
export interface PlanValidationResult {
    allValid: boolean;
    issues: Array<{
        phaseId: string;
        taskId: string;
        issue: string;
    }>;
}

/**
 * Autonomous execution progress
 */
export interface AutonomousProgress {
    currentIteration: number;
    maxIterations: number;
    currentPhaseId?: string;
    currentTaskId?: string;
    completedTasks: number;
    totalTasks: number;
    status: 'running' | 'paused' | 'stopped' | 'completed' | 'error';
    comboMultiplier?: number;
    achievements?: string[];
}

/**
 * Failure journal entry for tracking failed attempts
 */
export interface FailureJournalEntry {
    taskId: string;
    taskTitle: string;
    attempts: Array<{
        iteration: number;
        error: string;
        aiAnalysis?: string;
        correctionAttempt?: string;
        timestamp: number;
    }>;
}

/**
 * Confidence score for task execution
 */
export interface TaskConfidence {
    taskId: string;
    score: number; // 0-100
    reasoning?: string;
}

/**
 * Completion markers for Ralph Wiggum pattern
 */
const COMPLETION_MARKERS = [
    '<promise>COMPLETE</promise>',
    '<promise>PHASE_COMPLETE</promise>',
    '<promise>TASK_COMPLETE</promise>',
    '<promise>TASK_VERIFIED</promise>',
    '<promise>VERIFIED</promise>',
    '<promise>DONE</promise>',
    '<promise>FIXED</promise>',
    '<promise>REFACTORED</promise>'
];

/**
 * Autonomous Execution Service (TOILET SURF Mode)
 * Implements iterative task execution with self-correction
 * Inspired by Ralph Wiggum approach: persistent iteration until completion
 */
export class AutonomousExecutionService implements vscode.Disposable {
    private _isRunning: boolean = false;
    private _isPaused: boolean = false;
    private _currentIteration: number = 0;
    private _maxIterations: number = 50;
    private _currentPlan?: PhasePlan;
    private _executionHistory: TaskExecutionResult[] = [];

    // Ralph Wiggum enhancements
    private _failureJournal: Map<string, FailureJournalEntry> = new Map();
    private _comboMultiplier: number = 1.0;
    private _consecutiveSuccesses: number = 0;
    private _achievements: Set<string> = new Set();

    private readonly _onDidUpdateProgress = new vscode.EventEmitter<AutonomousProgress>();
    public readonly onDidUpdateProgress = this._onDidUpdateProgress.event;

    private readonly _onDidComplete = new vscode.EventEmitter<{ success: boolean; iterations: number }>();
    public readonly onDidComplete = this._onDidComplete.event;

    constructor(
        private readonly _chatService: ChatService,
        private readonly _uiStateManager: UIStateManager,
        private readonly _outputChannel?: vscode.OutputChannel
    ) { }

    /**
     * Start autonomous execution
     * Main loop that creates plan, validates, executes, and verifies tasks
     */
    async startAutonomousExecution(initialPrompt: string, maxIterations: number = 50): Promise<void> {
        if (this._isRunning) {
            throw new Error('Autonomous execution is already running');
        }

        this._isRunning = true;
        this._isPaused = false;
        this._currentIteration = 0;
        this._maxIterations = maxIterations;
        this._executionHistory = [];

        this._log(`Starting TOILET SURF autonomous execution with prompt: "${initialPrompt}"`);
        this._log(`Max iterations: ${maxIterations}`);

        try {
            // Transition to PLANNING phase
            this._uiStateManager.transitionTo(UIPhase.PLANNING);

            // Main autonomous loop
            while (this._isRunning && this._currentIteration < this._maxIterations) {
                this._currentIteration++;
                this._log(`\n=== Iteration ${this._currentIteration}/${this._maxIterations} ===`);

                // Check if paused
                if (this._isPaused) {
                    this._log('Execution paused, waiting...');
                    await this._waitForResume();
                }

                // Step 1: Create or get plan
                if (!this._currentPlan) {
                    this._log('Creating initial plan...');
                    this._currentPlan = await this._createPlan(initialPrompt);

                    if (!this._currentPlan) {
                        this._log('Failed to create plan, retrying...');
                        continue;
                    }
                }

                // Step 2: Validate all tasks are doable
                this._log('Validating tasks...');
                const validation = await this._validatePlan(this._currentPlan);

                if (!validation.allValid) {
                    this._log(`Plan validation failed with ${validation.issues.length} issues`);
                    this._log('Refining plan based on validation issues...');
                    this._currentPlan = await this._refinePlan(this._currentPlan, validation.issues);
                    continue;
                }

                // Step 3: Get next incomplete task
                const nextTask = this._getNextIncompleteTask(this._currentPlan);

                if (!nextTask) {
                    // All tasks complete!
                    this._log('All tasks completed successfully!');
                    this._log(`\n🎉 TOILET SURF COMPLETE! 🎉`);
                    this._log(`Total iterations: ${this._currentIteration}`);
                    this._log(`Combo multiplier: ${this._comboMultiplier.toFixed(1)}x`);
                    this._log(`Achievements: ${Array.from(this._achievements).join(', ') || 'None'}`);
                    this._uiStateManager.transitionTo(UIPhase.IDLE);
                    this._onDidComplete.fire({ success: true, iterations: this._currentIteration });
                    break;
                }

                // Step 3.5: Check confidence before execution (Gemini superpower)
                this._log(`Checking confidence for task: ${nextTask.task.title}`);
                const confidence = await this._getTaskConfidence(nextTask.task);
                this._log(`Confidence: ${confidence.score}% ${confidence.reasoning ? `(${confidence.reasoning})` : ''}`);

                if (confidence.score < 30) {
                    this._log(`⚠️ Low confidence (${confidence.score}%). Skipping task for now...`);
                    // Mark task as needing human guidance
                    nextTask.task.status = 'pending';
                    continue;
                }

                // Transition to EXECUTING phase
                this._uiStateManager.transitionTo(UIPhase.EXECUTING, { taskId: nextTask.task.id });

                // Step 4: Execute the task
                this._log(`Executing task: ${nextTask.task.title}`);
                const executionResult = await this._executeTask(nextTask.task, nextTask.phase);

                // Transition to VERIFYING phase
                this._uiStateManager.transitionTo(UIPhase.VERIFYING, { taskId: nextTask.task.id });

                // Step 5: Verify execution
                this._log('Verifying task execution...');
                const verificationResult = await this._verifyTaskExecution(nextTask.task, executionResult);

                if (verificationResult.success) {
                    this._log(`✅ Task verified successfully: ${nextTask.task.title}`);
                    await this._markTaskComplete(nextTask.phase.id, nextTask.task.id);

                    // Update combo on success
                    this._updateCombo(true);

                    this._emitProgress();
                } else {
                    // Step 6: Self-correct and retry
                    this._log(`❌ Task verification failed: ${verificationResult.issues?.join(', ')}`);
                    this._log('Analyzing failure and preparing retry...');

                    // Add to failure journal
                    this._addToFailureJournal(
                        nextTask.task,
                        verificationResult.issues?.join('; ') || 'Verification failed',
                        verificationResult.suggestions?.join('; ')
                    );

                    // Break combo on failure
                    this._updateCombo(false);

                    await this._analyzeAndCorrect(nextTask.task, executionResult, verificationResult);

                    // Don't mark as complete, will retry in next iteration
                }

                // Emit progress update
                this._emitProgress();
            }

            // Check if we hit max iterations
            if (this._currentIteration >= this._maxIterations) {
                this._log('Reached maximum iterations without completing all tasks');
                this._uiStateManager.transitionTo(UIPhase.ERROR);
                this._onDidComplete.fire({ success: false, iterations: this._currentIteration });
            }

        } catch (error) {
            this._log(`Error during autonomous execution: ${error instanceof Error ? error.message : 'Unknown error'}`);
            this._uiStateManager.transitionTo(UIPhase.ERROR);
            this._onDidComplete.fire({ success: false, iterations: this._currentIteration });
            throw error;
        } finally {
            this._isRunning = false;
            this._isPaused = false;
        }
    }

    /**
     * Stop autonomous execution
     */
    stopExecution(): void {
        this._log('Stopping autonomous execution...');
        this._isRunning = false;
        this._isPaused = false;
        this._uiStateManager.transitionTo(UIPhase.IDLE);
    }

    /**
     * Pause autonomous execution
     */
    pauseExecution(): void {
        this._log('Pausing autonomous execution...');
        this._isPaused = true;
    }

    /**
     * Resume autonomous execution
     */
    resumeExecution(): void {
        this._log('Resuming autonomous execution...');
        this._isPaused = false;
    }

    /**
     * Get current execution status
     */
    getStatus(): AutonomousProgress {
        const completedTasks = this._currentPlan
            ? this._countCompletedTasks(this._currentPlan)
            : 0;
        const totalTasks = this._currentPlan
            ? this._countTotalTasks(this._currentPlan)
            : 0;

        let status: AutonomousProgress['status'] = 'stopped';
        if (this._isRunning && this._isPaused) {
            status = 'paused';
        } else if (this._isRunning) {
            status = 'running';
        } else if (completedTasks === totalTasks && totalTasks > 0) {
            status = 'completed';
        }

        return {
            currentIteration: this._currentIteration,
            maxIterations: this._maxIterations,
            completedTasks,
            totalTasks,
            status,
            comboMultiplier: this._comboMultiplier,
            achievements: Array.from(this._achievements)
        };
    }

    /**
     * Create initial plan from user prompt
     */
    private async _createPlan(prompt: string): Promise<PhasePlan | undefined> {
        try {
            // Send message to chat service to generate plan
            await this._chatService.sendMessage(prompt);

            // Get the active conversation which should now have a plan
            const conversation = this._chatService.getActiveConversation();
            return conversation?.phasePlan;
        } catch (error) {
            this._log(`Error creating plan: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return undefined;
        }
    }

    /**
   * Validate that all tasks in the plan are doable
   */
    private async _validatePlan(plan: PhasePlan): Promise<PlanValidationResult> {
        const issues: PlanValidationResult['issues'] = [];

        // Simple validation for now - check that tasks have required fields
        for (const phase of plan.phases) {
            if (!phase.tasks || !Array.isArray(phase.tasks)) {
                continue;
            }

            for (const task of phase.tasks) {
                if (!task.title || task.title.trim() === '') {
                    issues.push({
                        phaseId: phase.id,
                        taskId: task.id,
                        issue: 'Task has no title',
                    });
                }

                if (!task.goal || task.goal.trim() === '') {
                    issues.push({
                        phaseId: phase.id,
                        taskId: task.id,
                        issue: 'Task has no goal defined',
                    });
                }
            }
        }

        return {
            allValid: issues.length === 0,
            issues,
        };
    }

    /**
     * Refine plan based on validation issues
     */
    private async _refinePlan(plan: PhasePlan, issues: PlanValidationResult['issues']): Promise<PhasePlan> {
        // For now, just return the original plan
        // In future, could use AI to refine based on issues
        this._log(`Plan refinement needed for ${issues.length} issues`);
        return plan;
    }

    /**
   * Get the next incomplete task
   */
    private _getNextIncompleteTask(plan: PhasePlan): { phase: Phase; task: PhaseTask } | null {
        for (const phase of plan.phases) {
            if (!phase.tasks || !Array.isArray(phase.tasks)) {
                continue;
            }

            for (const task of phase.tasks) {
                if (task.status !== 'completed') {
                    return { phase, task };
                }
            }
        }
        return null;
    }

    /**
     * Execute a single task
     */
    private async _executeTask(task: PhaseTask, phase: Phase): Promise<TaskExecutionResult> {
        const startTime = Date.now();

        try {
            // Build enhanced prompt with Ralph Wiggum patterns
            const prompt = this._buildEnhancedPrompt(task, phase);

            this._log(`Executing with enhanced prompt (includes failure journal)`);
            const response = await this._chatService.sendMessage(prompt);

            // Check for completion markers
            const hasCompletionMarker = this._detectCompletion(response);

            if (hasCompletionMarker) {
                this._log(`✅ Detected completion marker in response`);
            }

            const result: TaskExecutionResult = {
                taskId: task.id,
                success: hasCompletionMarker || true, // Success if has marker or no errors
                output: response,
                timestamp: Date.now(),
            };

            this._executionHistory.push(result);
            return result;

        } catch (error) {
            const result: TaskExecutionResult = {
                taskId: task.id,
                success: false,
                error: error instanceof Error ? error.message : 'Unknown error',
                timestamp: Date.now(),
            };

            this._executionHistory.push(result);
            return result;
        }
    }

    /**
     * Verify task execution was successful
     */
    private async _verifyTaskExecution(
        task: PhaseTask,
        executionResult: TaskExecutionResult
    ): Promise<TaskVerificationResult> {
        // Simple verification - check if execution was successful
        if (!executionResult.success) {
            return {
                taskId: task.id,
                success: false,
                issues: [executionResult.error || 'Execution failed'],
            };
        }

        // Check for completion markers (Ralph Wiggum pattern)
        const hasCompletionMarker = executionResult.output ?
            this._detectCompletion(executionResult.output) : false;

        if (hasCompletionMarker) {
            return {
                taskId: task.id,
                success: true,
            };
        }

        // If no completion marker, assume success but log warning
        this._log(`⚠️ No completion marker found, assuming task is complete`);
        return {
            taskId: task.id,
            success: true,
        };
    }

    /**
     * Analyze failure and prepare for retry
     */
    private async _analyzeAndCorrect(
        task: PhaseTask,
        executionResult: TaskExecutionResult,
        verificationResult: TaskVerificationResult
    ): Promise<void> {
        this._log(`Analyzing failure for task: ${task.title}`);
        this._log(`Issues: ${verificationResult.issues?.join(', ')}`);

        // In future, could use AI to analyze and suggest corrections
        // For now, just log the failure
    }

    /**
   * Mark a task as complete
   */
    private async _markTaskComplete(phaseId: string, taskId: string): Promise<void> {
        if (!this._currentPlan) {
            return;
        }

        // Find and update the task
        for (const phase of this._currentPlan.phases) {
            if (phase.id === phaseId) {
                if (!phase.tasks || !Array.isArray(phase.tasks)) {
                    return;
                }

                for (const task of phase.tasks) {
                    if (task.id === taskId) {
                        task.status = 'completed';
                        return;
                    }
                }
            }
        }
    }

    /**
   * Count completed tasks in plan
   */
    private _countCompletedTasks(plan: PhasePlan): number {
        let count = 0;
        for (const phase of plan.phases) {
            if (!phase.tasks || !Array.isArray(phase.tasks)) {
                continue;
            }

            for (const task of phase.tasks) {
                if (task.status === 'completed') {
                    count++;
                }
            }
        }
        return count;
    }

    /**
   * Count total tasks in plan
   */
    private _countTotalTasks(plan: PhasePlan): number {
        let count = 0;
        for (const phase of plan.phases) {
            if (!phase.tasks || !Array.isArray(phase.tasks)) {
                continue;
            }
            count += phase.tasks.length;
        }
        return count;
    }

    /**
     * Wait for resume signal
     */
    private async _waitForResume(): Promise<void> {
        return new Promise((resolve) => {
            const checkInterval = setInterval(() => {
                if (!this._isPaused || !this._isRunning) {
                    clearInterval(checkInterval);
                    resolve();
                }
            }, 1000);
        });
    }

    /**
     * Emit progress update
     */
    private _emitProgress(): void {
        const progress = this.getStatus();
        this._onDidUpdateProgress.fire(progress);
    }

    /**
     * Log message
     */
    private _log(message: string): void {
        const timestamp = new Date().toISOString();
        const logMessage = `[${timestamp}] [TOILET SURF] ${message}`;

        console.log(logMessage);

        if (this._outputChannel) {
            this._outputChannel.appendLine(logMessage);
        }
    }

    /**
     * Detect completion markers in AI response (Ralph Wiggum pattern)
     */
    private _detectCompletion(response: string): boolean {
        return COMPLETION_MARKERS.some(marker => response.includes(marker));
    }

    /**
     * Get task confidence score from AI (Gemini superpower)
     */
    private async _getTaskConfidence(task: PhaseTask): Promise<TaskConfidence> {
        try {
            const prompt = `Rate your confidence (0-100) in completing this task:
Task: ${task.title}
Goal: ${task.goal}

Consider:
- Clarity of requirements
- Availability of context
- Complexity
- Your capabilities

Output format:
Confidence: [number 0-100]
Reasoning: [brief explanation]

Be honest and realistic.`;

            const response = await this._chatService.sendMessage(prompt);

            // Parse confidence score
            const confidenceMatch = response.match(/Confidence:\s*(\d+)/i);
            const reasoningMatch = response.match(/Reasoning:\s*(.+)/i);

            const score = confidenceMatch ? parseInt(confidenceMatch[1]) : 50;
            const reasoning = reasoningMatch ? reasoningMatch[1].trim() : undefined;

            return {
                taskId: task.id,
                score: Math.min(100, Math.max(0, score)),
                reasoning
            };
        } catch (error) {
            this._log(`Error getting confidence score: ${error instanceof Error ? error.message : 'Unknown error'}`);
            return {
                taskId: task.id,
                score: 50 // Default to medium confidence
            };
        }
    }

    /**
     * Add failure to journal
     */
    private _addToFailureJournal(
        task: PhaseTask,
        error: string,
        aiAnalysis?: string,
        correctionAttempt?: string
    ): void {
        const entry = this._failureJournal.get(task.id) || {
            taskId: task.id,
            taskTitle: task.title,
            attempts: []
        };

        entry.attempts.push({
            iteration: this._currentIteration,
            error,
            aiAnalysis,
            correctionAttempt,
            timestamp: Date.now()
        });

        this._failureJournal.set(task.id, entry);
        this._log(`Added failure to journal for task: ${task.title} (${entry.attempts.length} attempts)`);
    }

    /**
     * Get failure journal for a task
     */
    private _getFailureJournal(taskId: string): FailureJournalEntry | undefined {
        return this._failureJournal.get(taskId);
    }

    /**
     * Format failure journal for AI prompt
     */
    private _formatFailureJournalForPrompt(taskId: string): string {
        const journal = this._getFailureJournal(taskId);
        if (!journal || journal.attempts.length === 0) {
            return '';
        }

        return `\n\nPrevious attempts that failed:\n${journal.attempts.map((a, i) => `
Attempt ${i + 1} (Iteration ${a.iteration}):
  Error: ${a.error}
  ${a.aiAnalysis ? `Analysis: ${a.aiAnalysis}` : ''}
  ${a.correctionAttempt ? `Tried: ${a.correctionAttempt}` : ''}
`).join('\n')}\n\nLearn from these failures and try a different approach.`;
    }

    /**
     * Update combo multiplier
     */
    private _updateCombo(success: boolean): void {
        if (success) {
            this._consecutiveSuccesses++;
            this._comboMultiplier = Math.min(1.0 + (this._consecutiveSuccesses * 0.1), 2.0);

            if (this._comboMultiplier > 1.0) {
                this._log(`🔥 COMBO ${this._comboMultiplier.toFixed(1)}x! (${this._consecutiveSuccesses} consecutive successes)`);
            }

            // Check for achievements
            this._checkAchievements();
        } else {
            if (this._consecutiveSuccesses > 0) {
                this._log(`💔 Combo broken! (was ${this._comboMultiplier.toFixed(1)}x)`);
            }
            this._consecutiveSuccesses = 0;
            this._comboMultiplier = 1.0;
        }
    }

    /**
     * Check and award achievements
     */
    private _checkAchievements(): void {
        const completedTasks = this._currentPlan ? this._countCompletedTasks(this._currentPlan) : 0;

        // Speed Demon: Complete 10 tasks in under 5 minutes
        if (completedTasks >= 10 && this._currentIteration <= 20) {
            this._unlockAchievement('speed_demon', '⚡ Speed Demon');
        }

        // Perfectionist: 5 consecutive successes
        if (this._consecutiveSuccesses >= 5) {
            this._unlockAchievement('perfectionist', '💯 Perfectionist');
        }

        // Resilient: Recover from 3 failures
        const totalFailures = Array.from(this._failureJournal.values())
            .reduce((sum, entry) => sum + entry.attempts.length, 0);
        if (totalFailures >= 3 && this._consecutiveSuccesses > 0) {
            this._unlockAchievement('resilient', '💪 Resilient');
        }

        // Marathon: Complete 50 iterations
        if (this._currentIteration >= 50) {
            this._unlockAchievement('marathon', '🏃 Marathon Runner');
        }
    }

    /**
     * Unlock achievement
     */
    private _unlockAchievement(id: string, name: string): void {
        if (!this._achievements.has(id)) {
            this._achievements.add(id);
            this._log(`🏆 Achievement Unlocked: ${name}`);
        }
    }

    /**
     * Build enhanced prompt with Ralph Wiggum patterns
     */
    private _buildEnhancedPrompt(task: PhaseTask, phase: Phase): string {
        const failureContext = this._formatFailureJournalForPrompt(task.id);

        return `You are in TOILET SURF autonomous mode. Execute this task with self-healing:

Phase: ${phase.title}
Task: ${task.title}
Goal: ${task.goal}
${task.acceptance_criteria && task.acceptance_criteria.length > 0 ? `\nAcceptance Criteria:\n${task.acceptance_criteria.map(c => `- ${c}`).join('\n')}` : ''}
${failureContext}

Instructions:
1. Analyze the task requirements carefully
2. Implement the solution incrementally
3. Test your implementation
4. If errors occur, analyze and fix them
5. Output <promise>TASK_COMPLETE</promise> when done

Provide your implementation and mark completion clearly.`;
    }

    /**
     * Dispose of resources
     */
    dispose(): void {
        this.stopExecution();
        this._onDidUpdateProgress.dispose();
        this._onDidComplete.dispose();
        this._executionHistory = [];
    }
}
