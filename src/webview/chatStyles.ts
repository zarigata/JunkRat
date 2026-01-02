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

      /* Glassmorphism Variables */
      --glass-bg: rgba(30, 30, 30, 0.6); /* Fallback if var not avail, will try to use css vars if possible in usage */
      --glass-border: rgba(255, 255, 255, 0.08); 
      --glass-shadow: 0 4px 30px rgba(0, 0, 0, 0.1);
      --glass-backdrop: blur(10px);
      
      /* We can attempt to perform a calc/hack for rgb if not available, but usually we rely on hex in vscode vars. 
         For glassmorphism we need rgba. We will approximate by using low opacity backgrounds on top of existing colors 
         or hardcoding some defaults that look good in dark mode (assuming dark mode for "cyberpunk/junkrat" vibe). 
      */
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
      /* Subtle gradient background for glassmorphism to work against */
      background-image: 
        radial-gradient(circle at 0% 0%, rgba(0, 120, 215, 0.08) 0%, transparent 50%),
        radial-gradient(circle at 100% 100%, rgba(100, 100, 100, 0.08) 0%, transparent 50%);
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
    .chat-header {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: var(--spacing-md);
      align-items: center;
      padding: var(--spacing-md) var(--spacing-lg);
      /* Glass effect */
      background: rgba(30,30,30, 0.4); 
      backdrop-filter: var(--glass-backdrop);
      -webkit-backdrop-filter: var(--glass-backdrop);
      border-bottom: 1px solid var(--glass-border);
      box-shadow: var(--glass-shadow);
      z-index: 10;
    }

    .header-title {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
      font-weight: 600;
      font-size: var(--font-md);
      letter-spacing: 0.5px;
      color: var(--vscode-titleBar-activeForeground);
      text-shadow: 0 1px 2px rgba(0,0,0,0.2);
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
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-sm);
      background-color: rgba(60,60,60, 0.3);
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
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.2);
      border-color: transparent;
    }

    .header-btn:active {
      transform: translateY(0) scale(0.97);
    }

    .header-btn .codicon {
      font-size: var(--font-lg);
    }
    
    .header-btn.primary {
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      animation: subtlePulse 2s ease-in-out infinite;
      border: none;
    }

    @keyframes subtlePulse {
      0%, 100% { box-shadow: 0 0 0 0 rgba(0, 120, 215, 0.4); }
      50% { box-shadow: 0 0 0 var(--spacing-2xs) rgba(0, 120, 215, 0); }
    }
    
    #history-btn {
      position: relative;
    }

    #history-btn::after {
      content: attr(data-count);
      position: absolute;
      top: calc(var(--spacing-2xs) * -1);
      right: calc(var(--spacing-2xs) * -1);
      background: var(--vscode-activityBarBadge-background);
      color: var(--vscode-activityBarBadge-foreground);
      border-radius: var(--radius-md);
      padding: var(--spacing-3xs) var(--radius-sm);
      font-size: var(--font-xs);
      font-weight: 700;
      display: none;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
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
      /* Subtle inner shadow for depth */
      box-shadow: inset 0 2px 5px rgba(0,0,0,0.02);
    }

    .messages-container::-webkit-scrollbar {
      width: clamp(0.3rem, 0.8vw, 0.5rem);
    }

    .messages-container::-webkit-scrollbar-track {
      background: transparent;
    }

    .messages-container::-webkit-scrollbar-thumb {
      background: var(--vscode-scrollbarSlider-background);
      border-radius: var(--radius-lg);
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
      background: transparent;
    }

    .empty-state .codicon {
      font-size: clamp(3rem, 8vw, 4rem);
      margin-bottom: var(--spacing-xl);
      opacity: 0.9;
      animation: float 3s ease-in-out infinite;
      filter: drop-shadow(0 0 10px rgba(0, 120, 215, 0.3));
      color: var(--vscode-textLink-foreground);
    }
    
    .empty-state h2 {
      font-size: var(--font-lg);
      font-weight: 600;
      margin: 0 0 var(--spacing-sm) 0;
      color: var(--vscode-editor-foreground);
      text-shadow: 0 1px 2px rgba(0,0,0,0.1);
    }

    .empty-state p.subtitle {
      margin: 0 0 var(--spacing-xl) 0;
      font-size: var(--font-sm);
      max-width: clamp(17.5rem, 40vw, 22.5rem);
      opacity: 0.8;
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
      background-color: rgba(128,128,128, 0.1);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-sm);
      animation: fadeInUp 0.4s ease-out backwards;
      backdrop-filter: blur(5px);
    }
    
    .feature-item:nth-child(1) { animation-delay: 0.1s; }
    .feature-item:nth-child(2) { animation-delay: 0.2s; }
    .feature-item:nth-child(3) { animation-delay: 0.3s; }
    
    .feature-item .codicon {
      font-size: var(--font-base);
      margin-bottom: 0;
      animation: none;
      filter: none;
      color: var(--vscode-textLink-activeForeground);
    }
    
    .empty-state-cta {
      font-size: var(--font-xs);
      color: var(--vscode-textLink-foreground);
      font-weight: 600;
      margin-top: var(--spacing-xl);
      opacity: 0.9;
      text-transform: uppercase;
      letter-spacing: 0.5px;
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
      border-radius: var(--radius-lg);
      font-size: var(--font-sm);
      font-weight: 600;
      cursor: pointer;
      box-shadow: 0 4px 15px rgba(0, 120, 215, 0.3);
      transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      position: relative;
      overflow: hidden;
    }

    .empty-state-config-btn:hover {
      transform: translateY(-2px) scale(1.02);
      box-shadow: 0 6px 20px rgba(0, 120, 215, 0.4);
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
      max-width: clamp(75%, 85%, 90%);
      word-wrap: break-word;
      box-shadow: 0 2px 5px rgba(0, 0, 0, 0.05);
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
      background: linear-gradient(135deg, var(--vscode-button-background), var(--vscode-button-hoverBackground));
      color: var(--vscode-button-foreground);
      border-bottom-right-radius: var(--spacing-2xs);
      opacity: 0.98;
      animation: slideInFromRight 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.1);
    }

    .message.assistant {
      margin-right: auto;
      background-color: var(--vscode-editor-inactiveSelectionBackground); 
      border: 1px solid rgba(255,255,255,0.05);
      border-bottom-left-radius: var(--spacing-2xs);
      border-left: 3px solid var(--vscode-textLink-activeForeground);
      animation: slideInFromLeft 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
    }

    .message.error {
      margin-right: auto;
      background-color: rgba(90, 29, 29, 0.8);
      border: 1px solid var(--vscode-inputValidation-errorBorder);
      border-left: 3px solid var(--vscode-errorForeground);
      border-radius: var(--radius-sm);
      padding: var(--spacing-md);
      width: 85%;
      backdrop-filter: blur(5px);
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
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: var(--font-xs);
      background-color: rgba(0,0,0,0.2);
      padding: var(--spacing-xs);
      border-radius: var(--radius-sm);
      margin-bottom: var(--spacing-md);
      white-space: pre-wrap;
      opacity: 0.9;
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
      border: 1px solid var(--glass-border);
      background-color: rgba(255,255,255,0.05); /* very subtle */
      color: var(--vscode-button-secondaryForeground);
      border-radius: var(--radius-sm);
      cursor: pointer;
      font-size: var(--font-xs);
      transition: all 0.2s;
    }

    .error-action-btn:hover {
      background-color: var(--vscode-button-secondaryHoverBackground);
      border-color: var(--vscode-button-secondaryHoverBackground);
    }
    
    .message-text {
      white-space: pre-wrap;
      word-wrap: break-word;
      line-height: 1.6;
    }

    .message-timestamp {
      font-size: var(--font-xs);
      opacity: 0.6;
      margin-top: var(--spacing-xs);
      text-align: right;
    }

    .input-container {
      display: flex;
      flex-direction: row;
      padding: var(--spacing-lg);
      gap: var(--spacing-md);
      border-top: 1px solid var(--glass-border);
      background-color: var(--vscode-editor-background);
      box-shadow: 0 -4px 20px rgba(0,0,0,0.1);
      z-index: 10;
    }

    .provider-selector {
      display: flex;
      align-items: center;
      gap: var(--spacing-md);
      padding: var(--spacing-sm) var(--spacing-lg);
      border-bottom: 1px solid var(--glass-border);
      background: rgba(30,30,30, 0.4);
      backdrop-filter: var(--glass-backdrop);
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
      border: 1px solid var(--vscode-dropdown-border);
      font-family: inherit;
      font-size: inherit;
      cursor: pointer;
      outline: none;
      transition: all 0.2s;
    }

    #provider-select:focus {
      border-color: var(--vscode-focusBorder);
      box-shadow: 0 0 0 2px rgba(0, 120, 215, 0.25);
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
      text-shadow: 0 0 5px rgba(0, 255, 0, 0.2);
    }

    .provider-status.unavailable {
      color: var(--vscode-charts-red);
    }

    .settings-button {
      padding: var(--spacing-xs) var(--spacing-md);
      border-radius: var(--radius-sm);
      background-color: transparent;
      color: var(--vscode-button-secondaryForeground);
      border: 1px solid var(--glass-border);
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
      border-radius: var(--radius-md); /* Softer corners */
      background-color: var(--vscode-input-background);
      color: var(--vscode-input-foreground);
      border: 1px solid var(--vscode-input-border);
      font-family: inherit;
      font-size: inherit;
      resize: none;
      min-height: 3.75rem;
      max-height: 12.5rem;
      outline: none;
      transition: border-color 0.2s, box-shadow 0.2s, background-color 0.2s;
    }

    #message-input:focus {
      border-color: var(--vscode-focusBorder);
      box-shadow: 0 0 0 3px rgba(0, 120, 215, 0.1);
    }

    #message-input::placeholder {
      color: var(--vscode-input-placeholderForeground);
      font-style: italic;
    }

    #send-button {
      position: relative;
      overflow: hidden;
      padding: var(--spacing-sm) var(--spacing-xl);
      border-radius: var(--radius-md);
      background-color: var(--vscode-button-background);
      color: var(--vscode-button-foreground);
      border: none;
      cursor: pointer;
      font-family: inherit;
      font-size: inherit;
      font-weight: 600;
      transition: all 0.2s ease;
      white-space: nowrap;
      box-shadow: 0 2px 5px rgba(0,0,0,0.1);
    }

    #send-button:hover {
      background-color: var(--vscode-button-hoverBackground);
      transform: translateY(-1px);
      box-shadow: 0 4px 10px rgba(0,0,0,0.2);
    }

    #send-button:active {
      transform: translateY(0) scale(0.98);
    }

    #send-button:focus {
      outline: 2px solid var(--vscode-focusBorder);
      outline-offset: 2px;
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
      filter: grayscale(0.5);
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
      background-color: rgba(60, 60, 60, 0.6);
      color: var(--vscode-button-secondaryForeground);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-sm);
      cursor: pointer;
      font-family: inherit;
      font-size: var(--font-xs);
      font-weight: 500;
      transition: all 0.2s;
      backdrop-filter: blur(4px);
    }

    .phase-plan-action-button:hover {
      background-color: var(--vscode-button-secondaryHoverBackground);
      transform: translateY(-1px);
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    }

    .phase-plan-action-button.secondary {
      background-color: transparent;
      border-color: var(--glass-border);
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
      background-color: rgba(30,30,30, 0.6);
      border: 1px solid var(--glass-border);
      border-radius: var(--radius-md);
      padding: var(--spacing-md);
      transition: all 0.3s ease;
      animation: expandPhase 0.4s ease-out backwards;
      position: relative;
      /* Glass effect */
      backdrop-filter: blur(5px);
    }
    
    .phase-item:nth-child(1) { animation-delay: 0.1s; }
    .phase-item:nth-child(2) { animation-delay: 0.2s; }
    .phase-item:nth-child(3) { animation-delay: 0.3s; }

    .phase-item:hover {
      border-color: var(--vscode-focusBorder);
      transform: translateX(var(--spacing-2xs));
      box-shadow: -2px 0 0 0 var(--vscode-focusBorder), 0 4px 12px rgba(0,0,0,0.1);
      background-color: rgba(30,30,30, 0.8);
    }

    .phase-item-header {
      display: flex;
      align-items: center;
      gap: var(--spacing-sm);
      margin-bottom: var(--spacing-md);
      flex-wrap: wrap;
    }

    .phase-number {
      background: linear-gradient(135deg, var(--vscode-activityBar-activeBorder), var(--vscode-textLink-foreground));
      color: #fff;
      padding: var(--spacing-2xs) var(--spacing-sm);
      border-radius: var(--radius-md);
      font-size: var(--font-xs);
      font-weight: 700;
      transition: transform 0.2s;
      box-shadow: 0 2px 5px rgba(0,0,0,0.2);
    }
    
    .phase-item:hover .phase-number {
        transform: scale(1.1) rotate(-2deg);
    }

    .phase-title {
      font-weight: 600;
      flex: 1;
      font-size: var(--font-md);
      letter-spacing: 0.2px;
    }

    .phase-complexity {
      font-size: var(--font-xs);
      padding: var(--spacing-3xs) var(--spacing-sm);
      border-radius: 12px;
      text-transform: uppercase;
      font-weight: 700;
      letter-spacing: 0.5px;
    }

    .complexity-low { background-color: var(--vscode-charts-green); color: #fff; text-shadow: 0 1px 1px rgba(0,0,0,0.2); }
    .complexity-medium { background-color: var(--vscode-charts-yellow); color: #333; }
    .complexity-high { background-color: var(--vscode-charts-red); color: #fff; text-shadow: 0 1px 1px rgba(0,0,0,0.2); }

    .phase-description {
      font-size: var(--font-sm);
      color: var(--vscode-descriptionForeground);
      margin-bottom: var(--spacing-lg);
      line-height: 1.6;
      padding-left: var(--spacing-md);
      border-left: 2px solid rgba(0, 120, 215, 0.3);
    }
    
    .verification-completed-indicator {
        display: flex;
        align-items: center;
        gap: var(--spacing-sm);
        color: var(--vscode-charts-green);
        font-weight: 600;
        margin-top: var(--spacing-sm);
        padding: var(--spacing-xs) var(--spacing-sm);
        background: rgba(0, 255, 0, 0.1);
        border-radius: var(--radius-sm);
        animation: fadeIn 0.5s ease-in-out;
    }

    /* Tasks */
    .task-list {
        display: flex;
        flex-direction: column;
        gap: var(--spacing-xs);
        padding-left: var(--spacing-md);
        margin-top: var(--spacing-md);
    }
    
    .task-item {
        padding: var(--spacing-sm);
        border-radius: var(--radius-sm);
        background: rgba(255,255,255, 0.03);
        border: 1px solid transparent;
        transition: all 0.2s;
        display: flex;
        justify-content: space-between;
        align-items: center;
    }
    
    .task-item.status-completed {
        background: rgba(0, 255, 0, 0.05);
        border-color: rgba(0, 255, 0, 0.1);
    }

    .task-item:hover {
        background: rgba(255,255,255, 0.05);
        border-color: var(--glass-border);
    }

    /* Modals - Glassmorphism */
    .modal-overlay, .confirm-modal-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background-color: rgba(0, 0, 0, 0.6); /* Darker dim */
        backdrop-filter: blur(4px);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 1000;
        opacity: 0;
        animation: fadeIn 0.3s forwards;
    }
    
    .modal-content, .confirm-modal-content {
        background-color: var(--vscode-editor-background);
        padding: var(--spacing-lg);
        border-radius: var(--radius-lg);
        width: clamp(18.75rem, 40vw, 31.25rem);
        box-shadow: 0 10px 40px rgba(0,0,0,0.4);
        border: 1px solid var(--glass-border);
        transform: translateY(20px);
        animation: slideUp 0.3s forwards 0.1s;
    }
    
    .modal-input {
        width: 100%;
        padding: var(--spacing-sm);
        margin: var(--spacing-sm) 0 var(--spacing-lg);
        background: var(--vscode-input-background);
        color: var(--vscode-input-foreground);
        border: 1px solid var(--vscode-input-border);
        border-radius: var(--radius-sm);
        font-family: inherit;
        outline: none;
    }
    
    .modal-input:focus {
        border-color: var(--vscode-focusBorder);
        box-shadow: 0 0 0 2px rgba(0, 120, 215, 0.2);
    }

    .modal-actions {
        display: flex;
        justify-content: flex-end;
        gap: var(--spacing-sm);
    }
    
    .modal-btn {
        padding: var(--spacing-sm) var(--spacing-lg);
        border-radius: var(--radius-sm);
        cursor: pointer;
        font-weight: 500;
        border: none;
        transition: all 0.2s;
    }
    
    .modal-btn.primary {
        background: var(--vscode-button-background);
        color: var(--vscode-button-foreground);
    }
    
    .modal-btn.primary:hover {
        background: var(--vscode-button-hoverBackground);
        transform: translateY(-1px);
    }
    
    .modal-btn.secondary {
        background: transparent;
        color: var(--vscode-button-secondaryForeground);
        border: 1px solid var(--vscode-button-secondaryBorder);
    }
    
    .modal-btn.secondary:hover {
        background: var(--vscode-button-secondaryHoverBackground);
    }
    
    @keyframes fadeIn { to { opacity: 1; } }
    @keyframes slideUp { to { transform: translateY(0); opacity: 1; } }

    /* Mock Mode Toggle */
    .mock-mode-toggle {
      display: flex;
      align-items: center;
      gap: var(--spacing-xs);
      padding: var(--spacing-xs) var(--spacing-sm);
      border-radius: var(--radius-sm);
      background: var(--vscode-badge-background);
      margin-right: auto;
    }
  
    .mock-mode-toggle .toggle-checkbox {
      position: absolute;
      opacity: 0;
      width: 0;
      height: 0;
    }
  
    .mock-mode-toggle .toggle-label {
      display: flex;
      align-items: center;
      gap: var(--spacing-xs);
      font-size: var(--font-xs);
      cursor: pointer;
      user-select: none;
      color: var(--vscode-badge-foreground);
      font-weight: 600;
      opacity: 0.8;
      transition: opacity 0.2s;
    }
    
    .mock-mode-toggle:hover .toggle-label {
      opacity: 1;
    }
    
    .mock-mode-toggle .toggle-checkbox:checked + .toggle-label {
      color: var(--vscode-charts-orange);
      text-shadow: 0 0 5px rgba(255, 165, 0, 0.4);
    }
    
    .provider-status.mock-mode {
       color: var(--vscode-charts-orange);
       font-weight: 600;
       animation: pulse 2s infinite;
    }

  `;
}
