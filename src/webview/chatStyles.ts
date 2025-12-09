/**
 * Returns CSS styles for the chat interface using VS Code CSS variables for theming
 */
export function getChatStyles(): string {
  return `
    * {
      box-sizing: border-box;
    }

    body {
      margin: 0;
      padding: 0;
      height: 100vh;
      overflow: hidden;
      font-family: var(--vscode-font-family);
      font-size: var(--vscode-font-size);
      color: var(--vscode-editor-foreground);
      background-color: var(--vscode-editor-background);
    }

    .chat-container {
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
    }

    .messages-container {
      flex-grow: 1;
      overflow-y: auto;
      padding: 16px;
      scroll-behavior: smooth;
    }

    .messages-container::-webkit-scrollbar {
      width: 10px;
    }

    .messages-container::-webkit-scrollbar-track {
      background: var(--vscode-scrollbarSlider-background);
    }

    .messages-container::-webkit-scrollbar-thumb {
      background: var(--vscode-scrollbarSlider-hoverBackground);
      border-radius: 5px;
    }

    .messages-container::-webkit-scrollbar-thumb:hover {
      background: var(--vscode-scrollbarSlider-activeBackground);
    }

    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--vscode-descriptionForeground);
      text-align: center;
      padding: 20px;
    }

    .empty-state .codicon {
      font-size: 48px;
      margin-bottom: 16px;
      opacity: 0.6;
    }

    .empty-state p {
      margin: 8px 0;
      font-size: 14px;
    }

    .message {
      margin-bottom: 16px;
      padding: 12px 16px;
      border-radius: 8px;
      max-width: 80%;
      word-wrap: break-word;
      animation: fadeIn 0.2s ease-in;
    }

    @keyframes fadeIn {
      from {
        opacity: 0;
        transform: translateY(10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    .message.user {
      margin-left: auto;
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border-bottom-right-radius: 4px;
    }

    .message.assistant {
      margin-right: auto;
      background-color: var(--vscode-input-background);
      border: 1px solid var(--vscode-input-border);
      border-bottom-left-radius: 4px;
    }

    .message-text {
      white-space: pre-wrap;
      word-wrap: break-word;
      line-height: 1.5;
    }

    .message-timestamp {
      font-size: 11px;
      opacity: 0.7;
      margin-top: 6px;
      text-align: right;
    }

    .input-container {
      display: flex;
      flex-direction: row;
      padding: 12px;
      gap: 8px;
      border-top: 1px solid var(--vscode-panel-border);
      background-color: var(--vscode-editor-background);
    }

    .provider-selector {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 8px 12px;
      border-bottom: 1px solid var(--vscode-panel-border);
      background-color: var(--vscode-editor-background);
      font-size: 12px;
    }

    .provider-selector-label {
      color: var(--vscode-descriptionForeground);
      font-weight: 500;
      white-space: nowrap;
    }

    #provider-select {
      flex-grow: 1;
      padding: 4px 8px;
      border-radius: 3px;
      background-color: var(--vscode-dropdown-background);
      color: var(--vscode-dropdown-foreground);
      border: 1px solid var(--vscode-dropdown-border);
      font-family: inherit;
      font-size: inherit;
      cursor: pointer;
      outline: none;
    }

    #provider-select:focus {
      outline: 1px solid var(--vscode-focusBorder);
      outline-offset: -1px;
    }

    .provider-status {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
    }

    .provider-status .codicon {
      font-size: 12px;
    }

    .provider-status.available {
      color: var(--vscode-testing-iconPassed, #3fb950);
    }

    .provider-status.unavailable {
      color: var(--vscode-testing-iconFailed, #f85149);
    }

    .settings-button {
      padding: 4px 8px;
      border-radius: 3px;
      background-color: transparent;
      color: var(--vscode-button-secondaryForeground);
      border: 1px solid var(--vscode-button-secondaryBorder);
      cursor: pointer;
      font-size: 11px;
      display: inline-flex;
      align-items: center;
      gap: 4px;
      transition: background-color 0.1s ease;
    }

    .settings-button:hover {
      background-color: var(--vscode-button-secondaryHoverBackground);
    }

    #message-input {
      flex-grow: 1;
      padding: 8px 12px;
      border-radius: 4px;
      background-color: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      font-family: inherit;
      font-size: inherit;
      resize: none;
      min-height: 60px;
      max-height: 200px;
      outline: none;
    }

    #message-input:focus {
      outline: 1px solid var(--vscode-focusBorder);
      outline-offset: -1px;
    }

    #message-input::placeholder {
      color: var(--vscode-input-placeholderForeground);
    }

    #send-button {
      padding: 8px 16px;
      border-radius: 4px;
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      cursor: pointer;
      font-family: inherit;
      font-size: inherit;
      font-weight: 500;
      transition: background-color 0.1s ease;
      white-space: nowrap;
    }

    #send-button:hover {
      background-color: var(--vscode-button-hoverBackground);
    }

    #send-button:active {
      transform: scale(0.98);
    }

    #send-button:focus {
      outline: 1px solid var(--vscode-focusBorder);
      outline-offset: 2px;
    }

    #send-button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }

    .codicon {
      font-family: codicon;
      font-size: 16px;
    }

    /* Phase List Styles (Traycer-style) */
    .phase-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .phase-item {
      background-color: var(--vscode-editor-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 6px;
      padding: 12px;
      transition: border-color 0.2s;
    }

    .phase-item:hover {
      border-color: var(--vscode-focusBorder);
    }

    .phase-item-header {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 8px;
      flex-wrap: wrap;
    }

    .phase-number {
      background-color: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 11px;
      font-weight: 600;
    }

    .phase-title {
      font-weight: 600;
      flex: 1;
    }

    .phase-complexity {
      font-size: 10px;
      padding: 2px 6px;
      border-radius: 3px;
      text-transform: uppercase;
    }

    .complexity-low { background-color: #3fb950; color: #000; }
    .complexity-medium { background-color: #d29922; color: #000; }
    .complexity-high { background-color: #f85149; color: #fff; }

    .phase-description {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 10px;
      line-height: 1.5;
    }

    /* Task List Styles */
    .task-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-top: 10px;
      padding-top: 10px;
      border-top: 1px solid var(--vscode-panel-border);
    }

    .task-item {
      background-color: var(--vscode-input-background);
      border-radius: 4px;
      padding: 10px;
    }

    .task-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
    }

    .task-info {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .task-number {
      background-color: var(--vscode-editorLineNumber-foreground);
      color: var(--vscode-editor-background);
      width: 20px;
      height: 20px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 600;
    }

    .task-title {
      font-weight: 500;
      font-size: 13px;
    }

    .task-goal {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      line-height: 1.4;
    }

    .task-actions {
      display: flex;
      gap: 6px;
    }

    /* Execute Dropdown */
    .execute-dropdown {
      position: relative;
    }

    .execute-btn {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      border: none;
      border-radius: 4px;
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      font-size: 11px;
      cursor: pointer;
      transition: background-color 0.15s;
    }

    .execute-btn:hover {
      background-color: var(--vscode-button-hoverBackground);
    }

    .execute-menu {
      display: none;
      position: absolute;
      right: 0;
      top: 100%;
      min-width: 160px;
      background-color: var(--vscode-menu-background);
      border: 1px solid var(--vscode-menu-border);
      border-radius: 4px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      z-index: 100;
      margin-top: 4px;
    }

    .execute-dropdown.open .execute-menu {
      display: block;
    }

    .execute-option {
      display: flex;
      align-items: center;
      gap: 8px;
      width: 100%;
      padding: 8px 12px;
      border: none;
      background: none;
      color: var(--vscode-menu-foreground);
      font-size: 12px;
      cursor: pointer;
      text-align: left;
    }

    .execute-option:hover {
      background-color: var(--vscode-list-hoverBackground);
    }

    .execute-option .codicon {
      font-size: 14px;
      opacity: 0.8;
    }
    .model-selector {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      border-bottom: 1px solid var(--vscode-panel-border);
      background-color: var(--vscode-editor-background);
      font-size: 12px;
      flex-wrap: wrap;
    }

    .model-selector-label {
      color: var(--vscode-descriptionForeground);
      font-weight: 500;
      white-space: nowrap;
    }

    #model-select {
      flex: 1 1 auto;
      min-width: 100px;
      padding: 4px 8px;
      border-radius: 3px;
      background-color: var(--vscode-dropdown-background);
      color: var(--vscode-dropdown-foreground);
      border: 1px solid var(--vscode-dropdown-border);
      font-family: inherit;
      font-size: inherit;
      cursor: pointer;
      outline: none;
    }

    #model-select:focus {
      outline: 1px solid var(--vscode-focusBorder);
      outline-offset: -1px;
    }

    .model-status {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
    }

    .model-status.running {
      color: var(--vscode-testing-iconPassed, #3fb950);
    }

    .model-size {
      font-size: 10px;
      color: var(--vscode-descriptionForeground);
      opacity: 0.8;
    }

    /* Responsive Styles */
    @media (max-width: 300px) {
      .provider-selector {
        flex-direction: column;
        align-items: stretch;
        gap: 6px;
      }

      .provider-selector-label {
        display: none;
      }

      .model-selector {
        flex-direction: column;
        align-items: stretch;
        gap: 6px;
      }

      .model-selector-label {
        display: none;
      }

      .message {
        max-width: 100%;
      }

      .input-container {
        flex-direction: column;
        gap: 6px;
      }

      #send-button {
        width: 100%;
      }

      .settings-button span:not(.codicon) {
        display: none;
      }
    }

    /* Narrow sidebar optimizations */
    @media (max-width: 250px) {
      .messages-container {
        padding: 8px;
      }

      .message {
        padding: 8px 10px;
        font-size: 12px;
      }

      .provider-status span:not(.codicon) {
        display: none;
      }

      #message-input {
        font-size: 12px;
        padding: 6px 8px;
      }

      #send-button {
        padding: 6px 10px;
        font-size: 12px;
      }
    }
  `;
}
