/**
 * Returns JavaScript code for the chat webview
 */
export function getChatScript(): string {
  return `
    (function() {
      const vscode = acquireVsCodeApi();
      
      // State management
      let messages = [];
      let providers = [];
      let models = [];
      let activeProviderId = 'ollama';
      let activeModel = 'llama3';
      let conversationState = 'IDLE';
      let conversationMetadata = null;
      let currentPhasePlan = null;
      let currentPhaseMarkdown = '';
      
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
      const historyBtn = document.getElementById('history-btn');
      const clearChatBtn = document.getElementById('clear-chat-btn');
      const providerSelect = document.getElementById('provider-select');
      const providerStatus = document.getElementById('provider-status');
      const settingsButton = document.getElementById('provider-settings-button');
      const conversationStateBadge = document.getElementById('conversation-state-badge');
      const modelSelectorContainer = document.getElementById('model-selector-container');
      const modelSelect = document.getElementById('model-select');
      const modelStatus = document.getElementById('model-status');

      let phaseGenerationIndicator = null;

      function setState() {
        vscode.setState({
          messages,
          providers,
          activeProviderId,
          conversationState,
          conversationMetadata,
          currentPhasePlan,
          currentPhaseMarkdown,
        });
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
        return 'conversation-state-badge conversation-state-' + state.toLowerCase();
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
                    vscode.postMessage({ type: 'triggerPhaseGeneration' });
                }
            });
        } else if (state === 'COMPLETE') {
            buttons.push({
                text: 'Regenerate Plan 🔄',
                icon: 'sync',
                className: 'secondary',
                onClick: () => {
                     showConfirmDialog('Regenerate Plan', 'This will overwrite the current plan. Continue?', 'Regenerate', () => {
                        vscode.postMessage({ type: 'regeneratePhasePlan', payload: { conversationId: currentPhasePlan ? currentPhasePlan.conversationId : undefined } });
                     });
                }
            });
            buttons.push({
                text: 'Verify All Phases ✅',
                icon: 'check-all',
                className: 'primary',
                onClick: () => {
                    vscode.postMessage({ type: 'verifyAllPhases' });
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
                   vscode.postMessage({
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
            vscode.postMessage({
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
            vscode.postMessage({
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
            vscode.postMessage({ type: 'requestPhaseProgress' });
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
        
        // Send to extension
        vscode.postMessage({
          type: 'sendMessage',
          payload: { text: text }
        });
        
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
        messagesContainer.innerHTML = '';
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
            showOnboardingWizard();
            break;
            
          case 'clearChat':
            clearMessages();
            break;

          case 'providerList':
            updateProviderList(message.payload.providers, message.payload.activeProviderId);
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
            vscode.postMessage({ type: 'requestConversationList', payload: {} });
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

          case 'nextActionSuggestions':
            if (typeof renderNextActionSuggestions === 'function') {
                renderNextActionSuggestions(message.payload.suggestions);
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
        vscode.postMessage({ type: 'requestConversationList', payload: {} });
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
          return;
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
            e.stopPropagation();
            vscode.postMessage({ type: 'loadConversation', payload: { conversationId: conv.id } });
          };

          const renameBtn = document.createElement('button');
          renameBtn.className = 'conversation-action-btn';
          renameBtn.title = 'Rename';
          renameBtn.innerHTML = '\u003cspan class="codicon codicon-edit"\u003e\u003c/span\u003e';
          renameBtn.onclick = (e) => {
            e.stopPropagation();
            const newTitle = prompt('Enter new title:', conv.title);
            if (newTitle && newTitle.trim()) {
              vscode.postMessage({ type: 'renameConversation', payload: { conversationId: conv.id, newTitle: newTitle.trim() } });
            }
          };

          const exportBtn = document.createElement('button');
          exportBtn.className = 'conversation-action-btn';
          exportBtn.title = 'Export';
          exportBtn.innerHTML = '\u003cspan class="codicon codicon-export"\u003e\u003c/span\u003e';
          exportBtn.onclick = (e) => {
            e.stopPropagation();
            const format = confirm('Export as JSON? (Cancel for Markdown)') ? 'json' : 'markdown';
            vscode.postMessage({ type: 'exportConversationToFile', payload: { conversationId: conv.id, format } });
          };

          const deleteBtn = document.createElement('button');
          deleteBtn.className = 'conversation-action-btn danger';
          deleteBtn.title = 'Delete';
          deleteBtn.innerHTML = '\u003cspan class="codicon codicon-trash"\u003e\u003c/span\u003e';
          deleteBtn.onclick = (e) => {
            e.stopPropagation();
            showConfirmDialog('Delete Conversation', 'Are you sure you want to delete this conversation?', 'Delete', () => {
                vscode.postMessage({ type: 'deleteConversation', payload: { conversationId: conv.id } });
            });
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

      if (historyBtn) {
        historyBtn.addEventListener('click', () => {
          showHistoryModal();
        });
      }

      messagesContainer.addEventListener('click', (event) => {
        const target = event.target.closest('button.phase-plan-action-button');
        if (!target) {
          return;
        }

        const action = target.dataset.action;
        const phasePlanContainer = target.closest('.phase-plan-message');
        
        // Don't handle if inside a dropdown (which also uses phase-plan-action-button class sometimes? no, different classes)

        if (action === 'copy-markdown') {
          copyToClipboard(currentPhaseMarkdown, 'Markdown', phasePlanContainer);
        } else if (action === 'export-markdown') {
          vscode.postMessage({
            type: 'exportPhasePlanToFile',
            payload: {
              conversationId: currentPhasePlan ? currentPhasePlan.conversationId : undefined,
              format: 'markdown'
            },
          });
        } else if (action === 'export-json') {
          vscode.postMessage({
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
          vscode.postMessage({
            type: 'regeneratePhasePlan',
            payload: {
              conversationId: currentPhasePlan ? currentPhasePlan.conversationId : undefined,
            },
          });
          showPhaseGenerationIndicator();
        }
      });

      // Phase and Task action handlers
      messagesContainer.addEventListener('click', (e) => {
        // Verify Phase Button
        const verifyBtn = e.target.closest('.verify-phase-btn');
        if (verifyBtn) {
          const phaseId = verifyBtn.dataset.phaseId;
          if (phaseId && !verifyBtn.classList.contains('loading')) {
            verifyBtn.classList.add('loading');
            vscode.postMessage({
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
          const taskId = taskBadge.dataset.taskId;
          const phaseId = taskBadge.dataset.phaseId;
          const currentStatus = taskBadge.classList.contains('status-completed') ? 'completed' : 
                               taskBadge.classList.contains('status-in-progress') ? 'in-progress' : 'pending';
          
          let newStatus = 'pending';
          if (currentStatus === 'pending') newStatus = 'in-progress';
          else if (currentStatus === 'in-progress') newStatus = 'completed';
          else if (currentStatus === 'completed') newStatus = 'pending'; // Cycle back to pending

          if (taskId && phaseId) {
            vscode.postMessage({
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
      });

      // Task execute button handlers
      messagesContainer.addEventListener('click', (e) => {
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
          copyToClipboard(formattedTask.replace(/\\\\n/g, '\\n'), 'Task', taskItem);
        } else if (['roo-code', 'windsurf', 'aider', 'cursor', 'continue'].includes(action)) {
          vscode.postMessage({
            type: 'handoffTaskToTool',
            payload: { task, phaseTitle, toolName: action }
          });
        } else if (action === 'gemini-cli') {
          vscode.postMessage({
            type: 'executeTaskInGeminiCLI',
            payload: { task, phaseTitle }
          });
        }

        const dropdown = option.closest('.execute-dropdown');
        if (dropdown) {
          dropdown.classList.remove('open');
        }
      });

      // Global handoff dropdown toggle
      messagesContainer.addEventListener('click', (e) => {
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
          vscode.postMessage({
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
      });

      // Close dropdowns when clicking elsewhere
      document.addEventListener('click', (e) => {
        if (!e.target.closest('.execute-dropdown')) {
          document.querySelectorAll('.execute-dropdown.open').forEach(d => d.classList.remove('open'));
        }
        if (!e.target.closest('.global-handoff-dropdown')) {
          document.querySelectorAll('.global-handoff-dropdown.open').forEach(d => d.classList.remove('open'));
        }
      });

      // Event listeners
      sendButton.addEventListener('click', sendMessage);
      
      // Error Action Buttons (delegated)
      messagesContainer.addEventListener('click', (e) => {
        const actionBtn = e.target.closest('.error-action-btn');
        if (!actionBtn) return;
        
        const action = actionBtn.dataset.action;
        const providerId = actionBtn.dataset.providerId;
        
        switch (action) {
          case 'retry':
            vscode.postMessage({ type: 'retryLastRequest' });
            break;
            
          case 'switchProvider':
            if (providerId) {
               vscode.postMessage({ type: 'switchProviderAndRetry', payload: { providerId } });
            }
            break;
            
          case 'refreshModels':
             vscode.postMessage({ type: 'refreshModels', payload: { providerId } });
             break;
             
          case 'openSettings':
             vscode.postMessage({ type: 'openSettings' });
             break;
        }
      });

      if (providerSelect) {
        providerSelect.addEventListener('change', (event) => {
          const selectedProviderId = event.target.value;
          if (!selectedProviderId || selectedProviderId === activeProviderId) {
            return;
          }
          vscode.postMessage({
            type: 'selectProvider',
            payload: { providerId: selectedProviderId }
          });
        });
      }

      if (settingsButton) {
        settingsButton.addEventListener('click', () => {
          vscode.postMessage({
            type: 'openSettings',
            payload: { settingId: 'junkrat.' + activeProviderId }
          });
        });
      }

      if (modelSelect) {
        modelSelect.addEventListener('change', (event) => {
          const selectedModel = event.target.value;
          if (!selectedModel || selectedModel === activeModel) {
            return;
          }
          vscode.postMessage({
            type: 'selectModel',
            payload: { modelName: selectedModel }
          });
        });
      }

      // Header button event listeners
      if (newChatBtn) {
        newChatBtn.addEventListener('click', () => {
          vscode.postMessage({ type: 'newChat', payload: {} });
        });
      }

      if (historyBtn) {
        historyBtn.addEventListener('click', () => {
          vscode.postMessage({ type: 'showHistory', payload: {} });
        });
      }

      if (clearChatBtn) {
        clearChatBtn.addEventListener('click', () => {
           showConfirmDialog('Clear Chat', 'Are you sure you want to clear all messages?', 'Clear All', () => {
                clearMessages();
                vscode.postMessage({ type: 'clearChat', payload: {} });
           });
        });
      }
      
      messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey && !e.ctrlKey && !e.metaKey) {
          e.preventDefault();
          sendMessage();
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

      // Send ready message to extension
      vscode.postMessage({ type: 'ready' });
      vscode.postMessage({ type: 'requestProviderList' });
      vscode.postMessage({ type: 'requestConfigurationStatus' });
      vscode.postMessage({ type: 'requestModelList' });

      if (providers.length > 0) {
        updateProviderList(providers, activeProviderId);
      }

      // Global Keyboard Shortcuts
      document.addEventListener('keydown', (e) => {
        if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
             if (document.activeElement === messageInput) {
                  sendMessage();
             }
        }
        if ((e.ctrlKey || e.metaKey) && (e.key === 'n' || e.key === 'N')) {
             e.preventDefault();
             vscode.postMessage({ type: 'newChat', payload: {} });
        }
      });

      // Export All Button Listener
      const exportAllBtn = document.getElementById('export-all-btn');
      if (exportAllBtn) {
          exportAllBtn.addEventListener('click', (e) => {
               e.stopPropagation();
               const format = confirm('Export all conversations as JSON? (Cancel for Markdown)') ? 'json' : 'markdown';
               vscode.postMessage({ type: 'exportAllConversations', payload: { format } });
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

      /* --- Onboarding Wizard Functions --- */

      function showOnboardingWizard() {
        if (onboardingWizard) {
          onboardingWizard.style.display = 'flex';
        }
        if (emptyState) {
          emptyState.style.display = 'none';
        }
        if (messagesContainer) {
          // Hide or clear messages? Maybe just ensure wizard is on top or hide container content
          // But styles say wizard is in messages-container
          // So we hide other children?
          // Actually, let's just show it. It might be appended.
          // Wait, in HTML it is IN messages-container.
          // We probably want to hide empty state and maybe messages if any?
          // For now, simple toggling.
        }
        
        // Hide input area or disable it? 
        // Logic says "Hide empty state", wizard is visible.
      }

      function hideOnboardingWizard() {
        if (onboardingWizard) {
          onboardingWizard.style.display = 'none';
        }
        // Empty state is managed by renderMessage/clearChat
      }

      // Add event listeners for Onboarding
      document.addEventListener('click', (e) => {
        const target = e.target;
        if (!target) return;
        
        // Handle onboarding buttons (delegation)
        const btn = target.closest('.onboarding-btn, .onboarding-refresh');
        if (btn) {
            const action = btn.dataset.action;
            if (action === 'install-ollama') {
                vscode.postMessage({ 
                    type: 'openExternalLink', 
                    payload: { url: 'https://ollama.com' } 
                });
            } else if (action === 'test-ollama') {
                vscode.postMessage({ type: 'testOllamaConnection' });
            } else if (action === 'config-gemini') {
                vscode.postMessage({ 
                    type: 'openSettings', 
                    payload: { settingId: 'junkrat.gemini.apiKey' } 
                });
            } else if (action === 'config-other') {
                vscode.postMessage({ 
                    type: 'openSettings', 
                    payload: { settingId: 'activeProvider' } 
                });
            } else if (action === 'refresh-status') {
                vscode.postMessage({ type: 'requestProviderList' });
                // Also trigger a manual check via testOllamaConnection concept or just provider list
                // Provider list refresh triggers nothing if status unchanged in backend, 
                // but checking connection explicitly is better.
                vscode.postMessage({ type: 'testOllamaConnection' }); 
            }
        }
      });

    }) ();
  `;
}
