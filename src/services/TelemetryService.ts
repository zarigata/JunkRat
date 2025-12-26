import * as vscode from 'vscode';

export interface TelemetryEventProperties {
    [key: string]: string;
}

export interface TelemetryEventMeasurements {
    [key: string]: number;
}

export class TelemetryService {
    private _enabled: boolean = false;
    // In a real implementation, you would use a telemetry reporter like @vscode/extension-telemetry
    // For this implementation, we will stub it out or just log to output if enabled (for debugging)

    constructor(private readonly context: vscode.ExtensionContext) {
        this._updateEnabledState();

        // Listen for configuration changes
        vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('junkrat.telemetry.enabled')) {
                this._updateEnabledState();
            }
        });
    }

    private _updateEnabledState(): void {
        this._enabled = vscode.workspace.getConfiguration('junkrat').get<boolean>('telemetry.enabled', false);
    }

    /**
     * Track an event
     */
    public sendEvent(eventName: string, properties?: TelemetryEventProperties, measurements?: TelemetryEventMeasurements): void {
        if (!this._enabled) {
            return;
        }

        // In a real extension, this would send data to Azure App Insights or similar.
        // For now, we respect the user's privacy by doing nothing, or we could log to a dedicated output channel if debugging.
        // console.log(`[Telemetry] Event: ${eventName}`, properties, measurements);
    }

    /**
     * Track an error
     */
    public sendError(error: Error, properties?: TelemetryEventProperties): void {
        if (!this._enabled) {
            return;
        }

        // console.error(`[Telemetry] Error: ${error.message}`, properties);
    }

    /**
     * Track extension activation
     */
    public sendActivationEvent(): void {
        this.sendEvent('activation');
    }
}
