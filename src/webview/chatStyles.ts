/**
 * Returns CSS styles for the chat interface using VS Code CSS variables for theming
 */
export function getChatStyles(): string {
  return `
    :root {
      /* Fluid Spacing Scale */
      --spacing-3xs: clamp(0.125rem, 0.3vw, 0.25rem);
      --spacing-2xs: clamp(0.2rem, 0.5vw, 0.375rem);
      --spacing-xs: clamp(0.25rem, 0.5vw, 0.5rem);
      --spacing-sm: clamp(0.5rem, 1vw, 0.75rem);
      --spacing-md: clamp(0.75rem, 1.5vw, 1rem);
      --spacing-lg: clamp(1rem, 2vw, 1.5rem);
      --spacing-xl: clamp(1.5rem, 3.5vw, 2rem);
      
      --shadow-xs: 0 clamp(0.125rem,0.5vw,0.25rem) clamp(0.375rem,1vw,0.75rem) rgba(0,0,0,0.1);
      --shadow-sm: 0 clamp(0.25rem, 1vw, 0.5rem) clamp(0.5rem, 2vw, 1rem) rgba(0, 0, 0, 0.1);
      --shadow-lg: 0 clamp(0.5rem, 2vw, 1rem) clamp(1rem, 4vw, 2.5rem) rgba(0, 0, 0, 0.4);

      --radius-sm: clamp(0.1875rem, 0.6vw, 0.375rem);
      --radius-md: clamp(0.5rem,1vw,0.75rem);
      --radius-lg: clamp(0.75rem,1.5vw,1rem);

      /* Fluid Typography Scale */
      --font-xs: clamp(0.6875rem, 1.5vw, 0.75rem);
      --font-sm: clamp(0.75rem, 1.8vw, 0.8125rem);
      --font-base: clamp(0.8125rem, 2vw, 0.875rem);
      --font-md: clamp(0.875rem, 2.2vw, 0.9375rem);
      --font-lg: clamp(1rem, 2.5vw, 1.125rem);
      --font-xl: clamp(1.25rem, 3vw, 1.5rem);
    }

    /* Tested on: 720p (1280x720), 1080p (1920x1080), 4K (3840x2160) */
    * {
      box-sizing: border-box;
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
    }

    body {
      margin: 0;
      padding: 0;
      min-height: 100vh;
      overflow: hidden;
      font-family: var(--vscode-font-family);
      font-size: var(--font-base);
      color: var(--vscode-editor-foreground);
      background-color: var(--vscode-editor-background);
    }

    .chat-container {
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
      min-width: clamp(14.375rem, 15vw, 15.625rem);
      box-sizing: border-box;
      overflow-x: auto;
      container-type: inline-size;
    }

    /* Chat Header */
    /* Chat Header */
    .chat-header {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: var(--spacing-md);
      align-items: center;
      padding: var(--spacing-md) var(--spacing-lg);
      background-color: var(--vscode-titleBar-activeBackground);
      border-bottom: 0.0625rem solid var(--vscode-focusBorder);
      box-shadow: 0 1px var(--spacing-2xs) rgba(0, 0, 0, 0.1);
    }

    .header-title {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
      font-weight: 600;
      font-size: var(--font-md);
      letter-spacing: 0.5px;
      color: var(--vscode-titleBar-activeForeground);
    }

    .header-title .codicon {
      font-size: var(--font-md);
      color: var(--vscode-symbolIcon-classForeground);
    }

    .header-actions {
      display: flex;
      gap: var(--spacing-sm);
    }

    .header-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      min-width: calc(var(--spacing-md) * 2);
      width: auto;
      padding: var(--spacing-sm) var(--spacing-md);
      gap: var(--spacing-sm);
      min-height: calc(var(--spacing-md) * 2);
      border: none;
      border-radius: var(--radius-sm);
      background-color: var(--vscode-button-secondaryBackground);
      color: var(--vscode-foreground);
      font-weight: 600;
      cursor: pointer;
      position: relative;
      overflow: hidden;
      transition: transform 0.15s ease, box-shadow 0.15s ease, background-color 0.15s;
    }

    .header-btn span:not(.codicon) {
      font-size: var(--font-xs);
      text-transform: uppercase;
      letter-spacing: 0.5px;
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

    /* Ripple Effect */
    /* Ripple Effect - Shared across all button types */
    .header-btn::before,
    .onboarding-btn::before,
    .workflow-action-btn::before,
    .error-action-btn::before,
    .empty-state-config-btn::before,
    #send-button::before {
      content: '';
      position: absolute;
      top: 50%;
      left: 50%;
      width: 0;
      height: 0;
      border-radius: 50%;
      background: rgba(255,255,255,0.3);
      transform: translate(-50%, -50%);
      transition: width 0.6s, height 0.6s;
    }

    .header-btn:active::before,
    .onboarding-btn:active::before,
    .workflow-action-btn:active::before,
    .error-action-btn:active::before,
    .empty-state-config-btn:active::before,
    #send-button:active::before {
      width: 200%;
      height: 200%;
    }

    .header-btn .codicon {
      font-size: var(--font-lg);
    }
    
    .header-btn.primary {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      animation: subtlePulse 2s ease-in-out infinite;
    }

    @keyframes subtlePulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(0, 122, 204, 0.4); }
      50% { box-shadow: 0 0 0 var(--spacing-2xs) rgba(0, 122, 204, 0); }
    }
    
    #history-btn {
      position: relative;
    }

    #history-btn::after {
      content: attr(data-count);
      position: absolute;
      top: calc(var(--spacing-2xs) * -1);
      right: calc(var(--spacing-2xs) * -1);
      background: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      border-radius: var(--radius-md);
      padding: var(--spacing-3xs) var(--radius-sm);
      font-size: var(--font-xs);
      font-weight: 700;
      /* Only show if content is not empty handled by attribute logic, 
         CSS content: attr(x) will display empty string if attr is missing or empty,
         but visual padding remains. We can handle display logic in JS or complex CSS selector if supported :not([data-count=""]) */
      display: none;
    }

    #history-btn[data-count]:not([data-count=""])::after {
        display: block;
    }

    .header-btn.danger:hover {
      background-color: var(--vscode-errorForeground);
      color: var(--vscode-button-foreground);
    }

    .messages-container {
      flex: 1 1 auto;
      min-height: 1.25rem;
      overflow-y: auto;
      min-width: clamp(15rem, 20vw, 17.5rem);
      padding: var(--spacing-md) var(--spacing-lg);
      scroll-behavior: smooth;
      overscroll-behavior: contain;
      box-shadow: inset 0 var(--spacing-2xs) var(--spacing-2xs) calc(var(--spacing-2xs) * -1) rgba(0,0,0,0.1), inset 0 calc(var(--spacing-2xs) * -1) var(--spacing-2xs) calc(var(--spacing-2xs) * -1) rgba(0,0,0,0.1);
    }

    .messages-container::-webkit-scrollbar {
      width: clamp(0.5rem, 1.2vw, 0.75rem);
    }

    .messages-container::-webkit-scrollbar-track {
      background: var(--vscode-scrollbarSlider-background);
    }

    .messages-container::-webkit-scrollbar-thumb {
      background: var(--vscode-scrollbarSlider-hoverBackground);
      border-radius: var(--radius-sm);
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
      padding: var(--spacing-xl) var(--spacing-lg);
      background: linear-gradient(180deg, var(--vscode-editor-background) 0%, rgba(255,255,255,0.02) 100%);
    }

    .empty-state .codicon {
      font-size: clamp(3rem, 8vw, 4rem);
      margin-bottom: var(--spacing-xl);
      opacity: 0.8;
      animation: float 3s ease-in-out infinite;
      color: var(--vscode-textLink-foreground);
    }
    
    .empty-state h2 {
      font-size: var(--font-lg);
      font-weight: 600;
      margin: 0 0 var(--spacing-sm) 0;
      color: var(--vscode-foreground);
    }

    .empty-state p.subtitle {
      margin: 0 0 var(--spacing-xl) 0;
      font-size: var(--font-sm);
      max-width: clamp(17.5rem, 40vw, 22.5rem);
    }
    
    .empty-state-features {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-md);
      margin-bottom: var(--spacing-xl);
      text-align: left;
    }
    
    .feature-item {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
      font-size: var(--font-xs);
      padding: var(--spacing-sm) var(--spacing-md);
      background-color: var(--vscode-textBlockQuote-background);
      border-radius: var(--radius-sm);
      animation: fadeInUp 0.4s ease-out backwards;
    }
    
    .feature-item:nth-child(1) { animation-delay: 0.1s; }
    .feature-item:nth-child(2) { animation-delay: 0.2s; }
    .feature-item:nth-child(3) { animation-delay: 0.3s; }
    
    .feature-item .codicon {
      font-size: var(--font-base);
      margin-bottom: 0;
      animation: none;
      color: var(--vscode-textLink-activeForeground);
    }
    
    .empty-state-cta {
      font-size: var(--font-xs);
      color: var(--vscode-textLink-foreground);
      font-weight: 600;
      margin-top: var(--spacing-xl);
      opacity: 0.9;
    }

    .empty-state-config-btn {
      display: inline-flex;
      align-items: center;
      gap: var(--spacing-sm);
      padding: var(--spacing-md) var(--spacing-xl);
      margin: var(--spacing-xl) 0;
      background: linear-gradient(135deg, var(--vscode-button-background), var(--vscode-textLink-activeForeground));
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: var(--radius-sm);
      font-size: var(--font-sm);
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 12px rgba(0, 122, 204, 0.3);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
      overflow: hidden;
    }

    .empty-state-config-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 20px rgba(0, 122, 204, 0.4);
    }

    .empty-state-config-btn:active {
      transform: translateY(0) scale(0.98);
    }

    .empty-state-config-btn::after {
      content: '';
      position: absolute;
      top: 0;
      left: -100%;
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, transparent, rgba(255,255,255,0.2), transparent);
      transition: left 0.5s;
    }

    .empty-state-config-btn:hover::after {
      left: 100%;
    }

    @keyframes float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(calc(var(--spacing-sm) * -1)); }
    }
    
    @keyframes fadeInUp {
      from { opacity: 0; transform: translateY(var(--spacing-md)); }
      to { opacity: 1; transform: translateY(0); }
    }

    .message {
      margin-bottom: var(--spacing-lg);
      padding: var(--spacing-md) var(--spacing-lg);
      border-radius: var(--radius-md);
      max-width: clamp(70%, 85%, 90%);
      word-wrap: break-word;
      box-shadow: 0 1px var(--spacing-2xs) rgba(0, 0, 0, 0.1);
      position: relative;
      font-size: var(--font-base);
    }

    /* Message Animations */
    @keyframes slideInFromRight {
      from { opacity: 0; transform: translateX(var(--spacing-xl)) scale(0.95); }
      to { opacity: 1; transform: translateX(0) scale(1); }
    }

    @keyframes slideInFromLeft {
      from { opacity: 0; transform: translateX(calc(var(--spacing-xl) * -1)) scale(0.95); }
      to { opacity: 1; transform: translateX(0) scale(1); }
    }

    .message.user {
      margin-left: auto;
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border-bottom-right-radius: var(--spacing-2xs);
      opacity: 0.95;
      animation: slideInFromRight 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
    }

    .message.assistant {
      margin-right: auto;
      background-color: var(--vscode-editor-inactiveSelectionBackground); 
      border: 0.0625rem solid rgba(var(--vscode-focusBorder-rgb), 0.3); /* Fallback or constructed if rgb var not available, using opacity on border */
      border-bottom-left-radius: var(--spacing-2xs);
      border-left: 0.1875rem solid var(--vscode-focusBorder);
      animation: slideInFromLeft 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
    }

    .message.error {
      margin-right: auto;
      background-color: var(--vscode-inputValidation-errorBackground);
      border: 0.0625rem solid var(--vscode-inputValidation-errorBorder);
      border-left: 0.1875rem solid var(--vscode-errorForeground);
      border-radius: var(--radius-sm);
      padding: var(--spacing-md);
      width: 85%;
    }

    .error-header {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
      color: var(--vscode-errorForeground);
      margin-bottom: var(--spacing-sm);
      font-weight: 600;
      text-transform: capitalize;
    }

    .error-body {
      margin-bottom: var(--spacing-md);
      font-size: var(--font-sm);
    }

    .error-details {
      font-family: monospace;
      font-size: var(--font-xs);
      background-color: rgba(0,0,0,0.1);
      padding: var(--spacing-xs);
      border-radius: var(--radius-sm);
      margin-bottom: var(--spacing-md);
      white-space: pre-wrap;
      opacity: 0.8;
    }

    .error-actions {
      display: flex;
      gap: var(--spacing-sm);
      flex-wrap: wrap;
    }

    .error-action-btn {
      position: relative;
      overflow: hidden;
      padding: var(--spacing-xs) var(--spacing-md);
      border: 0.0625rem solid var(--vscode-button-border);
      background-color: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border-radius: var(--radius-sm);
      cursor: pointer;
      font-size: var(--font-xs);
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
      font-size: var(--font-xs);
      opacity: 0.7;
      margin-top: var(--spacing-xs);
      text-align: right;
    }

    .input-container {
      display: flex;
      flex-direction: row;
      padding: var(--spacing-lg);
      gap: var(--spacing-md);
      border-top: 0.0625rem solid var(--vscode-panel-border);
      background-color: var(--vscode-editor-background);
      box-shadow: 0 -2px 10px rgba(0,0,0,0.05);
    }

    .provider-selector {
      display: flex;
      align-items: center;
      gap: var(--spacing-md);
      padding: var(--spacing-sm) var(--spacing-lg);
      border-bottom: 0.0625rem solid var(--vscode-panel-border);
      background-color: var(--vscode-editor-background);
      font-size: var(--font-xs);
    }

    .provider-selector-label {
      color: var(--vscode-descriptionForeground);
      font-weight: 600;
      white-space: nowrap;
    }

    #provider-select {
      flex-grow: 1;
      padding: var(--spacing-xs) var(--spacing-md);
      border-radius: var(--radius-sm);
      background-color: var(--vscode-dropdown-background);
      color: var(--vscode-dropdown-foreground);
      border: 0.0625rem solid var(--vscode-dropdown-border);
      font-family: inherit;
      font-size: inherit;
      cursor: pointer;
      outline: none;
      transition: all 0.2s;
    }

    #provider-select:focus {
      outline: 0.0625rem solid var(--vscode-focusBorder);
      box-shadow: 0 0 0 var(--spacing-3xs) rgba(0, 122, 204, 0.2); /* Fallback */
    }

    .provider-status {
      display: inline-flex;
      align-items: center;
      gap: var(--spacing-xs);
      font-size: var(--font-xs);
      color: var(--vscode-descriptionForeground);
      font-weight: 500;
    }

    .provider-status .codicon {
      font-size: var(--font-sm);
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
      padding: var(--spacing-xs) var(--spacing-md);
      border-radius: var(--radius-sm);
      background-color: transparent;
      color: var(--vscode-button-secondaryForeground);
      border: 0.0625rem solid var(--vscode-button-secondaryBorder);
      cursor: pointer;
      font-size: var(--font-xs);
      display: inline-flex;
      align-items: center;
      gap: var(--spacing-xs);
      transition: all 0.2s ease;
    }

    .settings-button:hover {
      background-color: var(--vscode-button-secondaryHoverBackground);
      transform: translateY(-1px);
    }

    #message-input {
      flex-grow: 1;
      padding: var(--spacing-md);
      border-radius: var(--radius-sm);
      background-color: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 0.0625rem solid var(--vscode-input-border);
      font-family: inherit;
      font-size: inherit;
      resize: none;
      min-height: 3.75rem;
      max-height: 12.5rem;
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s;
    }

    #message-input:focus {
      border-width: 0.0625rem;
      border-color: var(--vscode-focusBorder);
      box-shadow: 0 0 0 var(--spacing-2xs) rgba(0, 122, 204, 0.15); /* Fallback */
    }

    #message-input::placeholder {
      color: var(--vscode-input-placeholderForeground);
      font-style: italic;
    }

    #send-button {
      position: relative;
      overflow: hidden;
      padding: var(--spacing-sm) var(--spacing-xl);
      border-radius: var(--radius-sm);
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      cursor: pointer;
      font-family: inherit;
      font-size: inherit;
      font-weight: 600;
      transition: all 0.2s ease;
      white-space: nowrap;
      box-shadow: 0 var(--spacing-3xs) var(--spacing-2xs) rgba(0,0,0,0.1);
    }

    #send-button:hover {
      background-color: var(--vscode-button-hoverBackground);
      transform: translateY(-1px);
      box-shadow: 0 var(--spacing-2xs) var(--spacing-sm) rgba(0,0,0,0.15);
    }

    #send-button:active {
      transform: translateY(0) scale(0.98);
    }

    #send-button:focus {
      outline: var(--spacing-3xs) solid var(--vscode-focusBorder);
      outline-offset: var(--spacing-3xs);
    }

    #send-button:disabled, 
    #send-button.loading,
    .workflow-action-btn.loading,
    .error-action-btn.loading,
    .empty-state-config-btn.loading,
    .onboarding-btn.loading {
      opacity: 0.7;
      cursor: wait;
      pointer-events: none;
      transform: none;
      box-shadow: none;
    }
    
    @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
    }
    
    .codicon-modifier-spin {
        animation: spin 1s linear infinite;
        display: inline-block;
    }

    .codicon {
      font-family: codicon;
      font-size: var(--font-base);
    }


    .phase-plan-actions {
      display: flex;
      gap: var(--spacing-sm);
      margin-top: var(--spacing-xl);
      flex-wrap: wrap;
    }

    .phase-plan-action-button {
      display: flex;
      align-items: center;
      gap: var(--spacing-xs);
      padding: var(--spacing-sm) var(--spacing-md);
      background-color: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: 0.0625rem solid var(--vscode-button-border);
      border-radius: var(--radius-sm);
      cursor: pointer;
      font-family: inherit;
      font-size: var(--font-xs);
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
      margin-top: var(--spacing-md);
      font-size: var(--font-xs);
      color: var(--vscode-descriptionForeground);
      min-height: 1.25rem;
      font-style: italic;
      padding-left: var(--spacing-2xs);
      transition: color 0.3s;
    }

    .phase-plan-feedback.error {
      color: var(--vscode-errorForeground);
    }

    /* Phase List Styles (Traycer-style) */
    .phase-list {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-md);
    }

    @keyframes expandPhase {
        from { opacity: 0; transform: translateY(var(--spacing-md)); }
        to { opacity: 1; transform: translateY(0); }
    }

    .phase-item {
      background-color: var(--vscode-editor-background);
      border: 0.0625rem solid var(--vscode-panel-border);
      border-radius: var(--radius-md);
      padding: var(--spacing-md);
      transition: border-color 0.2s, transform 0.2s, box-shadow 0.2s;
      animation: expandPhase 0.4s ease-out backwards;
      position: relative;
    }
    
    .phase-item:nth-child(1) { animation-delay: 0.1s; }
    .phase-item:nth-child(2) { animation-delay: 0.2s; }
    .phase-item:nth-child(3) { animation-delay: 0.3s; }

    .phase-item:hover {
      border-color: var(--vscode-focusBorder);
      transform: translateX(var(--spacing-2xs));
      box-shadow: calc(var(--spacing-2xs) * -1) 0 0 calc(0.0625rem * -1) var(--vscode-focusBorder), 0 var(--spacing-2xs) var(--spacing-md) rgba(0,0,0,0.05);
    }

    .phase-item-header {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
      margin-bottom: var(--spacing-md);
      flex-wrap: wrap;
    }

    .phase-number {
      background-color: var(--vscode-badge-background);
      color: var(--vscode-badge-foreground);
      padding: var(--spacing-2xs) var(--spacing-sm);
      border-radius: var(--radius-md);
      font-size: var(--font-xs);
      font-weight: 700;
      transition: transform 0.2s;
    }
    
    .phase-item:hover .phase-number {
        transform: scale(1.1);
    }

    .phase-title {
      font-weight: 600;
      flex: 1;
      font-size: var(--font-md);
    }

    .phase-complexity {
      font-size: var(--font-xs);
      padding: var(--spacing-3xs) var(--spacing-sm);
      border-radius: var(--radius-md);
      text-transform: uppercase;
      font-weight: 700;
      letter-spacing: 0.5px;
    }

    .complexity-low { background-color: var(--vscode-charts-green); color: #fff; }
    .complexity-medium { background-color: var(--vscode-charts-yellow); color: #333; }
    .complexity-high { background-color: var(--vscode-charts-red); color: #fff; }

    .phase-description {
      font-size: var(--font-sm);
      color: var(--vscode-descriptionForeground);
      margin-bottom: var(--spacing-lg);
      line-height: 1.6;
      padding-left: var(--spacing-2xs);
      border-left: 2px solid var(--vscode-textBlockQuote-border);
    }
    
    .verification-completed-indicator {
        display: flex;
        align-items: center;
        gap: var(--spacing-sm);
        color: var(--vscode-charts-green);
        font-weight: 600;
        margin-top: var(--spacing-sm);
        animation: fadeIn 0.5s ease-in-out;
    }

    /* Task List Styles */
    .task-list {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-md);
      margin-top: var(--spacing-md);
      padding-top: var(--spacing-md);
      border-top: 0.0625rem solid var(--vscode-panel-border);
    }

    .task-item {
      background-color: var(--vscode-input-background);
      border-radius: var(--radius-sm);
      padding: var(--spacing-sm) var(--spacing-md);
      transition: background-color 0.2s;
    }
    
    .task-item:hover {
        background-color: var(--vscode-list-hoverBackground);
    }

    .task-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: var(--spacing-sm);
    }

    .task-info {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
    }

    .task-number {
      background-color: var(--vscode-editorLineNumber-foreground);
      color: var(--vscode-editor-background);
      width: clamp(1.25rem, 1.5vw, 1.375rem);
      height: clamp(1.25rem, 1.5vw, 1.375rem);
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: var(--font-xs);
      font-weight: 700;
    }

    .task-title {
      font-weight: 600;
      font-size: var(--font-sm);
    }

    .task-goal {
      font-size: var(--font-xs);
      color: var(--vscode-descriptionForeground);
      line-height: 1.5;
      margin-left: var(--spacing-xl);
    }

    .task-actions {
      display: flex;
      gap: var(--spacing-sm);
    }
    
    /* Toggle Switch / Status Badge */
    .task-status-badge {
        font-size: var(--font-xs);
        padding: var(--spacing-3xs) var(--spacing-2xs);
        border-radius: var(--radius-sm);
        cursor: pointer;
        display: flex;
        align-items: center;
        gap: var(--spacing-2xs);
        transition: all 0.2s;
        border: 0.0625rem solid transparent;
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
      gap: var(--spacing-xs);
      padding: var(--spacing-2xs) var(--spacing-sm);
      border: none;
      border-radius: var(--radius-sm);
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      font-size: var(--font-xs);
      font-weight: 600;
      cursor: pointer;
      transition: all 0.15s;
    }

    .execute-btn:hover {
      background-color: var(--vscode-button-hoverBackground);
      transform: translateY(-1px);
    }

    @keyframes slideDown {
        from { opacity: 0; transform: translateY(calc(var(--spacing-md) * -1)) scaleY(0.9); }
        to { opacity: 1; transform: translateY(0) scaleY(1); }
    }

    .execute-menu {
      display: none;
      position: absolute;
      right: 0;
      top: 100%;
      min-width: clamp(11.25rem, 15vw, 12.5rem);
      background-color: var(--vscode-menu-background);
      border: 0.0625rem solid var(--vscode-menu-border);
      border-radius: var(--radius-sm);
      box-shadow: var(--shadow-lg);
      z-index: 100;
      margin-top: var(--spacing-xs);
      padding: var(--spacing-2xs);
      transform-origin: top;
      display: none; /* Default hidden */
      /* CSS Grid for button layout when open */
    }

    .execute-dropdown.open .execute-menu {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(7.5rem, 1fr));
      gap: var(--spacing-xs);
      animation: slideDown 0.15s cubic-bezier(0.2, 0.8, 0.2, 1);
    }

    .execute-dropdown.open .execute-menu {
      display: block;
      animation: slideDown 0.15s cubic-bezier(0.2, 0.8, 0.2, 1);
    }

    .execute-option {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
      width: 100%;
      padding: var(--spacing-sm) var(--spacing-sm);
      border: none;
      border-radius: var(--radius-sm);
      background: none;
      color: var(--vscode-menu-foreground);
      font-size: var(--font-xs);
      cursor: pointer;
      text-align: left;
      transition: background-color 0.1s;
    }

    .execute-option:hover {
      background-color: var(--vscode-menu-selectionBackground);
      color: var(--vscode-menu-selectionForeground);
    }

    .execute-option .codicon {
      font-size: var(--font-sm);
      opacity: 0.9;
    }
    
    .execute-menu-divider {
      height: 1px;
      background-color: var(--vscode-menu-separatorBackground);
      margin: var(--spacing-2xs) 0;
    }

    /* Global Handoff Container */
    .global-handoff-container {
      margin-top: var(--spacing-xl);
      padding-top: var(--spacing-lg);
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
      gap: var(--spacing-sm);
      padding: clamp(0.625rem, 1vw, 0.75rem) var(--spacing-lg);
      width: 100%;
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: var(--radius-sm);
      font-size: var(--font-sm);
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s;
    }

    .global-handoff-btn:hover {
      background-color: var(--vscode-button-hoverBackground);
      transform: translateY(-1px);
    }

    .global-handoff-btn .codicon:last-child {
      font-size: var(--font-sm);
      margin-left: auto;
    }

    .global-handoff-menu {
      display: none;
      position: absolute;
      left: 0;
      top: 100%;
      width: 100%;
      background-color: var(--vscode-menu-background);
      border: 0.0625rem solid var(--vscode-menu-border);
      border-radius: var(--radius-sm);
      box-shadow: var(--shadow-sm);
      z-index: 100;
      margin-top: var(--spacing-xs);
      padding: var(--spacing-2xs);
      transform-origin: top;
    }

    .global-handoff-dropdown.open .global-handoff-menu {
      display: block;
      animation: slideDown 0.15s cubic-bezier(0.2, 0.8, 0.2, 1);
    }

    .handoff-option {
      display: flex;
      align-items: center;
      gap: var(--spacing-md);
      width: 100%;
      padding: clamp(0.625rem, 1vw, 0.75rem) clamp(0.875rem, 1.2vw, 1rem);
      border: none;
      border-radius: var(--radius-sm);
      background: none;
      color: var(--vscode-menu-foreground);
      font-size: var(--font-xs);
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
      gap: var(--spacing-md);
      padding: var(--spacing-sm) var(--spacing-lg);
      border-bottom: 0.0625rem solid var(--vscode-panel-border);
      background-color: var(--vscode-editor-background);
      font-size: var(--font-sm);
      flex-wrap: wrap;
    }

    .model-selector-label {
      color: var(--vscode-descriptionForeground);
      font-weight: 600;
      white-space: nowrap;
    }

    #model-select {
      flex: 1 1 auto;
      min-width: clamp(7.5rem, 15vw, 9.375rem);
      padding: var(--spacing-2xs) var(--spacing-sm);
      border-radius: var(--radius-sm);
      background-color: var(--vscode-dropdown-background);
      color: var(--vscode-dropdown-foreground);
      border: 0.0625rem solid var(--vscode-dropdown-border);
      font-family: inherit;
      font-size: inherit;
      cursor: pointer;
      outline: none;
      transition: all 0.2s;
    }

    #model-select:focus {
      outline: 0.0625rem solid var(--vscode-focusBorder);
    }

    .model-status {
      display: inline-flex;
      align-items: center;
      gap: var(--spacing-xs);
      font-size: var(--font-xs);
      color: var(--vscode-descriptionForeground);
      background-color: var(--vscode-badges-background);
      padding: var(--spacing-3xs) var(--spacing-sm);
      border-radius: clamp(0.625rem, 1vw, 0.75rem);
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
      backdrop-filter: blur(var(--spacing-3xs));
      z-index: 2000;
      display: flex;
      align-items: center;
      justify-content: center;
      animation: fadeIn 0.2s ease-out;
    }
    
    .confirm-modal-content, .modal-content {
      background-color: var(--vscode-editor-background);
      border: 0.0625rem solid var(--vscode-widget-border);
      border-radius: var(--radius-md);
      padding: var(--spacing-xl);
      width: clamp(17.5rem, 90vw, 31.25rem);
      max-height: 85vh;
      box-shadow: var(--shadow-lg);
      animation: zoomIn 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
    }
    
    @keyframes zoomIn {
        from { transform: scale(0.9); opacity: 0; }
        to { transform: scale(1); opacity: 1; }
    }
    
    .modal-content h3 {
        margin-top: 0;
        margin-bottom: var(--spacing-lg);
        font-size: var(--font-lg);
        color: var(--vscode-foreground);
    }
    
    .modal-content p {
        margin-bottom: var(--spacing-xl);
        line-height: 1.5;
        color: var(--vscode-descriptionForeground);
    }
    
    .modal-input {
        width: 100%;
        padding: var(--spacing-sm);
        margin-bottom: var(--spacing-lg);
        background-color: var(--vscode-input-background);
        border: 0.0625rem solid var(--vscode-input-border);
        color: var(--vscode-input-foreground);
        border-radius: var(--radius-sm);
        font-family: inherit;
        resize: vertical;
    }
    
    .modal-input:focus {
        outline: 0.0625rem solid var(--vscode-focusBorder);
    }
    
    .modal-actions {
        display: flex;
        justify-content: flex-end;
        gap: var(--spacing-md);
    }
    
    .modal-btn {
        padding: var(--spacing-sm) var(--spacing-lg);
        border-radius: var(--radius-sm);
        border: none;
        cursor: pointer;
        font-weight: 600;
        transition: all 0.2s;
    }
    
    .modal-btn.secondary {
        background-color: transparent;
        border: 0.0625rem solid var(--vscode-button-secondaryBorder);
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
      backdrop-filter: blur(var(--spacing-3xs));
      z-index: 1000;
      align-items: center;
      justify-content: center;
      animation: fadeIn 0.2s ease-out;
    }

    .history-modal-content {
      background-color: var(--vscode-editor-background);
      border: 0.0625rem solid var(--vscode-panel-border);
      border-radius: var(--radius-md);
      width: clamp(18rem, 90vw, 37.5rem);
      max-height: 85vh;
      display: flex;
      flex-direction: column;
      box-shadow: var(--shadow-lg);
      animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1);
    }
    
    @keyframes slideUp {
        from { transform: translateY(var(--spacing-xl)); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
    }

    @keyframes shimmer {
      0% { background-position: -200% center; }
      100% { background-position: 200% center; }
    }

    .history-modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: var(--spacing-xl) clamp(1.5rem, 3.5vw, 1.5rem);
      border-bottom: 0.0625rem solid var(--vscode-panel-border);
    }

    .history-modal-header h3 {
      margin: 0;
      font-size: var(--font-lg);
      font-weight: 600;
    }

    .history-close-btn {
      background: transparent;
      border: none;
      color: var(--vscode-foreground);
      cursor: pointer;
      padding: var(--spacing-xs);
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: var(--radius-sm);
      transition: background-color 0.15s;
    }

    .history-close-btn:hover {
      background-color: var(--vscode-toolbar-hoverBackground);
    }

    /* Responsive Styles */
    /* Responsive Styles */
    /* Container Queries for Sidebar Responsiveness */
    /* Container queries for sidebar: 250px-1200px+ */

    @container (max-width: 21.875rem) {
      /* Ultra-compact sidebar mode */
      .header-btn span:not(.codicon) { display: none; }
      .provider-selector-label, .model-selector-label { display: none; }
      .chat-header { padding: var(--spacing-sm); grid-template-columns: 1fr; }
      .header-actions { width: 100%; gap: var(--spacing-3xs); justify-content: space-between; margin-top: var(--spacing-2xs); }
      .header-btn { padding: var(--spacing-2xs); }
      .phase-dashboard { display: none !important; }
      
      .messages-container { padding: var(--spacing-sm); }
      .message { padding: var(--spacing-sm); font-size: var(--font-xs); }
      
      .input-container { padding: var(--spacing-sm); flex-direction: column; }
      #send-button { width: 100%; }
      
      .provider-selector, .model-selector { flex-direction: column; align-items: stretch; gap: var(--spacing-sm); }
      .settings-button span:not(.codicon) { display: none; }
      
      .onboarding-options { grid-template-columns: 1fr; }
      .onboarding-btn { width: 100%; margin-bottom: var(--spacing-sm); justify-content: center; }
    }

    @container (min-width: 21.9375rem) and (max-width: 31.25rem) {
      /* Compact sidebar mode */
      .header-btn span:not(.codicon) { display: none; }
      .header-actions { gap: var(--spacing-2xs); }
      .onboarding-options { grid-template-columns: 1fr; }
    }

    @container (min-width: 31.3125rem) and (max-width: 50rem) {
      /* Standard sidebar mode */
      .onboarding-options { grid-template-columns: repeat(auto-fit, minmax(12.5rem, 1fr)); }
    }

    @container (min-width: 50.0625rem) {
      /* Wide sidebar mode */
      .onboarding-options { grid-template-columns: repeat(3, 1fr); }
    }

    /* DPI-Aware Scaling */
    /* DPI-aware scaling for crisp 4K and spacious 720p */
    @media (min-resolution: 2dppx) {
      .codicon, .header-btn .codicon, .onboarding-option .codicon { font-size: calc(var(--font-base) * 1.3); }
      .message { border-width: 0.0625rem; }
      .phase-item { border-width: 0.0625rem; }
      .header-btn { border-width: 0.0625rem; }
    }

    @media (max-resolution: 1dppx) and (max-width: 85.375rem) {
      /* Fluid tightening for lower resolution, no fixed pixels */
      .message { padding: var(--spacing-md); } 
    }
    /* Conversation State Container */
    .conversation-state-container {
      padding: clamp(0.625rem, 1.5vw, 0.6875rem) var(--spacing-lg);
      border-bottom: 0.0625rem solid var(--vscode-panel-border);
      background-color: var(--vscode-editor-background);
      display: flex;
      flex-direction: column;
      gap: var(--spacing-sm);
    }

    .conversation-state-badge {
      display: inline-flex;
      align-items: center;
      gap: var(--spacing-sm);
      padding: var(--spacing-xs) var(--spacing-md);
      border-radius: var(--radius-md);
      font-size: var(--font-sm);
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
      gap: var(--spacing-xs);
    }

    .progress-bar-track {
      width: 100%;
      height: clamp(0.5rem, 1vw, 0.75rem);
      background-color: var(--vscode-progressBar-background);
      border-radius: var(--radius-sm);
      overflow: hidden;
    }

    .progress-bar-fill {
      height: 100%;
      background: linear-gradient(90deg, var(--vscode-charts-blue), var(--vscode-charts-green));
      border-radius: var(--radius-sm);
      transition: width 0.5s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .progress-bar-label {
      font-size: var(--font-xs);
      color: var(--vscode-descriptionForeground);
      text-align: center;
      font-weight: 600;
    }

    /* Workflow Actions Container */
    .workflow-actions-container {
      padding: var(--spacing-md) var(--spacing-lg);
      border-bottom: 0.0625rem solid var(--vscode-panel-border);
      background: linear-gradient(180deg, var(--vscode-editor-background) 0%, rgba(255,255,255,0.01) 100%);
      display: flex;
      gap: var(--spacing-sm);
      flex-wrap: wrap;
      justify-content: center;
    }

    .workflow-action-btn {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
      padding: var(--spacing-sm) clamp(1.125rem, 2.5vw, 1.125rem);
      border: none;
      border-radius: var(--radius-sm);
      font-size: var(--font-sm);
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
      box-shadow: 0 var(--spacing-3xs) var(--spacing-xs) rgba(0,0,0,0.1);
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
      border: 0.0625rem solid var(--vscode-button-border);
    }

    .workflow-action-btn.secondary:hover {
      background-color: var(--vscode-button-secondaryHoverBackground);
      transform: translateY(-1px);
    }

    .workflow-action-btn {
      position: relative;
      overflow: hidden;
    }

    .workflow-action-btn .codicon {
      font-size: var(--font-base);
    }

    /* Phase Progress Dashboard */
    .phase-dashboard {
      display: flex;
      align-items: center;
      gap: var(--spacing-md);
      padding: 0 var(--spacing-md);
    }

    .dashboard-chart {
      width: clamp(1.75rem, 4vw, 1.875rem);
      height: clamp(1.75rem, 4vw, 1.875rem);
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
      font-size: var(--font-xs);
      font-weight: 600;
      color: var(--vscode-foreground);
    }

    .dashboard-label {
      font-size: calc(var(--font-xs) * 0.75);
      color: var(--vscode-descriptionForeground);
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }

    /* History Header Actions */
    .history-header-actions {
        display: flex;
        gap: var(--spacing-sm);
    }
    
    .history-action-btn {
        background: none;
        border: none;
        color: var(--vscode-descriptionForeground);
        cursor: pointer;
        padding: var(--spacing-2xs) var(--spacing-sm);
        display: flex;
        align-items: center;
        gap: var(--spacing-xs);
        border-radius: var(--radius-sm);
        transition: all 0.2s ease;
        font-size: var(--font-xs);
    }
    
    .history-action-btn:hover {
        background: var(--vscode-toolbar-hoverBackground);
        color: var(--vscode-foreground);
    }

    /* Next Action Suggestions */
    .next-action-suggestions {
        margin: var(--spacing-lg) var(--spacing-md);
        background: var(--vscode-editor-inactiveSelectionBackground);
        border-radius: var(--radius-md);
        padding: var(--spacing-md);
        border-left: 0.1875rem solid var(--vscode-charts-purple);
        animation: fadeIn 0.4s ease;
    }

    .suggestions-title {
        display: flex;
        align-items: center;
        gap: var(--spacing-sm);
        font-weight: 600;
        font-size: var(--font-sm);
        margin-bottom: var(--spacing-sm);
        color: var(--vscode-foreground);
    }
    
    .suggestions-title .codicon {
        color: var(--vscode-charts-purple);
    }

    .suggestions-list {
        margin: 0;
        padding-left: var(--spacing-xl);
        color: var(--vscode-descriptionForeground);
        font-size: var(--font-xs);
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
      padding: clamp(1rem, 3vw, 2rem);
      text-align: center;
      background-color: var(--vscode-editor-background);
      position: relative;
      /* removed absolute positioning to keep input visible */
      z-index: 10;
      animation: fadeIn 0.4s ease-out;
    }

    .onboarding-content {
      max-width: clamp(25rem, 50vw, 30rem);
      width: 100%;
      animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1);
    }

    #onboarding-wizard h2 {
      font-size: var(--font-xl);
      font-weight: 600;
      margin-bottom: var(--spacing-sm);
      background: linear-gradient(135deg, var(--vscode-textLink-activeForeground), var(--vscode-charts-purple));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }

    #onboarding-wizard p {
      color: var(--vscode-descriptionForeground);
      margin-bottom: clamp(1.75rem, 2vw, 2rem);
      font-size: var(--font-md);
    }

    .onboarding-options {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(min(100%, 17.5rem), 1fr));
      gap: var(--spacing-lg);
      margin-bottom: var(--spacing-xl);
      width: 100%;
    }

    .onboarding-option {
      background-color: var(--vscode-editor-inactiveSelectionBackground);
      border: 0.0625rem solid var(--vscode-widget-border);
      border-radius: var(--radius-md);
      padding: var(--spacing-lg);
      text-align: left;
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      min-height: clamp(10rem, 20vh, 12.5rem);
      position: relative;
      overflow: hidden;
      flex: 1 1 auto;
      min-width: 0;
    }

    .onboarding-option:nth-child(1) {
      animation: fadeInUp 0.5s ease-out 0.1s backwards;
    }
    
    .onboarding-option:nth-child(2) {
      animation: fadeInUp 0.5s ease-out 0.2s backwards;
    }
    
    .onboarding-option:nth-child(3) {
      animation: fadeInUp 0.5s ease-out 0.3s backwards;
    }

    .onboarding-option.recommended {
      border-color: rgba(0, 122, 204, 0.4);
      background: linear-gradient(135deg, rgba(0, 122, 204, 0.12) 0%, rgba(88, 86, 214, 0.12) 100%);
      box-shadow: 0 var(--spacing-2xs) var(--spacing-sm) rgba(0, 122, 204, 0.15);
    }

    .onboarding-option.recommended::before {
      content: '';
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      height: var(--spacing-3xs);
      background: linear-gradient(90deg, transparent, rgba(0, 122, 204, 0.6), transparent);
      background-size: 200% 100%;
      animation: shimmer 3s infinite;
    }

    .onboarding-option:nth-child(2) {
      border-color: rgba(255, 140, 0, 0.3);
      background: linear-gradient(135deg, rgba(255, 140, 0, 0.1) 0%, rgba(255, 69, 140, 0.1) 100%);
      box-shadow: 0 var(--spacing-2xs) var(--spacing-sm) rgba(255, 140, 0, 0.12);
    }

    .onboarding-option:nth-child(3) {
      border-color: rgba(128, 128, 128, 0.3);
      background: linear-gradient(135deg, rgba(128, 128, 128, 0.08) 0%, rgba(160, 160, 160, 0.08) 100%);
    }

    .onboarding-option:hover {
      border-color: var(--vscode-focusBorder);
      transform: translateY(calc(var(--spacing-2xs) * -1)) scale(1.02);
      box-shadow: 0 var(--spacing-sm) var(--spacing-xl) rgba(0, 0, 0, 0.2);
    }

    .onboarding-option.recommended:hover {
      box-shadow: 0 var(--spacing-sm) var(--spacing-xl) rgba(0, 122, 204, 0.3);
    }

    .onboarding-option:nth-child(2):hover {
      box-shadow: 0 var(--spacing-sm) var(--spacing-xl) rgba(255, 140, 0, 0.25);
    }

    .onboarding-option h3 {
      font-size: var(--font-md);
      font-weight: 600;
      margin: 0 0 var(--spacing-3xs) 0;
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
      color: var(--vscode-foreground);
    }

    .onboarding-option > .codicon {
      font-size: clamp(2rem, 5vw, 2.5rem);
      margin-bottom: var(--spacing-md);
      opacity: 0.9;
    }

    .onboarding-option p {
      margin: 0 0 var(--spacing-sm) 0;
      font-size: var(--font-sm);
      opacity: 0.85;
    }
    
    .onboarding-steps {
      margin: var(--spacing-sm) 0;
      padding: var(--spacing-md);
      background: var(--vscode-textBlockQuote-background);
      border-radius: var(--radius-sm);
      border-left: 0.1875rem solid var(--vscode-textLink-activeForeground);
    }
    
    .onboarding-steps ol {
      margin: 0;
      padding-left: var(--spacing-xl);
      font-size: var(--font-xs);
      line-height: 1.6;
      color: var(--vscode-descriptionForeground);
    }
    
    .onboarding-steps li {
      margin-bottom: var(--spacing-2xs);
    }
    
    .onboarding-steps code {
      background: var(--vscode-textCodeBlock-background);
      padding: var(--spacing-3xs) var(--spacing-2xs);
      border-radius: var(--radius-sm);
      font-family: var(--vscode-editor-font-family);
      font-size: var(--font-xs);
    }

    .onboarding-btn {
      position: relative;
      overflow: hidden;
      padding: var(--spacing-md) var(--spacing-lg);
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: var(--radius-sm);
      cursor: pointer;
      font-size: var(--font-sm);
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: var(--spacing-xs);
      transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
      margin-right: var(--spacing-sm);
      min-width: 8.75rem;
    }

    .onboarding-btn .codicon {
      font-size: var(--font-base);
      margin-right: var(--spacing-2xs);
    }

    .onboarding-btn:hover {
      background-color: var(--vscode-button-hoverBackground);
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0, 122, 204, 0.3);
    }

    .onboarding-btn:active {
      transform: translateY(0) scale(0.98);
      box-shadow: 0 2px 6px rgba(0, 122, 204, 0.2);
    }

    .onboarding-btn.secondary {
      background-color: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
    }

    .onboarding-btn.secondary:hover {
      background-color: var(--vscode-button-secondaryHoverBackground);
    }
    
    .onboarding-btn.secondary:active {
      transform: translateY(0) scale(0.98);
    }
    
    .onboarding-btn.loading {
      opacity: 0.7;
      cursor: wait;
      pointer-events: none;
    }
    
    .onboarding-btn.loading::after {
      content: '';
      display: inline-block;
      width: var(--font-sm);
      height: var(--font-sm);
      margin-left: var(--spacing-sm);
      border: var(--spacing-3xs) solid currentColor;
      border-right-color: transparent;
      border-radius: 50%;
      animation: spin 0.6s linear infinite;
    }

    .onboarding-refresh {
      background: none;
      border: none;
      color: var(--vscode-textLink-foreground);
      cursor: pointer;
      font-size: var(--font-sm);
      display: flex;
      align-items: center;
      gap: var(--spacing-xs);
      margin: 0 auto;
      padding: var(--spacing-sm) var(--spacing-md);
      opacity: 0.8;
      transition: all 0.2s ease;
      border-radius: var(--radius-sm);
    }

    .onboarding-refresh:hover {
      opacity: 1;
      background: var(--vscode-button-secondaryBackground);
      transform: translateY(-1px);
      text-decoration: none;
    }

    .onboarding-skip-btn {
      margin-top: var(--spacing-xl);
      padding: clamp(0.875rem, 1vw, 1rem) var(--spacing-xl);
      background-color: var(--vscode-button-secondaryBackground);
      color: var(--vscode-button-secondaryForeground);
      border: 0.0625rem solid var(--vscode-button-border);
      border-radius: var(--radius-sm);
      font-size: var(--font-sm);
      font-weight: 600;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: var(--spacing-sm);
      transition: all 0.2s ease;
      width: 100%;
      justify-content: center;
      max-width: 20rem;
      margin-left: auto;
      margin-right: auto;
    }

    .onboarding-skip-btn:hover {
      background-color: var(--vscode-button-secondaryHoverBackground);
      transform: translateY(-2px);
      box-shadow: 0 4px 12px rgba(0,0,0,0.1);
    }
    
    .onboarding-skip-btn:active {
      transform: translateY(0);
    }
    
    .onboarding-skip-btn .codicon {
      font-size: var(--font-base);
    }
    /* Workspace Context Card */
    .workspace-context-card {
      background-color: var(--vscode-editor-background);
      border: 0.0625rem solid var(--vscode-panel-border);
      border-radius: var(--radius-md);
      padding: var(--spacing-md);
      margin-bottom: var(--spacing-lg);
      box-shadow: var(--shadow-sm);
      animation: slideInFromLeft 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
      max-width: 85%;
      margin-right: auto;
      border-left: 0.1875rem solid var(--vscode-textLink-activeForeground);
    }

    .workspace-context-header {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
      margin-bottom: var(--spacing-sm);
      font-size: var(--font-sm);
      color: var(--vscode-textLink-activeForeground);
    }

    .workspace-context-summary {
      font-size: var(--font-sm);
      margin-bottom: var(--spacing-md);
      line-height: 1.5;
    }

    .workspace-context-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(7.5rem, 1fr));
      gap: var(--spacing-sm);
      background-color: var(--vscode-textBlockQuote-background);
      padding: var(--spacing-sm);
      border-radius: var(--radius-sm);
    }

    .context-grid-item {
      display: flex;
      flex-direction: column;
      gap: var(--spacing-2xs);
    }

    .context-grid-item .label {
      font-size: var(--font-xs);
      color: var(--vscode-descriptionForeground);
      text-transform: uppercase;
      font-weight: 600;
    }

    .context-grid-item .value {
      font-size: var(--font-xs);
      font-weight: 500;
      display: flex;
      align-items: center;
      gap: var(--spacing-xs);
    }
    .context-grid-item .value .codicon {
      font-size: var(--font-sm);
    }

    /* Git Scan Report */
    .git-scan-result {
      background: var(--vscode-editorInfo-background);
      border-left: 0.1875rem solid var(--vscode-editorInfo-foreground);
      padding: var(--spacing-md);
      margin: var(--spacing-sm) 0;
      border-radius: var(--radius-sm);
      font-size: var(--font-sm);
      line-height: 1.6;
    }

    /* Dashboard Actions */
    .dashboard-actions {
      margin-top: var(--spacing-sm);
      display: flex;
      gap: var(--spacing-sm);
      justify-content: center;
    }

    .dashboard-btn {
      padding: var(--spacing-xs) var(--spacing-md);
      background: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      border-radius: var(--radius-sm);
      cursor: pointer;
      font-size: var(--font-xs);
      display: flex;
      align-items: center;
      gap: var(--spacing-xs);
      transition: background 0.2s;
    }

    .dashboard-btn:hover:not(:disabled) {
      background: var(--vscode-button-hoverBackground);
    }

    }

    /* Run Analysis Result */
    .run-analysis-result {
        background: var(--vscode-editor-background);
        border: 0.0625rem solid var(--vscode-widget-border);
        border-radius: var(--radius-sm);
        padding: 0;
        overflow: hidden;
        margin-bottom: var(--spacing-md);
        font-size: var(--font-sm);
    }

    .analysis-header {
        padding: clamp(0.625rem, 1.5vw, 0.6875rem) var(--spacing-md);
        display: flex;
        align-items: center;
        gap: var(--spacing-sm);
        border-bottom: 0.0625rem solid var(--vscode-widget-border);
        background: var(--vscode-editor-inactiveSelectionBackground);
    }

    .analysis-header.success {
        border-left: 0.1875rem solid var(--vscode-testing-iconPassed);
    }

    .analysis-header.failure {
        border-left: 0.1875rem solid var(--vscode-testing-iconFailed);
    }
    
    .analysis-header .codicon-pass {
        color: var(--vscode-testing-iconPassed);
    }
    
    .analysis-header .codicon-error {
        color: var(--vscode-testing-iconFailed);
    }

    .analysis-header code {
        background: var(--vscode-textCodeBlock-background);
        padding: var(--spacing-3xs) var(--spacing-2xs);
        border-radius: var(--radius-sm);
        font-family: var(--vscode-editor-font-family);
    }

    .analysis-header .duration {
        margin-left: auto;
        font-size: var(--font-xs);
        color: var(--vscode-descriptionForeground);
    }

    .analysis-summary, .affected-phases, .analysis-suggestions {
        padding: clamp(0.625rem, 1.5vw, 0.6875rem) var(--spacing-md);
        border-bottom: 0.0625rem solid var(--vscode-widget-border);
    }

    .analysis-summary strong, .affected-phases strong, .analysis-suggestions strong {
        display: block;
        margin-bottom: 4px;
        color: var(--vscode-foreground);
    }

    .affected-phases ul, .analysis-suggestions ul {
        margin: 0;
        padding-left: var(--spacing-lg);
    }

    .affected-phases li, .analysis-suggestions li {
        margin-bottom: 4px;
        line-height: 1.4;
    }

    .output-details {
        padding: var(--spacing-sm) var(--spacing-md);
        background: var(--vscode-textBlockQuote-background);
    }

    .output-details summary {
        cursor: pointer;
        padding: var(--spacing-2xs) 0;
        color: var(--vscode-textLink-foreground);
        font-weight: 500;
        user-select: none;
    }

    .output-block {
        margin-top: var(--spacing-sm);
        font-family: var(--vscode-editor-font-family);
        font-size: var(--font-xs);
    }

    .output-block strong {
        display: block;
        margin-bottom: 4px;
        color: var(--vscode-descriptionForeground);
    }

    .output-block pre {
        margin: 0;
        padding: var(--spacing-sm);
        background: var(--vscode-editor-background);
        border: 0.0625rem solid var(--vscode-widget-border);
        border-radius: var(--radius-sm);
        overflow-x: auto;
        white-space: pre-wrap;
        max-height: clamp(20vh, 35vh, 25rem);
    }

    .output-block.stdout pre {
        color: var(--vscode-foreground);
    }

    .output-block.stderr pre {
        color: var(--vscode-testing-iconFailed);
        border-color: rgba(255, 0, 0, 0.2);
    }
    /* High DPI scaling for ripple effects */
    @media (min-resolution: 2dppx) {
      .header-btn::before,
      .onboarding-btn::before,
      .workflow-action-btn::before,
      .error-action-btn::before,
      .empty-state-config-btn::before,
      #send-button::before {
        width: 0;
        height: 0;
      }
      
      .header-btn:active::before,
      .onboarding-btn:active::before,
      .workflow-action-btn:active::before,
      .error-action-btn:active::before,
      .empty-state-config-btn:active::before,
      #send-button:active::before {
        width: 250%;
        height: 250%;
      }
    }

    .success-bubble {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 12px 16px;
      /* Use a green color from VS Code theme for success usually iconPassed or check */
      background: var(--vscode-testing-iconPassed); 
      color: var(--vscode-editor-background); /* Using background color for text on green usually works well */
      border-radius: 6px;
      margin-bottom: 12px;
      animation: slideDown 0.3s ease-out;
      font-weight: 500;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }

    .success-bubble.fade-out {
      animation: fadeOut 0.3s ease-out forwards;
    }

    .success-bubble .codicon {
      font-size: 16px;
    }

    @keyframes slideDown {
      from {
        opacity: 0;
        transform: translateY(-10px);
      }
      to {
        opacity: 1;
        transform: translateY(0);
      }
    }

    @keyframes fadeOut {
      to {
        opacity: 0;
        transform: translateY(-10px);
      }
    }
  `;
}
