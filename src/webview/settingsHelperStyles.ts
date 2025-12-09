export function getSettingsHelperStyles(): string {
  return `
    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      padding: 0;
      height: 100vh;
      background: var(--vscode-editor-background);
      color: var(--vscode-editor-foreground);
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      display: flex;
      flex-direction: column;
    }

    .settings-helper-container {
      flex: 1;
      display: flex;
      flex-direction: column;
      padding: 16px;
      gap: 16px;
      overflow-y: auto;
    }

    .settings-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 8px;
    }

    .settings-header .codicon {
      font-size: 24px;
      color: var(--vscode-descriptionForeground);
    }

    .settings-header h2 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
    }

    .settings-section {
      margin: 0;
      padding: 12px;
      border-radius: 6px;
      background: var(--vscode-editor-background);
      border: 1px solid var(--vscode-panel-border);
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .settings-section h3 {
      margin: 0;
      font-size: 14px;
      font-weight: 600;
      color: var(--vscode-editor-foreground);
    }

    .provider-status-list {
      list-style: none;
      padding: 0;
      margin: 0;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }

    .provider-status-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 8px;
      border-radius: 4px;
      background: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border);
      gap: 12px;
    }

    .provider-info {
      display: flex;
      align-items: center;
      gap: 8px;
      flex: 1;
    }

    .provider-info .codicon {
      font-size: 16px;
    }

    .status-badges {
      display: flex;
      gap: 6px;
      flex-wrap: wrap;
    }

    .status-badge {
      padding: 2px 8px;
      border-radius: 3px;
      font-size: 11px;
      font-weight: 500;
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
    }

    .status-badge.enabled {
      background: var(--vscode-testing-iconPassed, #198038);
      color: var(--vscode-testing-runAction, #ffffff);
    }

    .status-badge.disabled {
      background: var(--vscode-testing-iconQueued, #8e8e8e);
      color: var(--vscode-editor-foreground);
    }

    .status-badge.valid {
      background: var(--vscode-testing-iconPassed, #3fb950);
      color: var(--vscode-editor-foreground);
    }

    .status-badge.invalid {
      background: var(--vscode-testing-iconFailed, #f85149);
      color: var(--vscode-editor-foreground);
    }

    .status-badge.warning {
      background: var(--vscode-testing-iconQueued, #e3b341);
      color: var(--vscode-editor-foreground);
    }

    .action-buttons {
      display: flex;
      gap: 8px;
    }

    .action-button {
      padding: 6px 12px;
      border-radius: 4px;
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      cursor: pointer;
      font-size: 12px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: background 0.1s ease;
    }

    .action-button.secondary {
      background: transparent;
      color: var(--vscode-button-secondaryForeground);
      border: 1px solid var(--vscode-button-secondaryBorder);
    }

    .action-button:hover {
      background: var(--vscode-button-hoverBackground);
    }

    .action-button.secondary:hover {
      background: var(--vscode-button-secondaryHoverBackground);
    }

    .validation-message {
      padding: 8px 12px;
      border-radius: 4px;
      font-size: 12px;
      line-height: 1.4;
      background: var(--vscode-notifications-background);
      border: 1px solid var(--vscode-notifications-border);
    }

    .validation-message.success {
      border-color: var(--vscode-testing-iconPassed, #3fb950);
    }

    .validation-message.error {
      border-color: var(--vscode-testing-iconFailed, #f85149);
    }

    .validation-message.warning {
      border-color: var(--vscode-testing-iconQueued, #e3b341);
    }

    .help-text {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      line-height: 1.6;
    }

    .settings-link {
      color: var(--vscode-textLink-foreground);
      text-decoration: none;
      cursor: pointer;
    }

    .settings-link:hover {
      text-decoration: underline;
    }

    .empty-state {
      text-align: center;
      padding: 32px;
      color: var(--vscode-descriptionForeground);
    }

    .empty-state .codicon {
      font-size: 32px;
      margin-bottom: 12px;
    }
  `;
}
