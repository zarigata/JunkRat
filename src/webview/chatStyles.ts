/**
 * Returns CSS styles for the chat interface using VS Code CSS variables for theming
 */
export function getChatStyles(): string {
  return `
    * {
      box-sizing: border-box;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
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

    /* Chat Header */
    .chat-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
      background-color: var(--vscode-titleBar-activeBackground);
      border-bottom: 1px solid var(--vscode-focusBorder);
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
    }

    .header-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 600;
      font-size: 15px;
      letter-spacing: 0.5px;
      color: var(--vscode-titleBar-activeForeground);
    }

    .header-title .codicon {
      font-size: 18px;
      color: var(--vscode-symbolIcon-classForeground);
    }

    .header-actions {
      display: flex;
      gap: 6px;
    }

    .header-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      width: 32px;
      height: 32px;
      border: none;
      border-radius: 4px;
      background-color: var(--vscode-button-secondaryBackground);
      color: var(--vscode-foreground);
      cursor: pointer;
      transition: transform 0.15s ease, box-shadow 0.15s ease, background-color 0.15s;
    }

    .header-btn:hover {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      transform: translateY(-1px);
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    }

    .header-btn:active {
      transform: translateY(0) scale(0.97);
    }

    .header-btn .codicon {
      font-size: 18px;
    }
    
    .header-btn.primary {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }
    
    .header-btn.danger:hover {
      background-color: var(--vscode-errorForeground);
      color: var(--vscode-button-foreground);
    }

    .messages-container {
      flex-grow: 1;
      overflow-y: auto;
      padding: 16px;
      scroll-behavior: smooth;
      overscroll-behavior: contain;
      box-shadow: inset 0 4px 6px -4px rgba(0,0,0,0.1), inset 0 -4px 6px -4px rgba(0,0,0,0.1);
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

    /* Enhanced Empty State */
    .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      color: var(--vscode-descriptionForeground);
      text-align: center;
      padding: 32px;
      background: linear-gradient(180deg, var(--vscode-editor-background) 0%, rgba(255,255,255,0.02) 100%);
    }

    .empty-state .codicon {
      font-size: 64px;
      margin-bottom: 24px;
      opacity: 0.8;
      animation: float 3s ease-in-out infinite;
      color: var(--vscode-textLink-foreground);
    }
    
    .empty-state h2 {
      font-size: 18px;
      font-weight: 600;
      margin: 0 0 8px 0;
      color: var(--vscode-foreground);
    }

    .empty-state p.subtitle {
      margin: 0 0 24px 0;
      font-size: 14px;
      max-width: 300px;
    }
    
    .empty-state-features {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-bottom: 24px;
      text-align: left;
    }
    
    .feature-item {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 13px;
      padding: 8px 12px;
      background-color: var(--vscode-textBlockQuote-background);
      border-radius: 6px;
      animation: fadeInUp 0.4s ease-out backwards;
    }
    
    .feature-item:nth-child(1) { animation-delay: 0.1s; }
    .feature-item:nth-child(2) { animation-delay: 0.2s; }
    .feature-item:nth-child(3) { animation-delay: 0.3s; }
    
    .feature-item .codicon {
      font-size: 16px;
      margin-bottom: 0;
      animation: none;
      color: var(--vscode-textLink-activeForeground);
    }
    
    .empty-state-cta {
      font-size: 13px;
      color: var(--vscode-textLink-foreground);
      font-weight: 600;
      margin-top: 20px;
      opacity: 0.9;
    }

    @keyframes float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-10px); }
    }
    
    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(10px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .message {
      margin-bottom: 16px;
      padding: 12px 16px;
      border-radius: 12px;
      max-width: 85%;
      word-wrap: break-word;
      box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      position: relative;
    }

    /* Message Animations */
    @keyframes slideInFromRight {
      from { opacity: 0; transform: translateX(20px) scale(0.95); }
      to { opacity: 1; transform: translateX(0) scale(1); }
    }

    @keyframes slideInFromLeft {
      from { opacity: 0; transform: translateX(-20px) scale(0.95); }
      to { opacity: 1; transform: translateX(0) scale(1); }
    }

    .message.user {
      margin-left: auto;
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border-bottom-right-radius: 4px;
      opacity: 0.95;
      animation: slideInFromRight 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
    }

    .message.assistant {
      margin-right: auto;
      background-color: var(--vscode-editor-inactiveSelectionBackground); 
      border: 1px solid rgba(var(--vscode-focusBorder-rgb), 0.3); /* Fallback or constructed if rgb var not available, using opacity on border */
      border-bottom-left-radius: 4px;
      border-left: 3px solid var(--vscode-focusBorder);
      animation: slideInFromLeft 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
    }

    .message.error {
      margin-right: auto;
      background-color: var(--vscode-inputValidation-errorBackground);
      border: 1px solid var(--vscode-inputValidation-errorBorder);
      border-left: 3px solid var(--vscode-errorForeground);
      border-radius: 4px;
      padding: 12px;
      width: 85%;
    }

    .error-header {
      display: flex;
      align-items: center;
      gap: 8px;
      color: var(--vscode-errorForeground);
      margin-bottom: 8px;
      font-weight: 600;
      text-transform: capitalize;
    }

    .error-body {
      margin-bottom: 12px;
      font-size: 13px;
    }

    .error-details {
      font-family: monospace;
      font-size: 11px;
      background-color: rgba(0,0,0,0.1);
      padding: 6px;
      border-radius: 4px;
      margin-bottom: 12px;
      white-space: pre-wrap;
      opacity: 0.8;
    }

    .error-actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }

    .error-action-btn {
      padding: 6px 12px;
      border: 1px solid var(--vscode-button-border);
      background-color: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border-radius: 4px;
      cursor: pointer;
      font-size: 11px;
      transition: all 0.2s;
    }

    .error-action-btn:hover {
      background-color: var(--vscode-button-secondaryHoverBackground);
    }
    
    /* Ensure border works if no rgb var */
    .message.assistant {
         border-color: var(--vscode-focusBorder);
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
      padding: 16px;
      gap: 12px;
      border-top: 1px solid var(--vscode-panel-border);
      background-color: var(--vscode-editor-background);
      box-shadow: 0 -2px 10px rgba(0,0,0,0.05);
    }

    .provider-selector {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 10px 16px;
      border-bottom: 1px solid var(--vscode-panel-border);
      background-color: var(--vscode-editor-background);
      font-size: 12px;
    }

    .provider-selector-label {
      color: var(--vscode-descriptionForeground);
      font-weight: 600;
      white-space: nowrap;
    }

    #provider-select {
      flex-grow: 1;
      padding: 6px 10px;
      border-radius: 4px;
      background-color: var(--vscode-dropdown-background);
      color: var(--vscode-dropdown-foreground);
      border: 1px solid var(--vscode-dropdown-border);
      font-family: inherit;
      font-size: inherit;
      cursor: pointer;
      outline: none;
      transition: all 0.2s;
    }

    #provider-select:focus {
      outline: 1px solid var(--vscode-focusBorder);
      box-shadow: 0 0 0 2px rgba(0, 122, 204, 0.2); /* Fallback */
    }

    .provider-status {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      font-weight: 500;
    }

    .provider-status .codicon {
      font-size: 14px;
    }
    
    @keyframes pulse {
      0% { opacity: 0.5; transform: scale(0.95); }
      50% { opacity: 1; transform: scale(1.05); }
      100% { opacity: 0.5; transform: scale(0.95); }
    }
    
    .provider-status.checking .codicon {
        animation: pulse 1.5s infinite ease-in-out;
    }

    .provider-status.available {
      color: var(--vscode-charts-green);
    }

    .provider-status.unavailable {
      color: var(--vscode-charts-red);
    }

    .settings-button {
      padding: 6px 10px;
      border-radius: 4px;
      background-color: transparent;
      color: var(--vscode-button-secondaryForeground);
      border: 1px solid var(--vscode-button-secondaryBorder);
      cursor: pointer;
      font-size: 11px;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s ease;
    }

    .settings-button:hover {
      background-color: var(--vscode-button-secondaryHoverBackground);
      transform: translateY(-1px);
    }

    #message-input {
      flex-grow: 1;
      padding: 12px;
      border-radius: 6px;
      background-color: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      font-family: inherit;
      font-size: inherit;
      resize: none;
      min-height: 60px;
      max-height: 200px;
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    #message-input:focus {
      border-width: 1px;
      border-color: var(--vscode-focusBorder);
      box-shadow: 0 0 0 3px rgba(0, 122, 204, 0.15); /* Fallback */
    }

    #message-input::placeholder {
      color: var(--vscode-input-placeholderForeground);
      font-style: italic;
    }

    #send-button {
      padding: 10px 20px;
      border-radius: 6px;
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      cursor: pointer;
      font-family: inherit;
      font-size: inherit;
      font-weight: 600;
      transition: all 0.2s ease;
      white-space: nowrap;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }

    #send-button:hover {
      background-color: var(--vscode-button-hoverBackground);
      transform: translateY(-1px);
      box-shadow: 0 4px 8px rgba(0,0,0,0.15);
    }

    #send-button:active {
      transform: translateY(0) scale(0.98);
    }

    #send-button:focus {
      outline: 2px solid var(--vscode-focusBorder);
      outline-offset: 2px;
    }

    #send-button:disabled, #send-button.loading {
      opacity: 0.6;
      cursor: not-allowed;
      transform: none;
      box-shadow: none;
    }

    .codicon {
      font-family: codicon;
      font-size: 16px;
    }


    .phase-plan-actions {
      display: flex;
      gap: 8px;
      margin-top: 20px;
      flex-wrap: wrap;
    }

    .phase-plan-action-button {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 14px;
      background-color: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: 1px solid var(--vscode-button-border);
      border-radius: 6px;
      cursor: pointer;
      font-family: inherit;
      font-size: 12px;
      font-weight: 500;
      transition: all 0.2s;
    }

    .phase-plan-action-button:hover {
      background-color: var(--vscode-button-secondaryHoverBackground);
      transform: translateY(-1px);
      box-shadow: 0 2px 5px rgba(0,0,0,0.1);
    }

    .phase-plan-action-button.secondary {
      background-color: transparent;
      border-color: var(--vscode-button-secondaryBorder);
    }

    .phase-plan-action-button.secondary:hover {
        background-color: var(--vscode-toolbar-hoverBackground);
    }
    
    .phase-plan-feedback {
      margin-top: 12px;
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      min-height: 20px;
      font-style: italic;
      padding-left: 4px;
      transition: color 0.3s;
    }

    .phase-plan-feedback.error {
      color: var(--vscode-errorForeground);
    }

    /* Phase List Styles (Traycer-style) */
    .phase-list {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }

    @keyframes expandPhase {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
    }

    .phase-item {
      background-color: var(--vscode-editor-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 8px;
      padding: 16px;
      transition: border-color 0.2s, transform 0.2s, box-shadow 0.2s;
      animation: expandPhase 0.4s ease-out backwards;
      position: relative;
    }
    
    .phase-item:nth-child(1) { animation-delay: 0.1s; }
    .phase-item:nth-child(2) { animation-delay: 0.2s; }
    .phase-item:nth-child(3) { animation-delay: 0.3s; }

    .phase-item:hover {
      border-color: var(--vscode-focusBorder);
      transform: translateX(4px);
      box-shadow: -4px 0 0 -1px var(--vscode-focusBorder), 0 4px 12px rgba(0,0,0,0.05);
    }

    .phase-item-header {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 12px;
      flex-wrap: wrap;
    }

    .phase-number {
      background-color: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      padding: 4px 10px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 700;
      transition: transform 0.2s;
    }
    
    .phase-item:hover .phase-number {
        transform: scale(1.1);
    }

    .phase-title {
      font-weight: 600;
      flex: 1;
      font-size: 14px;
    }

    .phase-complexity {
      font-size: 10px;
      padding: 3px 8px;
      border-radius: 10px;
      text-transform: uppercase;
      font-weight: 700;
      letter-spacing: 0.5px;
    }

    .complexity-low { background-color: var(--vscode-charts-green); color: #fff; }
    .complexity-medium { background-color: var(--vscode-charts-yellow); color: #333; }
    .complexity-high { background-color: var(--vscode-charts-red); color: #fff; }

    .phase-description {
      font-size: 13px;
      color: var(--vscode-descriptionForeground);
      margin-bottom: 16px;
      line-height: 1.6;
      padding-left: 4px;
      border-left: 2px solid var(--vscode-textBlockQuote-border);
    }
    
    .verification-completed-indicator {
        display: flex;
        align-items: center;
        gap: 8px;
        color: var(--vscode-charts-green);
        font-weight: 600;
        margin-top: 8px;
        animation: fadeIn 0.5s ease-in-out;
    }

    /* Task List Styles */
    .task-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
      margin-top: 14px;
      padding-top: 14px;
      border-top: 1px solid var(--vscode-panel-border);
    }

    .task-item {
      background-color: var(--vscode-input-background);
      border-radius: 6px;
      padding: 12px;
      transition: background-color 0.2s;
    }
    
    .task-item:hover {
        background-color: var(--vscode-list-hoverBackground);
    }

    .task-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .task-info {
      display: flex;
      align-items: center;
      gap: 10px;
    }

    .task-number {
      background-color: var(--vscode-editorLineNumber-foreground);
      color: var(--vscode-editor-background);
      width: 22px;
      height: 22px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 11px;
      font-weight: 700;
    }

    .task-title {
      font-weight: 600;
      font-size: 13px;
    }

    .task-goal {
      font-size: 12px;
      color: var(--vscode-descriptionForeground);
      line-height: 1.5;
      margin-left: 32px;
    }

    .task-actions {
      display: flex;
      gap: 8px;
    }
    
    /* Toggle Switch / Status Badge */
    .task-status-badge {
        font-size: 11px;
        padding: 2px 6px;
        border-radius: 4px;
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: 4px;
        transition: all 0.2s;
        border: 1px solid transparent;
    }
    
    .task-status-badge:hover {
        border-color: var(--vscode-focusBorder);
        background-color: var(--vscode-toolbar-hoverBackground);
    }

    /* Execute Dropdown */
    .execute-dropdown {
      position: relative;
    }

    .execute-btn {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 12px;
      border: none;
      border-radius: 4px;
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      font-size: 11px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s;
    }

    .execute-btn:hover {
      background-color: var(--vscode-button-hoverBackground);
      transform: translateY(-1px);
    }

    @keyframes slideDown {
        from { opacity: 0; transform: translateY(-10px) scaleY(0.9); }
        to { opacity: 1; transform: translateY(0) scaleY(1); }
    }

    .execute-menu {
      display: none;
      position: absolute;
      right: 0;
      top: 100%;
      min-width: 180px;
      background-color: var(--vscode-menu-background);
      border: 1px solid var(--vscode-menu-border);
      border-radius: 6px;
      box-shadow: 0 4px 16px rgba(0, 0, 0, 0.2);
      z-index: 100;
      margin-top: 6px;
      padding: 4px;
      transform-origin: top;
    }

    .execute-dropdown.open .execute-menu {
      display: block;
      animation: slideDown 0.15s cubic-bezier(0.2, 0.8, 0.2, 1);
    }

    .execute-option {
      display: flex;
      align-items: center;
      gap: 10px;
      width: 100%;
      padding: 8px 12px;
      border: none;
      border-radius: 3px;
      background: none;
      color: var(--vscode-menu-foreground);
      font-size: 12px;
      cursor: pointer;
      text-align: left;
      transition: background-color 0.1s;
    }

    .execute-option:hover {
      background-color: var(--vscode-menu-selectionBackground);
      color: var(--vscode-menu-selectionForeground);
    }

    .execute-option .codicon {
      font-size: 14px;
      opacity: 0.9;
    }
    
    .execute-menu-divider {
      height: 1px;
      background-color: var(--vscode-menu-separatorBackground);
      margin: 4px 0;
    }

    /* Global Handoff Container */
    .global-handoff-container {
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px dashed var(--vscode-panel-border);
    }

    /* Global Handoff Dropdown */
    .global-handoff-dropdown {
      position: relative;
      display: inline-block;
      width: 100%;
    }

    .global-handoff-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 10px 16px;
      width: 100%;
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 6px;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }

    .global-handoff-btn:hover {
      background-color: var(--vscode-button-hoverBackground);
      transform: translateY(-1px);
    }

    .global-handoff-btn .codicon:last-child {
      font-size: 14px;
      margin-left: auto;
    }

    .global-handoff-menu {
      display: none;
      position: absolute;
      left: 0;
      top: 100%;
      width: 100%;
      background-color: var(--vscode-menu-background);
      border: 1px solid var(--vscode-menu-border);
      border-radius: 6px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
      z-index: 100;
      margin-top: 6px;
      padding: 4px;
      transform-origin: top;
    }

    .global-handoff-dropdown.open .global-handoff-menu {
      display: block;
      animation: slideDown 0.15s cubic-bezier(0.2, 0.8, 0.2, 1);
    }

    .handoff-option {
      display: flex;
      align-items: center;
      gap: 12px;
      width: 100%;
      padding: 10px 14px;
      border: none;
      border-radius: 4px;
      background: none;
      color: var(--vscode-menu-foreground);
      font-size: 13px;
      cursor: pointer;
      text-align: left;
      transition: background-color 0.1s;
    }

    .handoff-option:hover {
      background-color: var(--vscode-menu-selectionBackground);
      color: var(--vscode-menu-selectionForeground);
    }

    .model-selector {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 16px;
      border-bottom: 1px solid var(--vscode-panel-border);
      background-color: var(--vscode-editor-background);
      font-size: 12px;
      flex-wrap: wrap;
    }

    .model-selector-label {
      color: var(--vscode-descriptionForeground);
      font-weight: 600;
      white-space: nowrap;
    }

    #model-select {
      flex: 1 1 auto;
      min-width: 120px;
      padding: 6px 10px;
      border-radius: 4px;
      background-color: var(--vscode-dropdown-background);
      color: var(--vscode-dropdown-foreground);
      border: 1px solid var(--vscode-dropdown-border);
      font-family: inherit;
      font-size: inherit;
      cursor: pointer;
      outline: none;
      transition: all 0.2s;
    }

    #model-select:focus {
      outline: 1px solid var(--vscode-focusBorder);
    }

    .model-status {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      background-color: var(--vscode-badges-background);
      padding: 2px 8px;
      border-radius: 10px;
    }

    .model-status.running {
      color: #fff;
      background-color: var(--vscode-charts-green);
    }
    
    @keyframes spin { 100% { transform: rotate(360deg); } }
    .spin { animation: spin 1s linear infinite; }

    /* Custom Dialog Styles */
    .confirm-modal-overlay, .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.6);
      backdrop-filter: blur(2px);
      z-index: 2000;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: fadeIn 0.2s ease-out;
    }
    
    .confirm-modal-content, .modal-content {
      background-color: var(--vscode-editor-background);
      border: 1px solid var(--vscode-widget-border);
      border-radius: 8px;
      padding: 24px;
      width: 90%;
      max-width: 400px;
      box-shadow: 0 8px 24px rgba(0, 0, 0, 0.4);
      animation: zoomIn 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    
    @keyframes zoomIn {
        from { transform: scale(0.9); opacity: 0; }
        to { transform: scale(1); opacity: 1; }
    }
    
    .modal-content h3 {
        margin-top: 0;
        margin-bottom: 16px;
        font-size: 16px;
        color: var(--vscode-foreground);
    }
    
    .modal-content p {
        margin-bottom: 24px;
        line-height: 1.5;
        color: var(--vscode-descriptionForeground);
    }
    
    .modal-input {
        width: 100%;
        padding: 10px;
        margin-bottom: 16px;
        background-color: var(--vscode-input-background);
        border: 1px solid var(--vscode-input-border);
        color: var(--vscode-input-foreground);
        border-radius: 4px;
        font-family: inherit;
        resize: vertical;
    }
    
    .modal-input:focus {
        outline: 1px solid var(--vscode-focusBorder);
    }
    
    .modal-actions {
        display: flex;
        justify-content: flex-end;
        gap: 12px;
    }
    
    .modal-btn {
        padding: 8px 16px;
        border-radius: 4px;
        border: none;
        cursor: pointer;
        font-weight: 600;
        transition: all 0.2s;
    }
    
    .modal-btn.secondary {
        background-color: transparent;
        border: 1px solid var(--vscode-button-secondaryBorder);
        color: var(--vscode-button-secondaryForeground);
    }
    
    .modal-btn.secondary:hover {
        background-color: var(--vscode-button-secondaryHoverBackground);
    }
    
    .modal-btn.primary {
        background-color: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
    }
    
    .modal-btn.primary:hover {
        background-color: var(--vscode-button-hoverBackground);
    }
    
    .confirm-btn-danger {
        background-color: var(--vscode-errorForeground);
        color: white;
    }
    
    .confirm-btn-danger:hover {
        background-color: #d1242f; /* Darker red */
    }

    /* History Modal Styles */
    .history-modal {
      display: none;
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background-color: rgba(0, 0, 0, 0.5);
      backdrop-filter: blur(2px);
      z-index: 1000;
      align-items: center;
      justify-content: center;
      animation: fadeIn 0.2s ease-out;
    }

    .history-modal-content {
      background-color: var(--vscode-editor-background);
      border: 1px solid var(--vscode-panel-border);
      border-radius: 12px;
      width: 90%;
      max-width: 600px;
      max-height: 85vh;
      display: flex;
      flex-direction: column;
      box-shadow: 0 16px 40px rgba(0, 0, 0, 0.4);
      animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }
    
    @keyframes slideUp {
        from { transform: translateY(20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
    }

    .history-modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 20px 24px;
      border-bottom: 1px solid var(--vscode-panel-border);
    }

    .history-modal-header h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
    }

    .history-close-btn {
      background: transparent;
      border: none;
      color: var(--vscode-foreground);
      cursor: pointer;
      padding: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 4px;
      transition: background-color 0.15s;
    }

    .history-close-btn:hover {
      background-color: var(--vscode-toolbar-hoverBackground);
    }

    /* Responsive Styles */
    @media (max-width: 350px) {
        .message {
            max-width: 95%;
            font-size: 13px;
        }
        
        .chat-header {
            padding: 6px 8px;
        }
        
        .header-btn {
            width: 28px;
            height: 28px;
        }
    }

    @media (max-width: 350px) {
      .provider-selector, .model-selector {
        flex-direction: column;
        align-items: stretch;
        gap: 8px;
      }

      .provider-selector-label, .model-selector-label {
        display: none;
      }

      .input-container {
        flex-direction: column;
        gap: 8px;
      }

      #send-button {
        width: 100%;
      }
      
      .phase-item {
          padding: 10px;
      }
      
      .task-item {
          padding: 8px;
      }
    }

    /* Ultra-Narrow Sidebar optimizations */
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
        padding: 8px;
      }

      #send-button {
        padding: 6px 10px;
        font-size: 12px;
      }
      
      .header-title {
          font-size: 13px;
      }
      
      .header-title .codicon {
          display: none;
      }
      
      .empty-state .codicon {
          font-size: 40px;
      }
      
      .feature-item {
          padding: 6px 8px;
          font-size: 11px;
      }
    }
    /* Conversation State Container */
    .conversation-state-container {
      padding: 10px 16px;
      border-bottom: 1px solid var(--vscode-panel-border);
      background-color: var(--vscode-editor-background);
      display: flex;
      flex-direction: column;
      gap: 10px;
    }

    .conversation-state-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 6px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      width: fit-content;
      transition: all 0.3s ease;
    }

    .conversation-state-idle { background-color: var(--vscode-badge-background); color: var(--vscode-badge-foreground); }
    .conversation-state-gathering_requirements { background-color: var(--vscode-charts-blue); color: #fff; }
    .conversation-state-analyzing_requirements { background-color: var(--vscode-charts-purple); color: #fff; }
    .conversation-state-generating_phases { background-color: var(--vscode-charts-orange); color: #fff; animation: pulse 1.5s infinite; }
    .conversation-state-complete { background-color: var(--vscode-charts-green); color: #fff; }
    .conversation-state-error { background-color: var(--vscode-errorForeground); color: #fff; }

    /* Phase Progress Bar */
    .phase-progress-bar {
      display: flex;
      flex-direction: column;
      gap: 6px;
    }

    .progress-bar-track {
      width: 100%;
      height: 8px;
      background-color: var(--vscode-progressBar-background);
      border-radius: 4px;
      overflow: hidden;
    }

    .progress-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--vscode-charts-blue), var(--vscode-charts-green));
      border-radius: 4px;
      transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .progress-bar-label {
      font-size: 11px;
      color: var(--vscode-descriptionForeground);
      text-align: center;
      font-weight: 600;
    }

    /* Workflow Actions Container */
    .workflow-actions-container {
      padding: 12px 16px;
      border-bottom: 1px solid var(--vscode-panel-border);
      background: linear-gradient(180deg, var(--vscode-editor-background) 0%, rgba(255,255,255,0.01) 100%);
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
      justify-content: center;
    }

    .workflow-action-btn {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 18px;
      border: none;
      border-radius: 6px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 2px 6px rgba(0,0,0,0.1);
    }

    .workflow-action-btn.primary {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
    }

    .workflow-action-btn.primary:hover {
      background-color: var(--vscode-button-hoverBackground);
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.2);
    }

    .workflow-action-btn.secondary {
      background-color: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: 1px solid var(--vscode-button-border);
    }

    .workflow-action-btn.secondary:hover {
      background-color: var(--vscode-button-secondaryHoverBackground);
      transform: translateY(-1px);
    }

    .workflow-action-btn .codicon {
      font-size: 16px;
    }

    /* Phase Progress Dashboard */
    .phase-dashboard {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 0 12px;
    }

    .dashboard-chart {
      width: 28px;
      height: 28px;
      flex-shrink: 0;
    }

    .dashboard-chart svg {
      width: 100%;
      height: 100%;
      transform: rotate(-90deg);
    }

    .dashboard-chart-bg {
      fill: none;
      stroke: var(--vscode-widget-border);
      stroke-width: 4;
    }

    .dashboard-chart-fill {
      fill: none;
      stroke: var(--vscode-charts-green);
      stroke-width: 4;
      transition: stroke-dasharray 0.5s ease;
    }

    .dashboard-stats {
      display: flex;
      flex-direction: column;
      justify-content: center;
      line-height: 1.2;
    }

    #dashboard-stats-verified {
      font-size: 11px;
      font-weight: 600;
      color: var(--vscode-foreground);
    }

    .dashboard-label {
      font-size: 9px;
      color: var(--vscode-descriptionForeground);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    /* History Header Actions */
    .history-header-actions {
        display: flex;
        gap: 8px;
    }
    
    .history-action-btn {
        background: none;
        border: none;
        color: var(--vscode-descriptionForeground);
        cursor: pointer;
        padding: 4px 8px;
        display: flex;
        align-items: center;
        gap: 6px;
        border-radius: 4px;
        transition: all 0.2s ease;
        font-size: 11px;
    }
    
    .history-action-btn:hover {
        background: var(--vscode-toolbar-hoverBackground);
        color: var(--vscode-foreground);
    }

    /* Next Action Suggestions */
    .next-action-suggestions {
        margin: 16px 12px;
        background: var(--vscode-editor-inactiveSelectionBackground);
        border-radius: 8px;
        padding: 12px;
        border-left: 3px solid var(--vscode-charts-purple);
        animation: fadeIn 0.4s ease;
    }

    .suggestions-title {
        display: flex;
        align-items: center;
        gap: 8px;
        font-weight: 600;
        font-size: 13px;
        margin-bottom: 8px;
        color: var(--vscode-foreground);
    }
    
    .suggestions-title .codicon {
        color: var(--vscode-charts-purple);
    }

    .suggestions-list {
        margin: 0;
        padding-left: 20px;
        color: var(--vscode-descriptionForeground);
        font-size: 12px;
        line-height: 1.5;
    }

    .suggestions-list li {
        margin-bottom: 4px;
    }

    .suggestions-list li:last-child {
        margin-bottom: 0;
    }
    /* Onboarding Wizard */
    #onboarding-wizard {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100%;
      width: 100%;
      padding: 20px;
      text-align: center;
      background-color: var(--vscode-editor-background);
      position: absolute;
      top: 0;
      left: 0;
      z-index: 10;
    }

    .onboarding-content {
      max-width: 400px;
      width: 100%;
    }

    #onboarding-wizard h2 {
      font-size: 20px;
      font-weight: 600;
      margin-bottom: 8px;
    }

    #onboarding-wizard p {
      color: var(--vscode-descriptionForeground);
      margin-bottom: 24px;
      font-size: 14px;
    }

    .onboarding-options {
      display: flex;
      flex-direction: column;
      gap: 16px;
      margin-bottom: 24px;
    }

    .onboarding-option {
      background-color: var(--vscode-editor-inactiveSelectionBackground);
      border: 1px solid var(--vscode-widget-border);
      border-radius: 8px;
      padding: 16px;
      text-align: left;
      transition: all 0.2s;
    }

    .onboarding-option:hover {
      border-color: var(--vscode-focusBorder);
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }

    .onboarding-option.recommended {
      border-color: var(--vscode-textLink-activeForeground);
      background-color: rgba(0, 122, 204, 0.05); /* Slight tint */
    }

    .onboarding-option h3 {
      font-size: 14px;
      font-weight: 600;
      margin: 0 0 4px 0;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .onboarding-option p {
      margin: 0 0 12px 0;
      font-size: 12px;
      opacity: 0.8;
    }

    .onboarding-btn {
      padding: 6px 14px;
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: background-color 0.2s;
      margin-right: 8px;
    }

    .onboarding-btn:hover {
      background-color: var(--vscode-button-hoverBackground);
    }

    .onboarding-btn.secondary {
      background-color: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }

    .onboarding-btn.secondary:hover {
      background-color: var(--vscode-button-secondaryHoverBackground);
    }

    .onboarding-refresh {
      background: none;
      border: none;
      color: var(--vscode-textLink-foreground);
      cursor: pointer;
      font-size: 13px;
      display: flex;
      align-items: center;
      gap: 6px;
      margin: 0 auto;
      padding: 8px;
      opacity: 0.8;
      transition: opacity 0.2s;
    }

    .onboarding-refresh:hover {
      opacity: 1;
      text-decoration: underline;
    }
  `;
}
