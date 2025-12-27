import { Phase, PhasePlan } from '../types/conversation';
import * as vscode from 'vscode';
import { exec } from 'child_process';

interface GitCommit {
    hash: string;
    message: string;
    author: string;
    date: Date;
    files: string[];
}

export interface PhaseMatchResult {
    phaseId: string;
    matchedCommits: GitCommit[];
    confidence: number; // 0-1 score
    suggestedStatus: 'in-progress' | 'completed';
}

export class PhaseManager {
    private _activePlan: PhasePlan | undefined;

    constructor() { }

    setActivePlan(plan: PhasePlan): void {
        this._activePlan = plan;
        // Initialize status if missing
        this._activePlan.phases.forEach(phase => {
            if (!phase.status) {
                phase.status = 'pending';
            }
        });
    }

    getActivePlan(): PhasePlan | undefined {
        return this._activePlan;
    }

    updatePhaseStatus(phaseId: string, status: 'pending' | 'in-progress' | 'completed' | 'verified'): void {
        if (!this._activePlan) {
            throw new Error('No active plan');
        }

        const phase = this._activePlan.phases.find((p) => p.id === phaseId);
        if (!phase) {
            throw new Error(`Phase ${phaseId} not found`);
        }

        phase.status = status;
    }

    verifyPhase(phaseId: string): void {
        if (!this._activePlan) {
            throw new Error('No active plan');
        }

        const phase = this._activePlan.phases.find((p) => p.id === phaseId);
        if (!phase) {
            throw new Error(`Phase ${phaseId} not found`);
        }

        // Validation: phase must be completed before verification
        if (phase.status !== 'completed') {
            throw new Error('Phase must be completed before verification');
        }

        // Validation: all tasks must be completed
        if (phase.tasks && phase.tasks.length > 0) {
            const incompleteTasks = phase.tasks.filter(t => t.status !== 'completed');
            if (incompleteTasks.length > 0) {
                throw new Error(`Cannot verify phase: ${incompleteTasks.length} task(s) not completed`);
            }
        }

        phase.status = 'verified';
    }

    updateTaskStatus(phaseId: string, taskId: string, status: 'pending' | 'in-progress' | 'completed'): void {
        if (!this._activePlan) {
            throw new Error('No active plan');
        }

        const phase = this._activePlan.phases.find((p) => p.id === phaseId);
        if (!phase) {
            throw new Error(`Phase ${phaseId} not found`);
        }

        const task = phase.tasks?.find((t) => t.id === taskId);
        if (!task) {
            throw new Error(`Task ${taskId} not found in phase ${phaseId}`);
        }

        task.status = status;

        // Auto-update phase status based on task completion
        // Only if currently pending or in-progress. If already verified, do not revert automatically?
        // Plan says: "Auto-update phase status based on task completion"
        if (phase.tasks && phase.tasks.every(t => t.status === 'completed')) {
            if (phase.status !== 'verified') {
                phase.status = 'completed';
            }
        } else if (phase.status === 'completed' || phase.status === 'verified') {
            // If a task is moved back to pending/in-progress, should we revert phase status?
            // Maybe not strictly required by plan, but safe to revert 'completed' to 'in-progress'.
            // Verified might need manual un-verify? The plan doesn't specify un-verify.
            // I'll stick to plan: "Auto-update phase status based on task completion" -> implies moving forward.
            // I'll add a check to revert completion if tasks become incomplete, but not verification as that's manual.
            if (phase.status === 'completed') {
                phase.status = 'in-progress';
            }
        }
    }

    canVerifyPhase(phaseId: string): { canVerify: boolean; reason?: string } {
        if (!this._activePlan) {
            return { canVerify: false, reason: 'No active plan' };
        }

        const phase = this._activePlan.phases.find((p) => p.id === phaseId);
        if (!phase) {
            return { canVerify: false, reason: 'Phase not found' };
        }

        if (phase.status === 'verified') {
            return { canVerify: false, reason: 'Phase already verified' };
        }

        if (phase.status !== 'completed') {
            return { canVerify: false, reason: 'Phase must be completed first' };
        }

        if (phase.tasks && phase.tasks.length > 0) {
            const incompleteTasks = phase.tasks.filter(t => t.status !== 'completed');
            if (incompleteTasks.length > 0) {
                return { canVerify: false, reason: `${incompleteTasks.length} task(s) not completed` };
            }
        }

        return { canVerify: true };
    }

    getPhaseProgress(): { completed: number; verified: number; total: number } {
        if (!this._activePlan) {
            return { completed: 0, verified: 0, total: 0 };
        }

        const completed = this._activePlan.phases.filter(p => p.status === 'completed' || p.status === 'verified').length;
        const verified = this._activePlan.phases.filter(p => p.status === 'verified').length;

        return {
            completed,
            verified,
            total: this._activePlan.phases.length
        };
    }

    getNextPhase(): Phase | undefined {
        if (!this._activePlan) return undefined;
        return this._activePlan.phases.find(p => p.status === 'pending');
    }

    getCurrentPhase(): Phase | undefined {
        if (!this._activePlan) return undefined;
        return this._activePlan.phases.find(p => p.status === 'in-progress');
    }

    insertPhase(phase: Phase, afterPhaseId: string | null): void {
        if (!this._activePlan) {
            throw new Error('No active plan');
        }

        const insertionIndex = afterPhaseId
            ? this._activePlan.phases.findIndex((p) => p.id === afterPhaseId) + 1
            : 0;

        if (insertionIndex === 0 && afterPhaseId) {
            throw new Error(`Phase ${afterPhaseId} not found`);
        }

        // Insert phase
        this._activePlan.phases.splice(insertionIndex, 0, phase);
        this._activePlan.totalPhases = this._activePlan.phases.length;

        // Recalculate order
        this._recalculatePhaseOrders();
    }

    editPhase(phaseId: string, updates: Partial<Phase>): void {
        const { canEdit, reason } = this.canEditPhase(phaseId);
        if (!canEdit) {
            throw new Error(reason ?? 'Cannot edit phase');
        }

        const phase = this._activePlan!.phases.find((p) => p.id === phaseId)!;
        Object.assign(phase, updates);
    }

    deletePhase(phaseId: string): void {
        const { canDelete, reason } = this.canDeletePhase(phaseId);
        if (!canDelete) {
            throw new Error(reason ?? 'Cannot delete phase');
        }

        this._activePlan!.phases = this._activePlan!.phases.filter((p) => p.id !== phaseId);
        this._activePlan!.totalPhases = this._activePlan!.phases.length;

        // Remove from dependencies of other phases
        this._activePlan!.phases.forEach((p) => {
            if (p.dependencies.includes(phaseId)) {
                p.dependencies = p.dependencies.filter((d) => d !== phaseId);
            }
        });

        this._recalculatePhaseOrders();
    }

    canEditPhase(phaseId: string): { canEdit: boolean; reason?: string } {
        if (!this._activePlan) {
            return { canEdit: false, reason: 'No active plan' };
        }

        const phase = this._activePlan.phases.find((p) => p.id === phaseId);
        if (!phase) {
            return { canEdit: false, reason: 'Phase not found' };
        }

        if (phase.status !== 'pending') {
            return { canEdit: false, reason: 'Only pending phases can be edited' };
        }

        return { canEdit: true };
    }

    canDeletePhase(phaseId: string): { canDelete: boolean; reason?: string } {
        const { canEdit, reason } = this.canEditPhase(phaseId); // Recycle existence and status check
        if (!canEdit) {
            return { canDelete: false, reason };
        }

        // Check if other phases depend on this one
        const dependents = this._activePlan!.phases.filter(
            (p) => p.dependencies.includes(phaseId) && p.status !== 'pending'
        );

        if (dependents.length > 0) {
            return {
                canDelete: false,
                reason: `Cannot delete phase: ${dependents.length} active/completed phases depend on it`,
            };
        }

        return { canDelete: true };
    }

    private _recalculatePhaseOrders(): void {
        if (!this._activePlan) return;
        this._activePlan.phases.forEach((phase, index) => {
            phase.order = index + 1;
        });
    }

    async scanGitHistory(maxCommits: number = 100): Promise<GitCommit[]> {
        // Use configuration for max commits if available, otherwise use default
        const configMaxCommits = vscode.workspace.getConfiguration('junkrat.git').get<number>('maxCommits');
        const limit = configMaxCommits || maxCommits;

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            console.log('No workspace folders found');
            return [];
        }

        const rootPath = workspaceFolders[0].uri.fsPath;

        try {
            // Use git CLI directly to get files + metadata
            // Format: HASH%nMESSAGE%nAUTHOR%nDATE%nFILES
            // We use a custom separator to parse reliably
            const separator = '|||';
            const commitSeparator = 'END_COMMIT';

            // Format: hash | author | date | subject | body
            // Followed by name-only file list
            const cmd = `git log -n ${limit} --name-only --pretty=format:"%H${separator}%an${separator}%ad${separator}%s${separator}%b${separator}"`;

            return new Promise((resolve) => {
                exec(cmd, { cwd: rootPath, maxBuffer: 1024 * 1024 * 10 }, (error: any, stdout: string, stderr: string) => {
                    if (error) {
                        console.error('Git log error:', error);
                        resolve([]);
                        return;
                    }

                    const commits: GitCommit[] = [];
                    const rawCommits = stdout.split('\n\n'); // Approximate split, better to parse line by line
                    // Actually, --name-only output puts files on new lines after the commit metadata.
                    // And git log separates commits with newlines. 

                    // Robust parsing:
                    const lines = stdout.split('\n');
                    let currentCommit: Partial<GitCommit> | null = null;

                    for (let i = 0; i < lines.length; i++) {
                        const line = lines[i].trim();
                        if (line.includes(separator)) {
                            // New commit header
                            if (currentCommit && currentCommit.hash) {
                                commits.push(currentCommit as GitCommit);
                            }

                            const parts = line.split(separator);
                            if (parts.length >= 4) {
                                currentCommit = {
                                    hash: parts[0],
                                    author: parts[1],
                                    date: new Date(parts[2]),
                                    message: parts[3] + (parts[4] ? '\n' + parts[4] : ''),
                                    files: []
                                };
                            }
                        } else if (line.length > 0 && currentCommit) {
                            // File path
                            currentCommit.files?.push(line);
                        }
                    }

                    // Push last commit
                    if (currentCommit && currentCommit.hash) {
                        commits.push(currentCommit as GitCommit);
                    }

                    resolve(commits);
                });
            });

        } catch (e) {
            console.error('Error scanning git history:', e);
            return [];
        }
    }

    matchCommitsToPhases(commits: GitCommit[]): PhaseMatchResult[] {
        if (!this._activePlan) return [];

        const results: PhaseMatchResult[] = [];

        this._activePlan.phases.forEach(phase => {
            const phaseKeywords = this._extractKeywords(phase.title + ' ' + phase.description);
            const matchedCommits: GitCommit[] = [];
            let totalScore = 0;

            // Collect files involved in this phase (from tasks)
            const phaseFiles = new Set<string>();
            if (phase.tasks) {
                phase.tasks.forEach(task => {
                    if (task.files) {
                        task.files.forEach(f => phaseFiles.add(f));
                    }
                });
            }

            commits.forEach(commit => {
                let score = 0;
                const messageLower = commit.message.toLowerCase();

                // Check keywords
                const keywordMatches = phaseKeywords.filter(k => messageLower.includes(k));
                if (keywordMatches.length > 0) {
                    score += 0.3 * (keywordMatches.length / phaseKeywords.length);
                }

                // Title exact match (or close to it)
                if (messageLower.includes(phase.title.toLowerCase())) {
                    score += 0.5;
                }

                // Files overlap matching
                if (commit.files && commit.files.length > 0 && phaseFiles.size > 0) {
                    const commitFiles = new Set(commit.files);
                    // Check intersection
                    let hasOverlap = false;
                    for (const file of phaseFiles) {
                        // Check for partial matches/basenames since git paths are relative to root
                        // and phase paths might be absolute or varied.
                        // Simplest check: does commit file end with phase file or vice versa?
                        const base = file.split(/[/\\]/).pop();
                        if (base && Array.from(commitFiles).some(cf => cf.endsWith(base) || cf.includes(base))) {
                            hasOverlap = true;
                            break;
                        }
                    }

                    if (hasOverlap) {
                        score += 0.4; // Significant boost for file match
                    }
                }

                if (score > 0.4) {
                    matchedCommits.push(commit);
                    totalScore += score;
                }
            });

            if (matchedCommits.length > 0) {
                // Normalize score
                const confidence = Math.min(totalScore / matchedCommits.length, 1);

                // Determine status
                let suggestedStatus: 'in-progress' | 'completed' = 'in-progress';
                if (matchedCommits.length >= 2 || confidence > 0.8) {
                    suggestedStatus = 'completed';
                }

                results.push({
                    phaseId: phase.id,
                    matchedCommits,
                    confidence,
                    suggestedStatus
                });
            }
        });

        return results.sort((a, b) => b.confidence - a.confidence);
    }

    private _extractKeywords(text: string): string[] {
        const stopWords = ['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'implement', 'add', 'create', 'update', 'fix'];
        return text.toLowerCase()
            .split(/[\s\W]+/)
            .filter(w => w.length > 3 && !stopWords.includes(w));
    }

    async autoUpdateFromGit(dryRun: boolean = false): Promise<{ updated: number; results: PhaseMatchResult[] }> {
        const commits = await this.scanGitHistory();
        if (commits.length === 0) {
            return { updated: 0, results: [] };
        }

        const results = this.matchCommitsToPhases(commits);
        const autoUpdateThreshold = vscode.workspace.getConfiguration('junkrat.git').get<number>('autoUpdateThreshold') || 0.6;
        let updatedCount = 0;

        for (const result of results) {
            if (result.confidence >= autoUpdateThreshold) {
                const phase = this._activePlan?.phases.find(p => p.id === result.phaseId);
                if (phase && phase.status === 'pending') {
                    if (!dryRun) {
                        this.updatePhaseStatus(phase.id, result.suggestedStatus);
                    }
                    updatedCount++;
                }
            }
        }

        console.log(`Git scan found ${commits.length} commits, matched ${results.length} phases, updated ${updatedCount}`);
        return { updated: updatedCount, results };
    }

    async executeRunCommand(
        command?: string,
        workingDir?: string
    ): Promise<{
        success: boolean;
        exitCode: number;
        stdout: string;
        stderr: string;
        duration: number;
        command: string;
    }> {
        const config = vscode.workspace.getConfiguration('junkrat.runAnalysis');
        const enabled = config.get<boolean>('enabled');

        if (!enabled) {
            throw new Error('Run analysis is disabled. Enable it in settings.');
        }

        const finalCommand = command || config.get<string>('command') || 'npm test';
        const timeout = config.get<number>('timeout') || 120000;

        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            throw new Error('No workspace folder open');
        }

        const rootPath = workspaceFolders[0].uri.fsPath;
        const cwd = workingDir || config.get<string>('workingDirectory') || rootPath;

        const startTime = Date.now();

        return new Promise((resolve) => {
            const process = exec(
                finalCommand,
                {
                    cwd,
                    maxBuffer: 1024 * 1024 * 10, // 10MB buffer
                    timeout
                },
                (error: any, stdout: string, stderr: string) => {
                    const duration = Date.now() - startTime;
                    const exitCode = error?.code ?? 0;
                    const success = exitCode === 0;

                    resolve({
                        success,
                        exitCode,
                        stdout: stdout || '',
                        stderr: stderr || '',
                        duration,
                        command: finalCommand
                    });
                }
            );

            // Handle timeout
            setTimeout(() => {
                try {
                    process.kill();
                } catch (e) {
                    // Process may have already exited
                }
            }, timeout + 1000);
        });
    }

    async analyzeTestOutputWithAI(
        result: {
            success: boolean;
            exitCode: number;
            stdout: string;
            stderr: string;
            command: string;
        },
        provider: any // IAIProvider, but avoid circular import
    ): Promise<{
        summary: string;
        affectedPhases: Array<{
            phaseId: string;
            status: 'passed' | 'failed' | 'skipped';
            reason: string;
        }>;
        suggestions: string[];
    }> {
        if (!this._activePlan) {
            return {
                summary: 'No active phase plan to analyze against.',
                affectedPhases: [],
                suggestions: []
            };
        }

        // Build context for AI
        const phaseContext = this._activePlan.phases
            .map((p, idx) => `${idx + 1}. [${p.status}] ${p.title}: ${p.description}`)
            .join('\n');

        const prompt = `You are analyzing test/build output to verify phase completion in a development plan.
      
**Current Phase Plan:**
${phaseContext}
      
**Command Executed:** \`${result.command}\`
**Exit Code:** ${result.exitCode}
**Success:** ${result.success}
      
**Output:**
\`\`\`
${result.stdout.slice(0, 5000)}
${result.stdout.length > 5000 ? '\n... (truncated)' : ''}
\`\`\`
      
**Errors:**
\`\`\`
${result.stderr.slice(0, 2000)}
${result.stderr.length > 2000 ? '\n... (truncated)' : ''}
\`\`\`
      
**Task:**
1. Provide a concise summary (2-3 sentences) of what the test/build results indicate.
2. For each phase in the plan, determine if the output suggests it's "passed", "failed", or "skipped" (not relevant to this test).
3. Provide 2-3 actionable suggestions for next steps.
      
**Response Format (JSON):**
\`\`\`json
{
  "summary": "Brief summary here",
  "affectedPhases": [
    {"phaseId": "phase-id", "status": "passed|failed|skipped", "reason": "Why this status"}
  ],
  "suggestions": ["Suggestion 1", "Suggestion 2"]
}
\`\`\``;

        try {
            const response = await provider.chat({
                messages: [{ role: 'user', content: prompt }],
                temperature: 0.3,
                stream: false
            });

            // Parse JSON from response
            const jsonMatch = response.content.match(/```json\s*([\s\S]*?)```/);
            if (jsonMatch) {
                const parsed = JSON.parse(jsonMatch[1]);
                return parsed;
            }

            // Fallback if no JSON found
            return {
                summary: response.content.slice(0, 500),
                affectedPhases: [],
                suggestions: []
            };
        } catch (error) {
            console.error('AI analysis failed:', error);
            return {
                summary: `Test ${result.success ? 'passed' : 'failed'} with exit code ${result.exitCode}.`,
                affectedPhases: [],
                suggestions: ['Review output manually', 'Check logs for details']
            };
        }
    }
}
