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

    getNextPhase(): Phase | undefined {
        if (!this._activePlan) return undefined;
        return this._activePlan.phases.find(p => p.status === 'pending');
    }

    getCurrentPhase(): Phase | undefined {
        if (!this._activePlan) return undefined;
        return this._activePlan.phases.find(p => p.status === 'in-progress');
    }
}
