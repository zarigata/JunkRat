import * as vscode from 'vscode';

/**
 * UI phases for the JunkRat extension
 */
export enum UIPhase {
    SETUP = 'SETUP',           // Initial setup, provider selection
    IDLE = 'IDLE',             // Ready to receive user input
    PLANNING = 'PLANNING',     // Creating task plan
    EXECUTING = 'EXECUTING',   // Executing tasks (manual or autonomous)
    VERIFYING = 'VERIFYING',   // Verifying task completion
    ERROR = 'ERROR'            // Error state
}

/**
 * Phase transition event data
 */
export interface PhaseTransitionEvent {
    from: UIPhase;
    to: UIPhase;
    data?: any;
    timestamp: number;
}

/**
 * Manages UI state transitions and phase-specific data
 */
export class UIStateManager implements vscode.Disposable {
    private _currentPhase: UIPhase = UIPhase.SETUP;
    private _phaseData: Map<UIPhase, any> = new Map();
    private _transitionHistory: PhaseTransitionEvent[] = [];

    private readonly _onDidChangePhase = new vscode.EventEmitter<PhaseTransitionEvent>();
    public readonly onDidChangePhase = this._onDidChangePhase.event;

    /**
     * Valid state transitions
     * Maps current phase to allowed next phases
     */
    private readonly _validTransitions: Map<UIPhase, UIPhase[]> = new Map([
        [UIPhase.SETUP, [UIPhase.IDLE, UIPhase.ERROR]],
        [UIPhase.IDLE, [UIPhase.PLANNING, UIPhase.EXECUTING, UIPhase.ERROR]],
        [UIPhase.PLANNING, [UIPhase.IDLE, UIPhase.EXECUTING, UIPhase.ERROR]],
        [UIPhase.EXECUTING, [UIPhase.VERIFYING, UIPhase.IDLE, UIPhase.ERROR]],
        [UIPhase.VERIFYING, [UIPhase.EXECUTING, UIPhase.IDLE, UIPhase.ERROR]],
        [UIPhase.ERROR, [UIPhase.IDLE, UIPhase.SETUP]],
    ]);

    constructor() { }

    /**
     * Transition to a new phase
     * Validates transition and emits event
     */
    transitionTo(newPhase: UIPhase, data?: any): boolean {
        if (!this.canTransitionTo(newPhase)) {
            console.warn(`Invalid transition from ${this._currentPhase} to ${newPhase}`);
            return false;
        }

        const event: PhaseTransitionEvent = {
            from: this._currentPhase,
            to: newPhase,
            data,
            timestamp: Date.now(),
        };

        this._currentPhase = newPhase;

        if (data !== undefined) {
            this._phaseData.set(newPhase, data);
        }

        this._transitionHistory.push(event);
        this._onDidChangePhase.fire(event);

        return true;
    }

    /**
     * Get the current UI phase
     */
    getCurrentPhase(): UIPhase {
        return this._currentPhase;
    }

    /**
     * Get data associated with a specific phase
     */
    getPhaseData<T>(phase?: UIPhase): T | undefined {
        const targetPhase = phase ?? this._currentPhase;
        return this._phaseData.get(targetPhase) as T | undefined;
    }

    /**
     * Set data for a specific phase
     */
    setPhaseData(phase: UIPhase, data: any): void {
        this._phaseData.set(phase, data);
    }

    /**
     * Check if transition to target phase is valid
     */
    canTransitionTo(targetPhase: UIPhase): boolean {
        const allowedTransitions = this._validTransitions.get(this._currentPhase);
        return allowedTransitions?.includes(targetPhase) ?? false;
    }

    /**
     * Get transition history
     */
    getTransitionHistory(): PhaseTransitionEvent[] {
        return [...this._transitionHistory];
    }

    /**
     * Clear transition history
     */
    clearHistory(): void {
        this._transitionHistory = [];
    }

    /**
     * Reset to initial state
     */
    reset(): void {
        this._currentPhase = UIPhase.SETUP;
        this._phaseData.clear();
        this._transitionHistory = [];
    }

    /**
     * Get human-readable phase label
     */
    getPhaseLabel(phase?: UIPhase): string {
        const targetPhase = phase ?? this._currentPhase;

        const labels: Record<UIPhase, string> = {
            [UIPhase.SETUP]: 'Setting Up',
            [UIPhase.IDLE]: 'Ready',
            [UIPhase.PLANNING]: 'Planning',
            [UIPhase.EXECUTING]: 'Executing',
            [UIPhase.VERIFYING]: 'Verifying',
            [UIPhase.ERROR]: 'Error',
        };

        return labels[targetPhase] || 'Unknown';
    }

    /**
     * Get phase icon (codicon name)
     */
    getPhaseIcon(phase?: UIPhase): string {
        const targetPhase = phase ?? this._currentPhase;

        const icons: Record<UIPhase, string> = {
            [UIPhase.SETUP]: 'gear',
            [UIPhase.IDLE]: 'circle-outline',
            [UIPhase.PLANNING]: 'lightbulb',
            [UIPhase.EXECUTING]: 'play',
            [UIPhase.VERIFYING]: 'check',
            [UIPhase.ERROR]: 'error',
        };

        return icons[targetPhase] || 'circle-outline';
    }

    /**
     * Dispose of resources
     */
    dispose(): void {
        this._onDidChangePhase.dispose();
        this._phaseData.clear();
        this._transitionHistory = [];
    }
}
