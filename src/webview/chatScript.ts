/**
 * Returns JavaScript code for the chat webview
 */
export function getChatScript(): string {
  return `
    (function() {
      const vscode = acquireVsCodeApi();

      // Safe postMessage wrapper
      function safePostMessage(message) {
        try {
          vscode.postMessage(message);
        } catch (error) {
          console.error('postMessage failed:', error, 'Message:', message);
          if (message.type !== 'webviewError') {
            try {
              safePostMessage({
                type: 'webviewError',
                payload: {
                  message: 'Failed to send message: ' + (message.type || 'unknown'),
                  error: error.message
                }
              });
            } catch (e) {
              console.error('Failed to report postMessage error:', e);
            }
          }
        }
      }
      
      // State management
      let messages = [];
      let workspaceContext = null; // New state

      let models = [];
      let activeProviderId = 'ollama';
      let activeModel = 'llama3';
      let conversationState = 'IDLE';
      let conversationMetadata = null;
      let currentPhasePlan = null;
      let currentPhaseMarkdown = '';
      let messageQueue = [];
      
      // Restore previous state
      const previousState = vscode.getState();
      if (previousState) {
        if (previousState.messages) {
          messages = previousState.messages;
        }
        if (previousState.providers) {
          providers = previousState.providers;
        }
        if (previousState.activeProviderId) {
          activeProviderId = previousState.activeProviderId;
        }
        if (previousState.conversationState) {
          conversationState = previousState.conversationState;
        }
        if (previousState.conversationMetadata) {
          conversationMetadata = previousState.conversationMetadata;
        }
        if (previousState.currentPhasePlan) {
          currentPhasePlan = previousState.currentPhasePlan;
        }
        if (previousState.currentPhaseMarkdown) {
          currentPhaseMarkdown = previousState.currentPhaseMarkdown;
        }
      }
      
      // DOM references
      const messagesContainer = document.getElementById('messages-container');
      const messageInput = document.getElementById('message-input');
      const sendButton = document.getElementById('send-button');
      const onboardingWizard = document.getElementById('onboarding-wizard');
      const emptyState = document.getElementById('empty-state');
      const newChatBtn = document.getElementById('new-chat-btn');
      const analyzeWorkspaceBtn = document.getElementById('analyze-workspace-btn');
      const historyBtn = document.getElementById('history-btn');
      const clearChatBtn = document.getElementById('clear-chat-btn');
      const providerSelect = document.getElementById('provider-select');
      const providerStatus = document.getElementById('provider-status');
      const settingsButton = document.getElementById('provider-settings-button');
      const conversationStateBadge = document.getElementById('conversation-state-badge');
      const modelSelectorContainer = document.getElementById('model-selector-container');
      const modelSelect = document.getElementById('model-select');
      const modelStatus = document.getElementById('model-status');

      const phaseGenerationIndicator = null;

      // Initialize header buttons
      if (analyzeWorkspaceBtn) {
        analyzeWorkspaceBtn.onclick = () => {
          try {
            safePostMessage({ type: 'analyzeWorkspace' });
          } catch (error) {
            console.error('Analyze Workspace button failed:', error);
          }
        };
      }

      function setState() {
        vscode.setState({
          messages,
          providers,
          activeProviderId,
          conversationState,
          conversationMetadata,
          currentPhasePlan,
          currentPhaseMarkdown,
          workspaceContext // Persist workspace context
        });
      }

      /**
       * Renders the workspace context card
       */
      function renderWorkspaceContextCard(context, summary) {
         workspaceContext = context; // Update local state
         
         const contextDiv = document.createElement('div');
         contextDiv.className = 'workspace-context-card';
         
         // Header
         const header = document.createElement('div');
         header.className = 'workspace-context-header';
         header.innerHTML = '<span class="codicon codicon-briefcase"></span><strong>Workspace Analyzed</strong>';
         contextDiv.appendChild(header);
         
         // Summary
         const summaryDiv = document.createElement('div');
         summaryDiv.className = 'workspace-context-summary';
         summaryDiv.textContent = summary;
         contextDiv.appendChild(summaryDiv);
         
         // Details Grid
         const grid = document.createElement('div');
         grid.className = 'workspace-context-grid';
         
         // Files
         const filesItem = document.createElement('div');
         filesItem.className = 'context-grid-item';
         filesItem.innerHTML = '<span class="label">Files</span><span class="value">' + context.fileCount + '</span>';
         grid.appendChild(filesItem);
         
         // Technologies
         if (context.technologies && context.technologies.length > 0) {
             const techItem = document.createElement('div');
             techItem.className = 'context-grid-item';
             techItem.innerHTML = '<span class="label">Tech Stack</span><span class="value">' + context.technologies.slice(0, 3).join(', ') + (context.technologies.length > 3 ? '...' : '') + '</span>';
             grid.appendChild(techItem);
         }
         
         // Git
         if (context.gitBranch) {
             const gitItem = document.createElement('div');
             gitItem.className = 'context-grid-item';
             gitItem.innerHTML = '<span class="label">Git Branch</span><span class="value"><span class="codicon codicon-git-branch"></span> ' + context.gitBranch + '</span>';
             grid.appendChild(gitItem);
         }
         
         contextDiv.appendChild(grid);
         
         messagesContainer.appendChild(contextDiv);
         messagesContainer.scrollTop = messagesContainer.scrollHeight;

         // Add to messages for history
         messages.push({
             id: Date.now().toString(),
             role: 'assistant',
             text: summary,
             isWorkspaceContext: true,
             payload: { context, summary },
             timestamp: Date.now()
         });
         
         setState();
      }
      
      /**
       * Renders a message in the chat interface
       */
      function renderErrorMessage(payload) {
        const errorDiv = document.createElement('div');
        errorDiv.className = 'message error';
        
        let icon = 'error';
        if (payload.errorType === 'network') icon = 'globe';
        else if (payload.errorType === 'timeout') icon = 'watch';
        else if (payload.errorType === 'rate_limit') icon = 'dashboard';
        else if (payload.errorType === 'model_not_found') icon = 'search';
        
        let html = \`
          <div class="error-header">
            <span class="codicon codicon-\${icon}"></span>
            <strong>Error: \${payload.errorType ? payload.errorType.replace('_', ' ') : 'Unknown Error'}</strong>
          </div>
          <div class="error-body">\${payload.error}</div>
        \`;
        
        if (payload.details) {
          html += \`<div class="error-details">\${payload.details}</div>\`;
        }
        
        if (payload.suggestedActions && payload.suggestedActions.length > 0) {
          html += '<div class="error-actions">';
          payload.suggestedActions.forEach(action => {
            html += \`
              <button class="error-action-btn" 
                      data-action="\${action.action}" 
                      \${action.providerId ? 'data-provider-id="' + action.providerId + '"' : ''}>
                \${action.label}
              </button>
            \`;
          });
          html += '</div>';
        }
        
        errorDiv.innerHTML = html;
        messagesContainer.appendChild(errorDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        // Add to messages array for persistence (simplification)
        messages.push({
           id: Date.now().toString(),
           role: 'assistant',
           text: payload.error, // Fallback text
           isError: true,
           payload: payload,
           timestamp: Date.now()
        });
      }

      function renderMessage(message) {
        if (message.isWorkspaceContext) {
            renderWorkspaceContextCard(message.payload.context, message.payload.summary);
            return;
        }

        // ... existing renderMessage logic ...
        if (message.isError && message.payload) {
             // If re-rendering history and it was an error
             // We might need special handling or just render text as fallback
             // For now, let's just let it fall through or specifically handle it
             // Actually, regular renderMessage handles text.
             // But we want the rich UI. 
             // Ideally we shouldn't push full error objects to 'messages' array if we want persistence of rich UI.
             // But for this task, we just render it.
        }

        const messageDiv = document.createElement('div');
        messageDiv.className = 'message ' + message.role;
        
        // ... (rest of renderMessage)
        
        const textDiv = document.createElement('div');
        textDiv.className = 'message-text';
        textDiv.textContent = message.text;
        
        const timestampDiv = document.createElement('div');
        timestampDiv.className = 'message-timestamp';
        const date = new Date(message.timestamp);
        timestampDiv.textContent = date.toLocaleTimeString();
        
        messageDiv.appendChild(textDiv);
        messageDiv.appendChild(timestampDiv);
        
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
        
        // Hide empty state when messages exist
        if (emptyState) {
          emptyState.style.display = 'none';
        }
        hideOnboardingWizard(); // Hide onboarding if messages arrive (e.g. from history)
      }

      function removeExistingPhasePlan() {
        const existing = messagesContainer.querySelector('.phase-plan-message');
        if (existing) {
          existing.remove();
        }
      }

      function resetPhasePlan() {
        removeExistingPhasePlan();
        currentPhasePlan = null;
        currentPhaseMarkdown = '';
      }

      const stateLabelMap = {
        IDLE: 'Ready to vibe',
        GATHERING_REQUIREMENTS: 'Gathering the deets',
        ANALYZING_REQUIREMENTS: 'Cooking up the plan',
        GENERATING_PHASES: 'Generating epic phases',
        COMPLETE: 'Ready for lift-off 🚀',
        ANALYZING_WORKSPACE: 'Scanning the perimeter',
        ERROR: 'Vibe check failed',
      };

      const stateIconMap = {
        IDLE: 'circle-outline',
        GATHERING_REQUIREMENTS: 'comment-discussion',
        ANALYZING_REQUIREMENTS: 'beaker',
        GENERATING_PHASES: 'rocket',
        COMPLETE: 'check-all',
        ERROR: 'warning',
      };

      function getStateBadgeClass(state) {
        return 'conversation-state-badge conversation-state-' + (state ? state.toLowerCase().replace('_', '-') : 'idle');
      }

      function renderWorkflowButtons(state) {
        const container = document.getElementById('workflow-actions-container');
        if (!container) return;

        container.innerHTML = '';
        container.style.display = 'none';

        const buttons = [];

        if (state === 'GATHERING_REQUIREMENTS') {
            buttons.push({
                text: 'Ready to Generate Phases? 🚀',
                icon: 'rocket',
                className: 'primary',
                onClick: () => {
                    safePostMessage({ type: 'triggerPhaseGeneration' });
                }
            });
        } else if (state === 'COMPLETE') {
            buttons.push({
                text: 'Regenerate Plan 🔄',
                icon: 'sync',
                className: 'secondary',
                onClick: () => {
                     showConfirmDialog('Regenerate Plan', 'This will overwrite the current plan. Continue?', 'Regenerate', () => {
                        safePostMessage({ type: 'regeneratePhasePlan', payload: { conversationId: currentPhasePlan ? currentPhasePlan.conversationId : undefined } });
                     });
                }
            });
            buttons.push({
                text: 'Verify All Phases ✅',
                icon: 'check-all',
                className: 'primary',
                onClick: () => {
                    safePostMessage({ type: 'verifyAllPhases' });
                }
            });
        }

        if (buttons.length > 0) {
            container.style.display = 'flex';
            buttons.forEach(btn => {
                const button = document.createElement('button');
                button.className = 'workflow-action-btn ' + (btn.className || '');
                button.innerHTML = '<span class="codicon codicon-' + btn.icon + '"></span>' + btn.text;
                button.onclick = btn.onClick;
                container.appendChild(button);
            });
        }
      }

      function updateProgressBar(completed, verified, total) {
        const container = document.getElementById('phase-progress-bar');
        const fill = document.getElementById('progress-bar-fill');
        const label = document.getElementById('progress-bar-label');
        
        if (!container || !fill || !label) return;

        if (total > 0) {
            container.style.display = 'flex';
            const percentage = Math.round((completed / total) * 100);
            fill.style.width = percentage + '%';
            label.textContent = completed + ' / ' + total + ' phases completed (' + verified + ' verified)';
        } else {
            container.style.display = 'none';
        }
      }

      function renderPhasePlan(plan, formattedMarkdown) {
        if (!plan) {
          return;
        }

        currentPhasePlan = plan;
        currentPhaseMarkdown = formattedMarkdown || '';

        removeExistingPhasePlan();
        hidePhaseGenerationIndicator();

        const phasePlanDiv = document.createElement('div');
        phasePlanDiv.className = 'phase-plan-message';
        phasePlanDiv.dataset.conversationId = plan.conversationId;

        const headerDiv = document.createElement('div');
        headerDiv.className = 'phase-plan-header';
        
        // Header content...
        // Removed separate title div inside phase-plan-header to simplify as per CSS
        // Re-adding structure to match styles if needed, but styling was generic phase-plan-message

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'phase-plan-actions';

        const copyMarkdownButton = document.createElement('button');
        copyMarkdownButton.className = 'phase-plan-action-button';
        copyMarkdownButton.dataset.action = 'copy-markdown';
        copyMarkdownButton.innerHTML = '<span class="codicon codicon-clippy"></span><span>Copy All</span>';

        const exportMarkdownButton = document.createElement('button');
        exportMarkdownButton.className = 'phase-plan-action-button';
        exportMarkdownButton.dataset.action = 'export-markdown';
        exportMarkdownButton.innerHTML = '<span class="codicon codicon-save"></span><span>Export MD</span>';

        const exportJsonButton = document.createElement('button');
        exportJsonButton.className = 'phase-plan-action-button';
        exportJsonButton.dataset.action = 'export-json';
        exportJsonButton.innerHTML = '<span class="codicon codicon-save-as"></span><span>Export JSON</span>';

        const regenerateButton = document.createElement('button');
        regenerateButton.className = 'phase-plan-action-button secondary';
        regenerateButton.dataset.action = 'regenerate';
        regenerateButton.innerHTML = '<span class="codicon codicon-sync"></span><span>Regenerate</span>';
        
        actionsDiv.appendChild(copyMarkdownButton);
        actionsDiv.appendChild(exportMarkdownButton);
        actionsDiv.appendChild(exportJsonButton);
        actionsDiv.appendChild(regenerateButton);

        const scanGitButton = document.createElement('button');
        scanGitButton.className = 'phase-plan-action-button';
        scanGitButton.innerHTML = '<span class="codicon codicon-git-commit"></span><span>Scan Git</span>';
        scanGitButton.onclick = () => handleScanGitProgress(false);
        actionsDiv.appendChild(scanGitButton);

        const runAnalyzeButton = document.createElement('button');
        runAnalyzeButton.className = 'phase-plan-action-button';
        runAnalyzeButton.innerHTML = '<span class="codicon codicon-beaker"></span><span>Run & Analyze</span>';
        runAnalyzeButton.onclick = () => handleRunAndAnalyze();
        actionsDiv.appendChild(runAnalyzeButton);

        const contentDiv = document.createElement('div');
        contentDiv.className = 'phase-plan-content';
        
        // Add Phase Button (Top Level)
        const addPhaseTopBtn = document.createElement('button');
        addPhaseTopBtn.className = 'phase-plan-action-button';
        addPhaseTopBtn.style.marginBottom = '16px';
        addPhaseTopBtn.innerHTML = '<span class="codicon codicon-add"></span><span>Add New Phase</span>';
        addPhaseTopBtn.onclick = () => showAddPhaseDialog(null);
        contentDiv.appendChild(addPhaseTopBtn);

        // Render phases with tasks in Traycer style
        if (plan.phases && plan.phases.length > 0) {
          const phaseListDiv = document.createElement('div');
          phaseListDiv.className = 'phase-list';

          plan.phases.forEach((phase, phaseIndex) => {
            const phaseItem = document.createElement('div');
            phaseItem.className = 'phase-item';
            phaseItem.dataset.phaseId = phase.id;

            const phaseHeader = document.createElement('div');
            phaseHeader.className = 'phase-item-header';
            phaseHeader.innerHTML = '<span class="phase-number">Phase ' + (phaseIndex + 1) + '</span>' +
              '<span class="phase-title">' + phase.title + '</span>' +
              '<span class="phase-complexity complexity-' + (phase.estimatedComplexity || 'medium') + '">' + 
              (phase.estimatedComplexity || 'medium') + '</span>';
              
            // Phase Status Badge
            const statusBadge = document.createElement('span');
            statusBadge.className = 'phase-status-badge status-' + (phase.status || 'pending');
            // Assuming simplified CSS for status, or inline it
            // Using existing logic but updated class names if any
            statusBadge.innerHTML = '<span class="codicon ' + (phase.status === 'verified' ? 'codicon-verified-filled' : 
                                        phase.status === 'completed' ? 'codicon-check' : 
                                        phase.status === 'in-progress' ? 'codicon-sync' : 'codicon-circle-outline') + '"></span>' +
                                        (phase.status || 'pending');
            phaseHeader.appendChild(statusBadge);

            // Verification button (only if completed)
            if (phase.status === 'completed') {
               const verifyBtn = document.createElement('button');
               verifyBtn.className = 'verify-phase-btn phase-plan-action-button';
               verifyBtn.dataset.phaseId = phase.id;
               verifyBtn.innerHTML = '<span class="codicon codicon-check-all"></span>Mark as Verified';
               // Add click handler via delegation
               phaseHeader.appendChild(verifyBtn);
            }

            // Action buttons
            const actionsSpan = document.createElement('span');
            actionsSpan.className = 'phase-actions';
            actionsSpan.style.marginLeft = 'auto'; // Push to right
            actionsSpan.style.display = 'flex';
            actionsSpan.style.gap = '4px';

            // Edit/Delete buttons (only for pending phases)
            if (phase.status === 'pending') {
              const editBtn = document.createElement('button');
              editBtn.className = 'header-btn'; // Reuse header-btn for small icon buttons
              editBtn.innerHTML = '<span class="codicon codicon-edit"></span>';
              editBtn.title = 'Edit Phase';
              editBtn.onclick = (e) => {
                e.stopPropagation();
                showEditPhaseDialog(phase.id, phase.title, phase.description);
              };

              const deleteBtn = document.createElement('button');
              deleteBtn.className = 'header-btn danger';
              deleteBtn.innerHTML = '<span class="codicon codicon-trash"></span>';
              deleteBtn.title = 'Delete Phase';
              deleteBtn.onclick = (e) => {
                e.stopPropagation();
                showConfirmDialog('Delete Phase', 'Are you sure you want to delete this phase?', 'Delete', () => {
                   safePostMessage({
                      type: 'deletePhase',
                      payload: {
                        conversationId: plan.conversationId,
                        phaseId: phase.id
                      }
                    });
                });
              };
              
              actionsSpan.appendChild(editBtn);
              actionsSpan.appendChild(deleteBtn);
            }
            
            // Add After button (for all phases)
            const addAfterBtn = document.createElement('button');
            addAfterBtn.className = 'header-btn';
            addAfterBtn.innerHTML = '<span class="codicon codicon-plus"></span>';
            addAfterBtn.title = 'Add Phase After This';
            addAfterBtn.onclick = (e) => {
                e.stopPropagation();
                showAddPhaseDialog(phase.id);
            };
            actionsSpan.appendChild(addAfterBtn);

            phaseHeader.appendChild(actionsSpan);

            phaseItem.appendChild(phaseHeader);

            const phaseDesc = document.createElement('div');
            phaseDesc.className = 'phase-description';
            phaseDesc.textContent = phase.description;
            phaseItem.appendChild(phaseDesc);
            
            // Verification completed indicator
            if (phase.status === 'verified') {
              const verifiedIndicator = document.createElement('div');
              verifiedIndicator.className = 'verification-completed-indicator';
              verifiedIndicator.innerHTML = '<span class="codicon codicon-pass-filled"></span><span>Verification Completed</span>';
              phaseItem.appendChild(verifiedIndicator);
            }

            // Render tasks with execute buttons (Traycer style)
            if (phase.tasks && phase.tasks.length > 0) {
              const taskList = document.createElement('div');
              taskList.className = 'task-list';

              phase.tasks.forEach((task, taskIndex) => {
                const taskItem = document.createElement('div');
                taskItem.className = 'task-item';
                taskItem.dataset.taskId = task.id;

                const taskHeader = document.createElement('div');
                taskHeader.className = 'task-header';
                
                const taskInfo = document.createElement('div');
                taskInfo.className = 'task-info';
                
                // Status badge as toggle
                const statusClass = 'status-' + (task.status || 'pending');
                const statusIcon = task.status === 'completed' ? 'codicon-check' : 
                                   task.status === 'in-progress' ? 'codicon-sync' : 'codicon-circle-outline';

                taskInfo.innerHTML = '<span class="task-number">' + (taskIndex + 1) + '</span>' +
                  '<span class="task-title">' + task.title + '</span>' +
                  '<span class="task-status-badge ' + statusClass + '" title="Click to change status" data-task-id="' + task.id + '" data-phase-id="' + phase.id + '">' +
                  '<span class="codicon ' + statusIcon + '"></span>' +
                  (task.status || 'pending') + '</span>';

                const taskActions = document.createElement('div');
                taskActions.className = 'task-actions';

                // Execute dropdown button
                const executeBtn = document.createElement('div');
                executeBtn.className = 'execute-dropdown';
                executeBtn.innerHTML = '<button class="execute-btn"><span class="codicon codicon-play"></span><span>Execute</span></button>' +
                  '<div class="execute-menu">' +
                  '<button class="execute-option" data-action="copy"><span class="codicon codicon-clippy"></span>Copy to Clipboard</button>' +
                  '<div class="execute-menu-divider"></div>' +
                  '<button class="execute-option" data-action="roo-code"><span class="codicon codicon-rocket"></span>Roo Code</button>' +
                  '<button class="execute-option" data-action="windsurf"><span class="codicon codicon-symbol-method"></span>Windsurf</button>' +
                  '<button class="execute-option" data-action="aider"><span class="codicon codicon-file-code"></span>Aider</button>' +
                  '<button class="execute-option" data-action="cursor"><span class="codicon codicon-edit"></span>Cursor</button>' +
                  '<button class="execute-option" data-action="continue"><span class="codicon codicon-debug-continue"></span>Continue</button>' +
                  '<div class="execute-menu-divider"></div>' +
                  '<button class="execute-option" data-action="gemini-cli"><span class="codicon codicon-terminal"></span>Run in Gemini CLI</button>' +
                  '</div>';

                taskActions.appendChild(executeBtn);
                taskHeader.appendChild(taskInfo);
                taskHeader.appendChild(taskActions);
                taskItem.appendChild(taskHeader);

                // Task goal
                const taskGoal = document.createElement('div');
                taskGoal.className = 'task-goal';
                taskGoal.textContent = task.goal;
                taskItem.appendChild(taskGoal);

                // Store task data for execution
                taskItem.dataset.taskData = JSON.stringify(task);
                taskItem.dataset.phaseTitle = phase.title;

                taskList.appendChild(taskItem);
              });

              phaseItem.appendChild(taskList);
            }

            phaseListDiv.appendChild(phaseItem);
          });

          contentDiv.appendChild(phaseListDiv);
        } else {
          // Fallback to raw markdown
          const pre = document.createElement('pre');
          pre.textContent = formattedMarkdown;
          contentDiv.appendChild(pre);
        }

        const handoffDiv = document.createElement('div');
        handoffDiv.className = 'global-handoff-container';

        const handoffDropdown = document.createElement('div');
        handoffDropdown.className = 'global-handoff-dropdown';
        handoffDropdown.innerHTML = 
          '<button class="global-handoff-btn">' +
          '<span class="codicon codicon-export"></span>' +
          '<span>Handoff To AI</span>' +
          '<span class="codicon codicon-chevron-down"></span>' +
          '</button>' +
          '<div class="global-handoff-menu">' +
          '<button class="handoff-option" data-tool="roo-code">' +
          '<span class="codicon codicon-rocket"></span>Roo Code</button>' +
          '<button class="handoff-option" data-tool="windsurf">' +
          '<span class="codicon codicon-symbol-method"></span>Windsurf</button>' +
          '<button class="handoff-option" data-tool="aider">' +
          '<span class="codicon codicon-file-code"></span>Aider</button>' +
          '<button class="handoff-option" data-tool="cursor">' +
          '<span class="codicon codicon-edit"></span>Cursor</button>' +
          '<button class="handoff-option" data-tool="continue">' +
          '<span class="codicon codicon-debug-continue"></span>Continue</button>' +
          '</div>';

        handoffDiv.appendChild(handoffDropdown);
        const feedbackDiv = document.createElement('div');
        feedbackDiv.className = 'phase-plan-feedback';

        phasePlanDiv.appendChild(headerDiv);
        phasePlanDiv.appendChild(contentDiv);
        phasePlanDiv.appendChild(actionsDiv);
        phasePlanDiv.appendChild(handoffDiv);
        phasePlanDiv.appendChild(feedbackDiv);

        messagesContainer.appendChild(phasePlanDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        if (emptyState) {
          emptyState.style.display = 'none';
        }

        setState();
      }
      
      /* --- Custom Modal Functions --- */
      
      function showConfirmDialog(title, message, confirmText, onConfirm) {
         const overlay = document.createElement('div');
         overlay.className = 'confirm-modal-overlay';
         
         const content = document.createElement('div');
         content.className = 'confirm-modal-content';
         
         const h3 = document.createElement('h3');
         h3.textContent = title;
         
         const p = document.createElement('p');
         p.textContent = message;
         
         const actions = document.createElement('div');
         actions.className = 'modal-actions';
         
         const closeModal = () => {
             document.removeEventListener('keydown', handleKeydown);
             overlay.remove();
         };

         const handleConfirm = () => {
             onConfirm();
             closeModal();
         };

         const handleKeydown = (e) => {
             if (e.key === 'Escape') {
                 closeModal();
                 e.preventDefault();
                 e.stopPropagation();
             } else if (e.key === 'Enter') {
                 handleConfirm();
                 e.preventDefault();
                 e.stopPropagation();
             }
         };
         
         const cancelBtn = document.createElement('button');
         cancelBtn.className = 'modal-btn secondary';
         cancelBtn.textContent = 'Cancel';
         cancelBtn.onclick = closeModal;
         
         const confirmBtn = document.createElement('button');
         confirmBtn.className = 'modal-btn primary confirm-btn-danger';
         confirmBtn.textContent = confirmText || 'Confirm';
         confirmBtn.onclick = handleConfirm;
         
         actions.appendChild(cancelBtn);
         actions.appendChild(confirmBtn);
         
         content.appendChild(h3);
         content.appendChild(p);
         content.appendChild(actions);
         overlay.appendChild(content);
         
         document.body.appendChild(overlay);
         document.addEventListener('keydown', handleKeydown);
         
         confirmBtn.focus();
      }

      function showAddPhaseDialog(afterPhaseId) {
        // Create modal container
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        
        const content = document.createElement('div');
        content.className = 'modal-content';
        
        const header = document.createElement('h3');
        header.textContent = afterPhaseId ? 'Add Phase After' : 'Add New Phase';
        
        const input = document.createElement('textarea');
        input.className = 'modal-input';
        input.placeholder = 'Describe the new phase...';
        input.rows = 4;
        
        const actions = document.createElement('div');
        actions.className = 'modal-actions';
        
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.className = 'modal-btn secondary';
        cancelBtn.onclick = () => modal.remove();
        
        const confirmBtn = document.createElement('button');
        confirmBtn.textContent = 'Generate Phase';
        confirmBtn.className = 'modal-btn primary';
        confirmBtn.onclick = () => {
          const prompt = input.value.trim();
          if (prompt) {
            safePostMessage({
              type: 'addPhase',
              payload: {
                conversationId: currentPhasePlan.conversationId,
                userPrompt: prompt,
                afterPhaseId: afterPhaseId
              }
            });
            modal.remove();
          }
        };
        
        actions.appendChild(cancelBtn);
        actions.appendChild(confirmBtn);
        
        content.appendChild(header);
        content.appendChild(input);
        content.appendChild(actions);
        modal.appendChild(content);
        
        document.body.appendChild(modal);
        input.focus();
      }

      function showEditPhaseDialog(phaseId, currentTitle, currentDescription) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        
        const content = document.createElement('div');
        content.className = 'modal-content';
        
        const header = document.createElement('h3');
        header.textContent = 'Edit Phase';
        
        const titleLabel = document.createElement('label');
        titleLabel.textContent = 'Title';
        titleLabel.style.display = 'block';
        titleLabel.style.marginBottom = '4px';
        titleLabel.style.fontSize = '12px';
        
        const titleInput = document.createElement('input');
        titleInput.className = 'modal-input';
        titleInput.type = 'text';
        titleInput.value = currentTitle;
        
        const descLabel = document.createElement('label');
        descLabel.textContent = 'Description';
        descLabel.style.display = 'block';
        descLabel.style.marginBottom = '4px';
        descLabel.style.fontSize = '12px';
        
        const descInput = document.createElement('textarea');
        descInput.className = 'modal-input';
        descInput.value = currentDescription;
        descInput.rows = 4;
        
        const actions = document.createElement('div');
        actions.className = 'modal-actions';
        
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.className = 'modal-btn secondary';
        cancelBtn.onclick = () => modal.remove();
        
        const actions = document.createElement('div');
        actions.className = 'modal-actions';
        
        const cancelBtn = document.createElement('button');
        cancelBtn.textContent = 'Cancel';
        cancelBtn.className = 'modal-btn secondary';
        cancelBtn.onclick = () => modal.remove();
        
        const confirmBtn = document.createElement('button');
        confirmBtn.textContent = 'Save Changes';
        confirmBtn.className = 'modal-btn primary';
        confirmBtn.onclick = () => {
          const newTitle = titleInput.value.trim();
          const newDesc = descInput.value.trim();
          
          if (newTitle && newDesc) {
            safePostMessage({
              type: 'editPhase',
              payload: {
                conversationId: currentPhasePlan.conversationId,
                phaseId: phaseId,
                updates: {
                  title: newTitle,
                  description: newDesc
                }
              }
            });
            modal.remove();
          }
        };
        
        actions.appendChild(cancelBtn);
        actions.appendChild(confirmBtn);
        
        content.appendChild(header);
        content.appendChild(titleLabel);
        content.appendChild(titleInput);
        content.appendChild(descLabel);
        content.appendChild(descInput);
        content.appendChild(actions);
        modal.appendChild(content);
        
        document.body.appendChild(modal);
        titleInput.focus();
      }

      /**
       * Format task for AI execution
       */
      function formatTaskForExecution(task, phaseTitle) {
        const BT = String.fromCharCode(96); // backtick
        let output = '## ' + (phaseTitle ? phaseTitle + ' - ' : '') + task.title + '\\n\\n';
        output += '**Goal**: ' + task.goal + '\\n\\n';
        
        if (task.files && task.files.length > 0) {
          output += '**Files to create/modify**:\\n';
          task.files.forEach(file => {
            output += '- ' + BT + file + BT + '\\n';
          });
          output += '\\n';
        }
        
        output += '**Instructions**:\\n';
        task.instructions.forEach((instruction, i) => {
          output += (i + 1) + '. ' + instruction + '\\n';
        });
        output += '\\n';
        
        output += '**When complete, verify**:\\n';
        task.acceptance_criteria.forEach(criteria => {
          output += '- ' + criteria + '\\n';
        });
        
        return output;
      }

      function handleScanGitProgress(dryRun) {
         showConfirmDialog(
             'Scan Git History',
             'This will scan your git history to update phase status. Continue?',
             'Scan',
             () => {
                 safePostMessage({ type: 'scanGitProgress', payload: { dryRun: dryRun } });
             }
         );
      }

      function handleRunAndAnalyze() {
         showConfirmDialog(
             'Run & Analyze',
             'This will execute the configured test command and analyze the output with AI. Continue?',
             'Run',
             () => {
                 safePostMessage({ type: 'runAndAnalyze', payload: {} });
             }
         );
      }

      function updateConversationState(state, metadata) {
        if (!state) {
          return;
        }

        conversationState = state;
        if (metadata) {
          conversationMetadata = metadata;
        }

        if (conversationStateBadge) {
          conversationStateBadge.className = getStateBadgeClass(state);
          // Assuming conversation-state-badge element exists in ChatViewProvider
          const icon = stateIconMap[state] || 'info';
          const label = stateLabelMap[state] || state;
          // Simple string update or innerHTML if structure allows
          // Using just text for compatibility based on observation
          conversationStateBadge.innerHTML = '<span class="codicon codicon-' + icon + '"></span> ' + label;
        }

        renderWorkflowButtons(state);
        
        // Request progress update if phases exist
        if (metadata && metadata.phaseCount > 0) {
            safePostMessage({ type: 'requestPhaseProgress' });
        }

        if (state === 'GENERATING_PHASES') {
          showPhaseGenerationIndicator();
        } else {
          hidePhaseGenerationIndicator();
        }

        setState();
      }

      function showPhaseGenerationIndicator() {
        if (phaseGenerationIndicator) {
          return;
        }

        phaseGenerationIndicator = document.createElement('div');
        phaseGenerationIndicator.className = 'phase-generating-indicator';
        phaseGenerationIndicator.innerHTML = '<span class="codicon codicon-loading spin"></span><span>Generating phase plan...</span>';
        phaseGenerationIndicator.style.padding = '12px';
        phaseGenerationIndicator.style.textAlign = 'center';
        phaseGenerationIndicator.style.color = 'var(--vscode-descriptionForeground)';
        
        messagesContainer.appendChild(phaseGenerationIndicator);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }

      function hidePhaseGenerationIndicator() {
        if (phaseGenerationIndicator) {
          phaseGenerationIndicator.remove();
          phaseGenerationIndicator = null;
        }
      }

      let copyFeedbackTimeout;

      function showCopyFeedback(container, message, isError = false) {
        if (!container) {
          return;
        }

        const feedback = container.querySelector('.phase-plan-feedback');
        if (!feedback) {
          return;
        }

        feedback.textContent = message;
        feedback.classList.toggle('error', isError);

        if (copyFeedbackTimeout) {
          clearTimeout(copyFeedbackTimeout);
        }

        copyFeedbackTimeout = setTimeout(() => {
          feedback.textContent = '';
          feedback.classList.remove('error');
        }, 2000);
      }

      function copyToClipboard(text, format, container) {
        if (!text) {
          showCopyFeedback(container, 'Nothing to copy', true);
          return;
        }

        const handleSuccess = () => {
          showCopyFeedback(container, format + ' copied!');
        };

        const handleFailure = () => {
          showCopyFeedback(container, 'Copy failed', true);
        };

        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(text).then(handleSuccess).catch(handleFailure);
          return;
        }

        try {
          const textarea = document.createElement('textarea');
          textarea.value = text;
          textarea.style.position = 'fixed';
          textarea.style.left = '-1000px';
          textarea.style.top = '0';
          document.body.appendChild(textarea);
          textarea.focus();
          textarea.select();
          const successful = document.execCommand('copy');
          document.body.removeChild(textarea);
          if (successful) {
            handleSuccess();
          } else {
            handleFailure();
          }
        } catch (error) {
          handleFailure();
        }
      }
      
      /**
       * socket for sending messages to backend, with queue support
       */
      function attemptSend(text) {
         const activeProvider = providers.find(p => p.id === activeProviderId);
         
         // If providers exist but active one is unavailable, queue the message
         if (providers.length > 0 && (!activeProvider || !activeProvider.available)) {
             if (!messageQueue) messageQueue = [];
             messageQueue.push(text);
             console.log('Message queued due to unavailable provider');
             return;
         }
         
         // Otherwise (available OR no providers configured), send immediately
         // Sending when no providers configured triggers the helpful fallback in ConversationManager
         safePostMessage({
           type: 'sendMessage',
           payload: { text: text }
         });
      }

      function processMessageQueue() {
          if (!messageQueue || messageQueue.length === 0) return;
          
          const activeProvider = providers.find(p => p.id === activeProviderId);
          if (activeProvider && activeProvider.available) {
              // Send all queued messages
              while (messageQueue.length > 0) {
                  const text = messageQueue.shift();
                  attemptSend(text);
              }
          }
      }

      /**
       * Sends a message to the extension
       */
      function sendMessage() {
        const text = messageInput.value.trim();
        if (!text) {
          return;
        }
        
        // Create user message
        const userMessage = {
          id: Date.now().toString(),
          role: 'user',
          text: text,
          timestamp: Date.now()
        };
        
        // Add to messages array
        messages.push(userMessage);
        
        // Render immediately for instant feedback
        renderMessage(userMessage);
        
        // Attempt to send (will queue if needed)
        attemptSend(text);
        
        // Clear input and refocus
        messageInput.value = '';
        messageInput.focus();
        
        // Update state
        setState();
      }
      
      /**
       * Clears all messages
       */
      function clearMessages() {
        messages = [];
        
        // Preserve onboarding wizard and empty state elements
        const children = Array.from(messagesContainer.children);
        children.forEach(child => {
          if (child.id !== 'onboarding-wizard' && child.id !== 'empty-state') {
            child.remove();
          }
        });

        removeExistingPhasePlan();
        if (emptyState) {
          emptyState.style.display = 'flex';
        }
        setState();
      }

      function updateProviderStatus(providerId, available) {
        if (!providerStatus) {
          return;
        }

        const provider = providers.find((p) => p.id === providerId);
        const providerName = provider ? provider.name : providerId;

        providerStatus.classList.remove('available', 'unavailable', 'checking');
        const iconClass = available ? 'codicon-check' : 'codicon-error';
        providerStatus.classList.add(available ? 'available' : 'unavailable');
        providerStatus.innerHTML = \`
          <span class="codicon \${iconClass}"></span>
          <span>\${available ? 'Available' : 'Unavailable'} · \${providerName}</span>
        \`;

        if (available) {
          hideOnboardingWizard();
          processMessageQueue();
        }
      }

      function updateProviderList(providerList, activeId) {
        providers = providerList;
        activeProviderId = activeId || activeProviderId;

        if (providerSelect) {
          providerSelect.innerHTML = '';
          providers.forEach((provider) => {
            const option = document.createElement('option');
            option.value = provider.id;
            option.textContent = provider.enabled ? provider.name : provider.name + ' (disabled)';
            option.disabled = !provider.enabled;
            if (provider.id === activeProviderId) {
              option.selected = true;
            }
            providerSelect.appendChild(option);
          });
        }

        const activeProvider = providers.find((provider) => provider.id === activeProviderId);
        const isAvailable = activeProvider ? activeProvider.available : false;
        updateProviderStatus(activeProviderId, !!isAvailable);
        
        if (isAvailable) {
          hideOnboardingWizard();
          processMessageQueue();
        }
        setState();
      }

      function formatModelSize(bytes) {
        if (!bytes) return '';
        const gb = bytes / (1024 * 1024 * 1024);
        if (gb >= 1) return gb.toFixed(1) + 'GB';
        const mb = bytes / (1024 * 1024);
        return mb.toFixed(0) + 'MB';
      }

      function updateModelList(modelList, currentModel, providerId) {
        models = modelList || [];
        activeModel = currentModel || activeModel;

        // Show/hide model selector based on provider
        if (modelSelectorContainer) {
          modelSelectorContainer.style.display = providerId === 'ollama' && models.length > 0 ? 'flex' : 'none';
        }

        if (modelSelect && models.length > 0) {
          modelSelect.innerHTML = '';
          models.forEach((model) => {
            const option = document.createElement('option');
            option.value = model.name;
            const size = formatModelSize(model.size);
            const running = model.isRunning ? ' 🟢' : '';
            option.textContent = model.name + (size ? ' (' + size + ')' : '') + running;
            if (model.name === activeModel) {
              option.selected = true;
            }
            modelSelect.appendChild(option);
          });
        }

        // Update model status
        if (modelStatus) {
          const currentModelInfo = models.find(m => m.name === activeModel);
          if (currentModelInfo && currentModelInfo.isRunning) {
             modelStatus.className = 'model-status running';
             modelStatus.innerHTML = '<span class="codicon codicon-play"></span><span>Running</span>';
          } else {
             modelStatus.className = 'model-status';
             modelStatus.innerHTML = '';
          }
        }

        setState();
      }

      /**
       * Message listener from extension
       */
      window.addEventListener('message', event => {
        const message = event.data;
        
        switch (message.type) {
          case 'assistantMessage':
            const assistantMessage = message.payload;
            messages.push(assistantMessage);
            renderMessage(assistantMessage);
            setState();
            break;
            
          case 'error':
            // Remove loading state from any verify buttons
            const loadingBtns = document.querySelectorAll('.verify-phase-btn.loading');
            if (loadingBtns) {
                loadingBtns.forEach(btn => btn.classList.remove('loading'));
            }
            
            // Render actionable error message
            renderErrorMessage(message.payload);
            setState();
            break;

          case 'phaseAdded':
            // Handle phase added message if needed (e.g. show toast)
            // The phasePlan message is usually sent after addPhase, handling re-render
            break;
            
          case 'phaseEdited':
             break;

          case 'phaseDeleted':
             break;
            
          case 'assistantsList':
            // This message is currently not handled, but kept for future use.
            // It would typically update a list of available assistants/agents.
            break;

          case 'noProvidersReady':
            showOnboardingWizard(message.payload.message, message.payload.allowSkip);
            break;
            
          case 'clearChat':
            clearMessages();
            break;

          case 'providerList':
            updateProviderList(message.payload.providers, message.payload.activeProviderId);
            break;

          case 'providerStatusUpdate':
            if (message.payload && typeof message.payload.available !== 'undefined') {
              updateProviderStatus(message.payload.providerId || activeProviderId, message.payload.available);
            }
            break;

          case 'providerChanged': {
            activeProviderId = message.payload.providerId;
            if (providerSelect) {
              providerSelect.value = activeProviderId;
            }
            providers = providers.map((p) =>
              p.id === activeProviderId
                ? {
                    ...p,
                    available: true,
                  }
                : p
            );
            const updatedProvider = providers.find((p) => p.id === activeProviderId);
            updateProviderStatus(activeProviderId, updatedProvider ? updatedProvider.available : true);
            
            // Check queue if provider became available
            if (updatedProvider && updatedProvider.available) {
                processMessageQueue();
            }
            
            setState();
            break;
          }

          case 'configurationStatus':
            if (!message.payload || !message.payload.validationResults) {
              break;
            }
            const updates = message.payload.validationResults;
            providers = providers.map((provider) => {
              const result = updates[provider.id];
              if (!result) {
                return provider;
              }
              return {
                ...provider,
                available: result.valid,
              };
            });
            const activeResult = updates[activeProviderId];
            if (activeResult) {
              updateProviderStatus(activeProviderId, activeResult.valid);
              if (activeResult.valid) {
                  processMessageQueue();
              }
            }
            setState();
            break;



          case 'phasePlan':
            if (!message.payload) {
              break;
            }
            renderPhasePlan(message.payload.plan, message.payload.formattedMarkdown);
            setState();
            break;

          case 'conversationState':
            updateConversationState(message.payload.state, message.payload.metadata);
            setState();
            break;

          case 'modelList':
            updateModelList(message.payload.models, message.payload.activeModel, message.payload.providerId);
            break;

          case 'modelChanged':
            activeModel = message.payload.modelName;
            if (modelSelect) {
              modelSelect.value = activeModel;
            }
            setState();
            break;

          case 'conversationList':
            renderConversationList(message.payload.conversations, message.payload.activeConversationId);
            break;

          case 'conversationLoaded':
            hideHistoryModal();
            setState();
            break;

          case 'conversationDeleted':
            // Request updated list
            safePostMessage({ type: 'requestConversationList', payload: {} });
            break;
            
          case 'phaseStatusUpdated':
            // Remove loading class if verify button exists
            const verifiedBtns = document.querySelectorAll('.verify-phase-btn.loading[data-phase-id="' + message.payload.phaseId + '"]');
            verifiedBtns.forEach(btn => btn.classList.remove('loading'));
            break;

          case 'phaseProgress':
            if (typeof updatePhaseDashboard === 'function') {
                updatePhaseDashboard(
                    message.payload.completed, 
                    message.payload.verified, 
                    message.payload.total
                );
            }
            break;

            if (typeof renderNextActionSuggestions === 'function') {
                renderNextActionSuggestions(message.payload.suggestions);
            }
            break;

          case 'workspaceAnalyzed':
            renderWorkspaceAnalysis(message.context);
            break;


          case 'runAnalysisComplete':
            const runResult = message.payload;
            const runDiv = document.createElement('div');
            runDiv.className = 'message system run-analysis-result';
            
            let runHtml = '<div class="analysis-header ' + (runResult.success ? 'success' : 'failure') + '">';
            runHtml += '<span class="codicon ' + (runResult.success ? 'codicon-pass' : 'codicon-error') + '"></span>';
            runHtml += '<strong>Command Executed:</strong> <code>' + runResult.command + '</code>';
            runHtml += '<span class="duration">(' + runResult.duration + 'ms)</span>';
            runHtml += '</div>';
            
            if (runResult.analysis) {
                 runHtml += '<div class="analysis-summary">';
                 runHtml += '<strong>AI Analysis:</strong><p>' + runResult.analysis.summary + '</p>';
                 runHtml += '</div>';
                 
                 if (runResult.analysis.affectedPhases && runResult.analysis.affectedPhases.length > 0) {
                     runHtml += '<div class="affected-phases">';
                     runHtml += '<strong>Affected Phases:</strong><ul>';
                     runResult.analysis.affectedPhases.forEach(p => {
                         const statusIcon = p.status === 'passed' ? '✅' : p.status === 'failed' ? '❌' : '⚠️';
                         runHtml += '<li>' + statusIcon + ' Phase ' + p.phaseId + ': ' + p.reason + '</li>';
                     });
                     runHtml += '</ul></div>';
                 }
                 
                 if (runResult.analysis.suggestions && runResult.analysis.suggestions.length > 0) {
                     runHtml += '<div class="analysis-suggestions">';
                     runHtml += '<strong>Suggestions:</strong><ul>';
                     runResult.analysis.suggestions.forEach(s => {
                         runHtml += '<li>' + s + '</li>';
                     });
                     runHtml += '</ul></div>';
                 }
            }
            
            runHtml += '<details class="output-details"><summary>Show Output</summary>';
            if (runResult.stdout) {
                runHtml += '<div class="output-block stdout"><strong>Stdout:</strong><pre>' + runResult.stdout.replace(/</g, '&lt;') + '</pre></div>';
            }
            if (runResult.stderr) {
                runHtml += '<div class="output-block stderr"><strong>Stderr:</strong><pre>' + runResult.stderr.replace(/</g, '&lt;') + '</pre></div>';
            }
            runHtml += '</details>';
            
            runDiv.innerHTML = runHtml;
            messagesContainer.appendChild(runDiv);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
            break;

          case 'gitScanComplete':
            const { updated, results } = message.payload;
            // Show notification
            const notification = document.createElement('div');
            notification.className = 'message system git-scan-result';
            
            let resultHtml = '<strong>Git Scan Complete 🔍</strong><br/>';
            resultHtml += 'Updated ' + updated + ' phase(s) based on ' + results.length + ' matched commit(s).<br/>';
            
            if (results.length > 0) {
                 resultHtml += '<ul style="margin: 8px 0; padding-left: 20px;">';
                 results.forEach(r => {
                     resultHtml += '<li>Phase: ' + r.phaseId + ' (' + r.matchedCommits.length + ' commits, confidence: ' + Math.round(r.confidence * 100) + '%)</li>';
                 });
                 resultHtml += '</ul>';
            }
            
            notification.innerHTML = resultHtml;
            messagesContainer.appendChild(notification);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
            
            // Re-enable button
            const scanBtn = document.querySelector('.scan-git-btn');
            if (scanBtn) {
              scanBtn.disabled = false;
              scanBtn.innerHTML = '<span class="codicon codicon-git-commit"></span> Scan Git Progress';
            }
            break;
        }
      });

      // History modal state
      let historyModalVisible = false;
      let conversationListData = [];

      function showHistoryModal() {
        historyModalVisible = true;
        const modal = document.getElementById('history-modal');
        if (modal) {
          modal.style.display = 'flex';
        }
        // Request conversation list
        safePostMessage({ type: 'requestConversationList', payload: {} });
      }

      function hideHistoryModal() {
        historyModalVisible = false;
        const modal = document.getElementById('history-modal');
        if (modal) {
          modal.style.display = 'none';
        }
      }

      function renderConversationList(conversations, activeConversationId) {
        conversationListData = conversations || [];
        const listContainer = document.getElementById('conversation-list');
        if (!listContainer) {
          return;
        }

        listContainer.innerHTML = '';

        if (conversationListData.length === 0) {
          const emptyDiv = document.createElement('div');
          emptyDiv.className = 'history-empty';
          emptyDiv.innerHTML = '\u003cspan class="codicon codicon-inbox"\u003e\u003c/span\u003e\u003cp\u003eNo conversations yet\u003c/p\u003e';
          listContainer.appendChild(emptyDiv);
          
          if (historyBtn) {
            historyBtn.removeAttribute('data-count');
          }
          return;
        }
        
        if (historyBtn) {
            historyBtn.setAttribute('data-count', conversationListData.length.toString());
        }

        conversationListData.forEach((conv) => {
          const item = document.createElement('div');
          item.className = 'conversation-item' + (conv.id === activeConversationId ? ' active' : '');
          item.dataset.conversationId = conv.id;

          const info = document.createElement('div');
          info.className = 'conversation-info';

          const title = document.createElement('div');
          title.className = 'conversation-title';
          title.textContent = conv.title || 'Untitled';

          const meta = document.createElement('div');
          meta.className = 'conversation-meta';
          const date = new Date(conv.updatedAt);
          const dateStr = date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
          meta.textContent = dateStr + (conv.phaseCount ? ' · ' + conv.phaseCount + ' phases' : '');

          info.appendChild(title);
          info.appendChild(meta);

          const actions = document.createElement('div');
          actions.className = 'conversation-actions';

          const loadBtn = document.createElement('button');
          loadBtn.className = 'conversation-action-btn';
          loadBtn.title = 'Load';
          loadBtn.innerHTML = '\u003cspan class="codicon codicon-folder-opened"\u003e\u003c/span\u003e';
          loadBtn.onclick = (e) => {
            try {
              e.stopPropagation();
              safePostMessage({ type: 'loadConversation', payload: { conversationId: conv.id } });
            } catch (error) {
              console.error('Load button failed:', error);
            }
          };

          const renameBtn = document.createElement('button');
          renameBtn.className = 'conversation-action-btn';
          renameBtn.title = 'Rename';
          renameBtn.innerHTML = '\u003cspan class="codicon codicon-edit"\u003e\u003c/span\u003e';
          renameBtn.onclick = (e) => {
            try {
              e.stopPropagation();
              const newTitle = prompt('Enter new title:', conv.title);
              if (newTitle && newTitle.trim()) {
                safePostMessage({ type: 'renameConversation', payload: { conversationId: conv.id, newTitle: newTitle.trim() } });
              }
            } catch (error) {
              console.error('Rename button failed:', error);
            }
          };

          const exportBtn = document.createElement('button');
          exportBtn.className = 'conversation-action-btn';
          exportBtn.title = 'Export';
          exportBtn.innerHTML = '\u003cspan class="codicon codicon-export"\u003e\u003c/span\u003e';
          exportBtn.onclick = (e) => {
            try {
              e.stopPropagation();
              const format = confirm('Export as JSON? (Cancel for Markdown)') ? 'json' : 'markdown';
              safePostMessage({ type: 'exportConversationToFile', payload: { conversationId: conv.id, format } });
            } catch (error) {
              console.error('Export button failed:', error);
            }
          };

          const deleteBtn = document.createElement('button');
          deleteBtn.className = 'conversation-action-btn danger';
          deleteBtn.title = 'Delete';
          deleteBtn.innerHTML = '\u003cspan class="codicon codicon-trash"\u003e\u003c/span\u003e';
          deleteBtn.onclick = (e) => {
            try {
              e.stopPropagation();
              showConfirmDialog('Delete Conversation', 'Are you sure you want to delete this conversation?', 'Delete', () => {
                  safePostMessage({ type: 'deleteConversation', payload: { conversationId: conv.id } });
              });
            } catch (error) {
              console.error('Delete button failed:', error);
            }
          };

          actions.appendChild(loadBtn);
          actions.appendChild(renameBtn);
          actions.appendChild(exportBtn);
          actions.appendChild(deleteBtn);

          item.appendChild(info);
          item.appendChild(actions);

          listContainer.appendChild(item);
        });
      }

      // History modal event handlers
      const historyModal = document.getElementById('history-modal');
      const historyCloseBtn = document.getElementById('history-close-btn');

      if (historyModal) {
        historyModal.addEventListener('click', (e) => {
          if (e.target === historyModal) {
            hideHistoryModal();
          }
        });
      }

      if (historyCloseBtn) {
        historyCloseBtn.addEventListener('click', () => {
          hideHistoryModal();
        });
      }



      messagesContainer.addEventListener('click', (event) => {
        try {
          const target = event.target.closest('button.phase-plan-action-button');
          if (!target) {
            return;
          }

          const action = target.dataset.action;
          const phasePlanContainer = target.closest('.phase-plan-message');
          
          if (action === 'copy-markdown') {
            copyToClipboard(currentPhaseMarkdown, 'Markdown', phasePlanContainer);
          } else if (action === 'export-markdown') {
            safePostMessage({
              type: 'exportPhasePlanToFile',
              payload: {
                conversationId: currentPhasePlan ? currentPhasePlan.conversationId : undefined,
                format: 'markdown'
              },
            });
          } else if (action === 'export-json') {
            safePostMessage({
               type: 'exportPhasePlanToFile',
               payload: {
                 conversationId: currentPhasePlan ? currentPhasePlan.conversationId : undefined,
                 format: 'json'
               },
             });
          } else if (action === 'copy-json') {
            const json = currentPhasePlan ? JSON.stringify(currentPhasePlan, null, 2) : '';
            copyToClipboard(json, 'JSON', phasePlanContainer);
          } else if (action === 'regenerate') {
            safePostMessage({
              type: 'regeneratePhasePlan',
              payload: {
                conversationId: currentPhasePlan ? currentPhasePlan.conversationId : undefined,
              },
            });
            showPhaseGenerationIndicator();
          }
        } catch (error) {
          console.error('Phase plan action handler failed:', error);
        }
      });

      // Phase and Task action handlers
      // Phase and Task action handlers
      messagesContainer.addEventListener('click', (e) => {
        try {
          // Verify Phase Button
          const verifyBtn = e.target.closest('.verify-phase-btn');
          if (verifyBtn) {
            const phaseId = verifyBtn.dataset.phaseId;
            if (phaseId && !verifyBtn.classList.contains('loading')) {
              verifyBtn.classList.add('loading');
              safePostMessage({
                type: 'verifyPhase',
                payload: {
                  phaseId,
                  conversationId: currentPhasePlan ? currentPhasePlan.conversationId : undefined
                }
              });
            }
            return;
          }

          // Task Status Badge (Toggle status)
          const taskBadge = e.target.closest('.task-status-badge');
          if (taskBadge) {
            // ... (existing logic)

            const taskId = taskBadge.dataset.taskId;
            const phaseId = taskBadge.dataset.phaseId;
            const currentStatus = taskBadge.classList.contains('status-completed') ? 'completed' : 
                                 taskBadge.classList.contains('status-in-progress') ? 'in-progress' : 'pending';
            
            let newStatus = 'pending';
            if (currentStatus === 'pending') newStatus = 'in-progress';
            else if (currentStatus === 'in-progress') newStatus = 'completed';
            else if (currentStatus === 'completed') newStatus = 'pending'; // Cycle back to pending

            if (taskId && phaseId) {
              safePostMessage({
                type: 'updateTaskStatus',
                payload: {
                  taskId,
                  phaseId,
                  status: newStatus,
                  conversationId: currentPhasePlan ? currentPhasePlan.conversationId : undefined
                }
              });
            }
            return;
          }
        } catch (error) {
          console.error('Task interaction handler failed:', error);
        }
      });

      // Task execute button handlers
      // Task execute button handlers
      messagesContainer.addEventListener('click', (e) => {
        try {
          const target = e.target.closest('.execute-btn');
          if (target) {
            // Toggle dropdown menu
            const dropdown = target.closest('.execute-dropdown');
            if (dropdown) {
              dropdown.classList.toggle('open');
              e.stopPropagation();
            }
            return;
          }

          const option = e.target.closest('.execute-option');
          if (!option) {
            return;
          }

          const action = option.dataset.action;
          const taskItem = option.closest('.task-item');
          if (!taskItem || !taskItem.dataset.taskData) {
            return;
          }

          const task = JSON.parse(taskItem.dataset.taskData);
          const phaseTitle = taskItem.dataset.phaseTitle;

          if (action === 'copy') {
            const formattedTask = formatTaskForExecution(task, phaseTitle);
            copyToClipboard(formattedTask.replace(/\\n/g, '\n'), 'Task', taskItem);
          } else if (['roo-code', 'windsurf', 'aider', 'cursor', 'continue'].includes(action)) {
            safePostMessage({
              type: 'handoffTaskToTool',
              payload: { task, phaseTitle, toolName: action }
            });
          } else if (action === 'gemini-cli') {
            safePostMessage({
              type: 'executeTaskInGeminiCLI',
              payload: { task, phaseTitle }
            });
          }

          const dropdown = option.closest('.execute-dropdown');
          if (dropdown) {
            dropdown.classList.remove('open');
          }
        } catch (error) {
          console.error('Task execution handler failed:', error);
        }
      });

      // Global handoff dropdown toggle
      messagesContainer.addEventListener('click', (e) => {
        try {
          const handoffBtn = e.target.closest('.global-handoff-btn');
          if (handoffBtn) {
            const dropdown = handoffBtn.closest('.global-handoff-dropdown');
            if (dropdown) {
              dropdown.classList.toggle('open');
              e.stopPropagation();
            }
            return;
          }

          const handoffOption = e.target.closest('.handoff-option');
          if (handoffOption) {
            const toolName = handoffOption.dataset.tool;
            safePostMessage({
              type: 'handoffPlanToTool',
              payload: {
                conversationId: currentPhasePlan ? currentPhasePlan.conversationId : undefined,
                toolName
              }
            });
            
            const dropdown = handoffOption.closest('.global-handoff-dropdown');
            if (dropdown) {
              dropdown.classList.remove('open');
            }
          }
        } catch (error) {
          console.error('Handoff handler failed:', error);
        }
      });

      // Close dropdowns when clicking elsewhere
      document.addEventListener('click', (e) => {
        try {
          if (!e.target.closest('.execute-dropdown')) {
            document.querySelectorAll('.execute-dropdown.open').forEach(d => d.classList.remove('open'));
          }
          if (!e.target.closest('.global-handoff-dropdown')) {
            document.querySelectorAll('.global-handoff-dropdown.open').forEach(d => d.classList.remove('open'));
          }
        } catch (error) {
          console.error('Dropdown closer failed:', error);
        }
      });

      // Event listeners
      sendButton.addEventListener('click', () => {
        try {
          sendMessage();
        } catch (error) {
          console.error('Send button failed:', error);
        }
      });
      
      // Error Action Buttons (delegated)
      messagesContainer.addEventListener('click', (e) => {
        const actionBtn = e.target.closest('.error-action-btn');
        if (!actionBtn) return;
        
        const action = actionBtn.dataset.action;
        const providerId = actionBtn.dataset.providerId;
        
        switch (action) {
          case 'retry':
            safePostMessage({ type: 'retryLastRequest' });
            break;
            
          case 'switchProvider':
            if (providerId) {
               safePostMessage({ type: 'switchProviderAndRetry', payload: { providerId } });
            }
            break;
            
          case 'refreshModels':
             safePostMessage({ type: 'refreshModels', payload: { providerId } });
             break;
             
          case 'openSettings':
             safePostMessage({ type: 'openSettings' });
             break;
        }
      });

      if (providerSelect) {
        providerSelect.addEventListener('change', (event) => {
          try {
            const selectedProviderId = event.target.value;
            if (!selectedProviderId || selectedProviderId === activeProviderId) {
              return;
            }
            safePostMessage({
              type: 'selectProvider',
              payload: { providerId: selectedProviderId }
            });
          } catch (error) {
            console.error('Provider select failed:', error);
          }
        });
      }

      if (settingsButton) {
        settingsButton.addEventListener('click', () => {
          try {
            safePostMessage({
              type: 'openSettings',
              payload: { settingId: 'junkrat.' + activeProviderId }
            });
          } catch (error) {
            console.error('Settings button failed:', error);
          }
        });
      }

      const emptyStateConfigBtn = document.getElementById('empty-state-config-btn');
      if (emptyStateConfigBtn) {
        emptyStateConfigBtn.addEventListener('click', () => {
          try {
            safePostMessage({ 
              type: 'openSettings', 
              payload: { settingId: 'junkrat.activeProvider' } 
            });
          } catch (error) {
            console.error('Empty state config button failed:', error);
          }
        });
      }

      if (modelSelect) {
        modelSelect.addEventListener('change', (event) => {
          try {
            const selectedModel = event.target.value;
            if (!selectedModel || selectedModel === activeModel) {
              return;
            }
            safePostMessage({
              type: 'selectModel',
              payload: { modelName: selectedModel }
            });
          } catch (error) {
            console.error('Model select failed:', error);
          }
        });
      }

      // Header button event listeners
      if (newChatBtn) {
        newChatBtn.addEventListener('click', () => {
          try {
            safePostMessage({ type: 'newChat', payload: {} });
          } catch (error) {
            console.error('New Chat button failed:', error);
          }
        });
      }

      if (historyBtn) {
        historyBtn.addEventListener('click', () => {
          try {
            showHistoryModal();
          } catch (error) {
             console.error('History button failed:', error);
          }
        });
      }

      if (clearChatBtn) {
        clearChatBtn.addEventListener('click', () => {
          try {
             showConfirmDialog('Clear Chat', 'Are you sure you want to clear all messages?', 'Clear All', () => {
                  clearMessages();
                  safePostMessage({ type: 'clearChat', payload: {} });
             });
          } catch (error) {
            console.error('Clear chat button failed:', error);
          }
        });
      }
      
      messageInput.addEventListener('keypress', (e) => {
        try {
          if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            sendMessage();
          }
        } catch (error) {
          console.error('Message input keypress failed:', error);
        }
      });
      
      messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && e.shiftKey) {
          // Allow Shift+Enter for newlines (default behavior)
        }
      });
      
      // Auto-resize textarea
      messageInput.addEventListener('input', () => {
        messageInput.style.height = 'auto';
        messageInput.style.height = Math.min(messageInput.scrollHeight, 120) + 'px';
      });
      
      // Initialization
      // Render any persisted messages
      if (messages.length > 0) {
        messages.forEach(renderMessage);
      }

      if (currentPhasePlan && currentPhaseMarkdown) {
        renderPhasePlan(currentPhasePlan, currentPhaseMarkdown);
      }

      if (conversationState) {
        updateConversationState(conversationState, conversationMetadata);
      }

      // Focus input field
      messageInput.focus();

      // Task Status Badge Handler - handled in click delegation above
      
      // Handle Scan Git Progress button (delegation)
      messagesContainer.addEventListener('click', (e) => {
         // This delegation is for messages container. But the button is in the dashboard which is in header?
         // No, dashboard is in chat-header.
      });

      // We need listener for dashboard button. Dashboard is NOT in messagesContainer.
      // It is in chat-header.
      const dashboard = document.getElementById('phase-dashboard');
      if (dashboard) {
          dashboard.addEventListener('click', (e) => {
            try {
              const target = e.target;
              if (target.closest('.scan-git-btn')) {
                const btn = target.closest('.scan-git-btn');
                btn.disabled = true;
                btn.innerHTML = '<span class="codicon codicon-loading codicon-modifier-spin"></span> Scanning...';
                safePostMessage({ type: 'scanGitProgress', payload: { dryRun: false } });
                e.preventDefault();
                return;
              }
            } catch (error) {
              console.error('Dashboard click handler failed:', error);
            }
          });
      }

      // Send ready message to extension
      safePostMessage({ type: 'ready' });
      safePostMessage({ type: 'requestProviderList' });
      safePostMessage({ type: 'requestConfigurationStatus' });
      safePostMessage({ type: 'requestModelList' });

      if (providers.length > 0) {
        updateProviderList(providers, activeProviderId);
      }

      // Global Keyboard Shortcuts
      document.addEventListener('keydown', (e) => {
        try {
          if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
               if (document.activeElement === messageInput) {
                    sendMessage();
               }
          }
          // New Chat: Ctrl+Shift+N
          if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'n' || e.key === 'N')) {
               e.preventDefault();
               safePostMessage({ type: 'newChat', payload: {} });
          }
          // History: Ctrl+Shift+H
          if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'h' || e.key === 'H')) {
              e.preventDefault();
              showHistoryModal();
          }
          // Clear Chat: Ctrl+Shift+K
          if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === 'k' || e.key === 'K')) {
              e.preventDefault();
              showConfirmDialog('Clear Chat', 'Are you sure you want to clear all messages?', 'Clear All', () => {
                   clearMessages();
                   safePostMessage({ type: 'clearChat', payload: {} });
              });
          }
        } catch (error) {
          console.error('Global keyboard shortcut handler failed:', error);
        }
        } catch (error) {
          console.error('Global keyboard shortcut handler failed:', error);
        }
      });

      // Escape key to dismiss wizard
      document.addEventListener('keydown', (e) => {
          if (e.key === 'Escape' && onboardingWizard && onboardingWizard.style.display !== 'none') {
              hideOnboardingWizard();
              if (messageInput) {
                  messageInput.focus();
              }
          }
      });

      // Export All Button Listener
      const exportAllBtn = document.getElementById('export-all-btn');
      if (exportAllBtn) {
          exportAllBtn.addEventListener('click', (e) => {
            try {
               e.stopPropagation();
               const format = confirm('Export all conversations as JSON? (Cancel for Markdown)') ? 'json' : 'markdown';
               safePostMessage({ type: 'exportAllConversations', payload: { format } });
            } catch (error) {
              console.error('Export all button failed:', error);
            }
          });
      }

      function updatePhaseDashboard(completed, verified, total) {
        const dashboard = document.getElementById('phase-dashboard');
        if (!dashboard) return;
        
        const hasPhases = total > 0;
        dashboard.style.display = hasPhases ? 'flex' : 'none';
        
        // Update Donut Chart
        const chartPath = dashboard.querySelector('.dashboard-chart-fill');
        if (chartPath) {
          // Calculate percentage based on verified phases for progress? 
          // Plan says: "Phase Progress Dashboard... Visual representation of completed phases".
          // "Update progress bar: completed / total".
          // But dashboard stats say "X/Y Verified".
          // I will use verified count for the chart as strictly completing without verifying is partial.
          // Or use completed count. I'll use verified count as it's the stricter metric.
          const percentage = total > 0 ? (verified / total) * 100 : 0;
          chartPath.setAttribute('stroke-dasharray', percentage + ', 100');
        }
        
        // Update Stats
        const statsVerified = document.getElementById('dashboard-stats-verified');
        if (statsVerified) {
           statsVerified.textContent = verified + '/' + total + ' Verified';
        }

        const actionsDiv = dashboard.querySelector('.dashboard-actions');
        if (actionsDiv && hasPhases) {
          // Only add if not already there
          if (!actionsDiv.querySelector('.scan-git-btn')) {
                  actionsDiv.innerHTML = \`<button class="dashboard-btn scan-git-btn" title="Scan git commits to auto-update phase progress"><span class="codicon codicon-git-commit"></span> Scan Git Progress</button>\`;
          }
        }
      }

function renderNextActionSuggestions(suggestions) {
  let container = document.getElementById('next-action-suggestions');
  if (!container) {
    container = document.createElement('div');
    container.id = 'next-action-suggestions';
    container.className = 'next-action-suggestions';
    // Append to messages container or after it?
    // "Append to messages container after phase plan"
    // messagesContainer contains messages.
    // If I append it to messagesContainer, it's just another element.
    messagesContainer.appendChild(container);
  }

  container.innerHTML = '';
  if (!suggestions || suggestions.length === 0) {
    container.style.display = 'none';
    return;
  }
  container.style.display = 'block';

  const title = document.createElement('div');
  title.className = 'suggestions-title';
  title.innerHTML = '<span class="codicon codicon-sparkle"></span> Suggested Next Actions';
  container.appendChild(title);

  const list = document.createElement('ul');
  list.className = 'suggestions-list';
  suggestions.forEach(s => {
    const li = document.createElement('li');
    li.textContent = s;
    list.appendChild(li);
  });
  container.appendChild(list);

  messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

function renderWorkspaceAnalysis(payload) {
  const analysisDiv = document.createElement('div');
  analysisDiv.className = 'message system workspace-analysis';
  
  let html = '<strong>Workspace Analyzed 📊</strong><br/><br/>';
  html += \`Files: \${payload.fileCount}<br/>\`;
  
  if (payload.technologies && payload.technologies.length > 0) {
    html += \`Tech Stack: \${payload.technologies.join(', ')}<br/>\`;
  }
  
  if (payload.gitBranch) {
    html += \`Branch: \${payload.gitBranch}<br/>\`;
  }
  
  analysisDiv.innerHTML = html;
  messagesContainer.appendChild(analysisDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;
  
  // Add to local state/history if needed
  messages.push({
    id: Date.now().toString(),
    role: 'system',
    text: 'Workspace analysis completed.',
    timestamp: Date.now()
  });
}

      /* --- Onboarding Wizard Functions --- */

      function showOnboardingWizard(customMessage, allowSkip) {
        if (onboardingWizard) {
          onboardingWizard.style.display = 'flex';
          
          // Update message if provided
          if (customMessage) {
            const messageEl = onboardingWizard.querySelector('.onboarding-message');
            if (messageEl) {
              messageEl.textContent = customMessage;
            }
          }
          
          // Show/hide skip button based on allowSkip flag
          const skipBtn = onboardingWizard.querySelector('.onboarding-skip-btn');
          if (skipBtn) {
            skipBtn.style.display = allowSkip ? 'block' : 'none';
          }
        }
        if (emptyState) {
          emptyState.style.display = 'none';
        }
      }

      function hideOnboardingWizard() {
        if (onboardingWizard) {
          onboardingWizard.style.display = 'none';
        }
        // Show empty state if no messages
        if (messages.length === 0 && emptyState) {
            emptyState.style.display = 'flex';
        }
        // Ensure input is enabled
        if (messageInput) {
            messageInput.disabled = false;
        }
      }

      // Add event listeners for Onboarding
      document.addEventListener('click', (e) => {
        try {
          const target = e.target;
          if (!target) return;
          
          // Handle onboarding buttons (delegation)
          const btn = target.closest('.onboarding-btn, .onboarding-refresh, .onboarding-skip-btn');
          if (btn) {
              const action = btn.dataset.action;
              
              // Log the action to extension
              console.log('Onboarding: ' + action + ' clicked');
              safePostMessage({ 
                type: 'onboardingAction', 
                payload: { 
                  action: action, 
                  timestamp: Date.now(),
                  context: { buttonLabel: btn.innerText }
                } 
              });

              if (action === 'install-ollama') {
                  safePostMessage({ 
                      type: 'openExternalLink', 
                      payload: { url: 'https://ollama.com' } 
                  });
              } else if (action === 'test-ollama') {
                  safePostMessage({ type: 'testOllamaConnection' });
              } else if (action === 'config-gemini') {
                  safePostMessage({ 
                      type: 'openSettings', 
                      payload: { settingId: 'junkrat.gemini.apiKey' } 
                  });
              } else if (action === 'config-other') {
                  safePostMessage({ 
                      type: 'openSettings', 
                      payload: { settingId: 'activeProvider' } 
                  });
              } else if (action === 'refresh-status') {
                  safePostMessage({ type: 'requestProviderList' });
                  // Also trigger a manual check via testOllamaConnection concept or just provider list
                  // Provider list refresh triggers nothing if status unchanged in backend, 
                  // but checking connection explicitly is better.
                  safePostMessage({ type: 'testOllamaConnection' }); 
              } else if (action === 'skip-onboarding') {
                  hideOnboardingWizard();
                  if (messageInput) {
                      messageInput.disabled = false;
                      messageInput.focus();
                  }
                  
                  // Add visual feedback
                  const skipMessage = {
                      id: Date.now().toString(),
                      role: 'system',
                      text: '💡 Tip: You can configure AI providers anytime from the settings to unlock full functionality.',
                      timestamp: Date.now()
                  };
                  messages.push(skipMessage);
                  renderMessage(skipMessage);
                  
                  // Persist that we've seen onboarding? 
                  // Ideally extension should know, but for now this is session based or until reload.
              }
          }
        } catch (error) {
          console.error('Onboarding click handler failed:', error);
        }
      });

      // Global error handler
      window.onerror = function(message, source, lineno, colno, error) {
        console.error('Webview error:', { message, source, lineno, colno, error });
        try {
          vscode.postMessage({
            type: 'webviewError',
            payload: {
              message: message,
              source: source,
              line: lineno,
              column: colno,
              stack: error ? error.stack : null
            }
          });
        } catch (e) {
          console.error('Failed to report error to extension:', e);
        }
        return false;
      };

      window.addEventListener('unhandledrejection', function(event) {
        console.error('Unhandled promise rejection:', event.reason);
        try {
          vscode.postMessage({
            type: 'webviewError',
            payload: {
              message: 'Unhandled Promise Rejection: ' + (event.reason?.message || event.reason),
              stack: event.reason?.stack || null
            }
          });
        } catch (e) {
          console.error('Failed to report promise rejection to extension:', e);
        }
      });

    }) ();
  `;
}
