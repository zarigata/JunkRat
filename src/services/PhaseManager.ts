import { Phase, PhasePlan } from '../types/conversation';

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
}
