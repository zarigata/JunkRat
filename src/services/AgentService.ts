import * as vscode from 'vscode';

export class AgentService {
    private _terminal: vscode.Terminal | undefined;

    constructor() { }

    async executeCommand(command: string, cwd?: string): Promise<void> {
        // 1. Safety Check: Ask user for permission
        const selection = await vscode.window.showWarningMessage(
            `JunkRat wants to execute: "${command}". Do you allow this?`,
            'Yes',
            'No'
        );

        if (selection !== 'Yes') {
            throw new Error('User denied command execution.');
        }

        // 2. Get or create terminal
        if (!this._terminal || this._terminal.exitStatus !== undefined) {
            this._terminal = vscode.window.createTerminal('JunkRat Agent');
        }

        this._terminal.show();

        // 3. Execute command
        if (cwd) {
            this._terminal.sendText(`cd "${cwd}" && ${command}`);
        } else {
            this._terminal.sendText(command);
        }
    }

    dispose() {
        this._terminal?.dispose();
    }
}
