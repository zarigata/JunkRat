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
      function renderMessage(message) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message ' + message.role;
        
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
        IDLE: 'Idle',
        GATHERING_REQUIREMENTS: 'Gathering requirements',
        ANALYZING_REQUIREMENTS: 'Analyzing requirements',
        GENERATING_PHASES: 'Generating phase plan',
        COMPLETE: 'Complete',
        ERROR: 'Error',
      };

      const stateIconMap = {
        IDLE: 'debug-pause',
        GATHERING_REQUIREMENTS: 'question',
        ANALYZING_REQUIREMENTS: 'comment-discussion',
        GENERATING_PHASES: 'loading',
        COMPLETE: 'check',
        ERROR: 'error',
      };

      function getStateBadgeClass(state) {
        return 'conversation-state-badge conversation-state-' + state.toLowerCase();
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

        const titleDiv = document.createElement('div');
        titleDiv.className = 'phase-plan-title';
        titleDiv.innerHTML = '<span class="codicon codicon-list-ordered"></span><span>' + plan.title + '</span>';

        headerDiv.appendChild(titleDiv);

        const addPhaseBtn = document.createElement('button');
        addPhaseBtn.className = 'add-phase-btn';
        addPhaseBtn.innerHTML = '<span class="codicon codicon-add"></span> Add Phase';
        addPhaseBtn.onclick = () => showAddPhaseDialog(null);
        headerDiv.appendChild(addPhaseBtn);

        const contentDiv = document.createElement('div');
        contentDiv.className = 'phase-plan-content';

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
              (phase.estimatedComplexity || 'medium') + '</span>' +
              '<span class="phase-status-badge status-' + (phase.status || 'pending') + '">' +
              '<span class="codicon ' + (phase.status === 'verified' ? 'codicon-verified-filled' : 
                                        phase.status === 'completed' ? 'codicon-check' : 
                                        phase.status === 'in-progress' ? 'codicon-sync' : 'codicon-circle-outline') + '"></span>' +
              (phase.status || 'pending') + '</span>';

            // Verification button (only if completed)
            if (phase.status === 'completed') {
              phaseHeader.innerHTML += '<button class="verify-phase-btn update-phase-btn" data-phase-id="' + phase.id + '">' +
                '<span class="codicon codicon-check-all"></span>Mark as Verified</button>';
            }

            // Edit/Delete buttons (only for pending phases)
            if (phase.status === 'pending') {
              const actionsSpan = document.createElement('span');
              actionsSpan.className = 'phase-actions';
              
              const editBtn = document.createElement('button');
              editBtn.className = 'phase-action-btn edit-phase-btn';
              editBtn.innerHTML = '<span class="codicon codicon-edit"></span>';
              editBtn.title = 'Edit Phase';
              editBtn.onclick = (e) => {
                e.stopPropagation();
                showEditPhaseDialog(phase.id, phase.title, phase.description);
              };

              const deleteBtn = document.createElement('button');
              deleteBtn.className = 'phase-action-btn delete-phase-btn';
              deleteBtn.innerHTML = '<span class="codicon codicon-trash"></span>';
              deleteBtn.title = 'Delete Phase';
              deleteBtn.onclick = (e) => {
                e.stopPropagation();
                vscode.postMessage({
                  type: 'deletePhase',
                  payload: {
                    conversationId: plan.conversationId,
                    phaseId: phase.id
                  }
                });
              };
              
              const addAfterBtn = document.createElement('button');
              addAfterBtn.className = 'phase-action-btn add-after-btn';
              addAfterBtn.innerHTML = '<span class="codicon codicon-plus"></span>';
              addAfterBtn.title = 'Add Phase After This';
              addAfterBtn.onclick = (e) => {
                 e.stopPropagation();
                 showAddPhaseDialog(phase.id);
              };

              actionsSpan.appendChild(editBtn);
              actionsSpan.appendChild(deleteBtn);
              actionsSpan.appendChild(addAfterBtn);
              phaseHeader.appendChild(actionsSpan);
            }

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
                taskInfo.innerHTML = '<span class="task-number">' + (taskIndex + 1) + '</span>' +
                  '<span class="task-title">' + task.title + '</span>' +
                  '<span class="task-status-badge status-' + (task.status || 'pending') + '" title="Click to change status" data-task-id="' + task.id + '" data-phase-id="' + phase.id + '">' +
                  '<span class="codicon ' + (task.status === 'completed' ? 'codicon-check' : 
                                            task.status === 'in-progress' ? 'codicon-sync' : 'codicon-circle-outline') + '"></span>' +
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

        const actionsDiv = document.createElement('div');
        actionsDiv.className = 'phase-plan-actions';

        const copyMarkdownButton = document.createElement('button');
        copyMarkdownButton.className = 'phase-plan-action-button';
        copyMarkdownButton.dataset.action = 'copy-markdown';
        copyMarkdownButton.innerHTML = '<span class="codicon codicon-clippy"></span><span>Copy All</span>';

        const exportMarkdownButton = document.createElement('button');
        exportMarkdownButton.className = 'phase-plan-action-button';
        exportMarkdownButton.dataset.action = 'export-markdown';
        exportMarkdownButton.innerHTML = '<span class="codicon codicon-save"></span><span>Export Markdown</span>';

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
        const titleInput = document.createElement('input');
        titleInput.className = 'modal-input';
        titleInput.type = 'text';
        titleInput.value = currentTitle;
        
        const descLabel = document.createElement('label');
        descLabel.textContent = 'Description';
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
          const icon = stateIconMap[state] || 'info';
          const label = stateLabelMap[state] || state;
          conversationStateBadge.innerHTML = '<span class="codicon codicon-' + icon + '"></span><span>' + label + '</span>';
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

        providerStatus.classList.remove('available', 'unavailable');
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
            
            const errorMessage = {
              id: Date.now().toString(),
              role: 'assistant',
              text: '❌ Error: ' + message.payload.error,
              timestamp: Date.now()
            };
            messages.push(errorMessage);
            renderMessage(errorMessage);
            setState();
            break;

          case 'phaseAdded':
            // Handle phase added message if needed (e.g. show toast)
            // The phasePlan message is usually sent after addPhase, handling re-render
            break;
            
          case 'phaseEdited':
             // Handle phase edited
             break;

          case 'phaseDeleted':
             // Handle phase deleted
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

        conversationListData.forEach((conv) =\u003e {
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
          loadBtn.onclick = (e) =\u003e {
            e.stopPropagation();
            vscode.postMessage({ type: 'loadConversation', payload: { conversationId: conv.id } });
          };

          const renameBtn = document.createElement('button');
          renameBtn.className = 'conversation-action-btn';
          renameBtn.title = 'Rename';
          renameBtn.innerHTML = '\u003cspan class="codicon codicon-edit"\u003e\u003c/span\u003e';
          renameBtn.onclick = (e) =\u003e {
            e.stopPropagation();
            const newTitle = prompt('Enter new title:', conv.title);
            if (newTitle \u0026\u0026 newTitle.trim()) {
              vscode.postMessage({ type: 'renameConversation', payload: { conversationId: conv.id, newTitle: newTitle.trim() } });
            }
          };

          const exportBtn = document.createElement('button');
          exportBtn.className = 'conversation-action-btn';
          exportBtn.title = 'Export';
          exportBtn.innerHTML = '\u003cspan class="codicon codicon-export"\u003e\u003c/span\u003e';
          exportBtn.onclick = (e) =\u003e {
            e.stopPropagation();
            const format = confirm('Export as JSON? (Cancel for Markdown)') ? 'json' : 'markdown';
            vscode.postMessage({ type: 'exportConversationToFile', payload: { conversationId: conv.id, format } });
          };

          const deleteBtn = document.createElement('button');
          deleteBtn.className = 'conversation-action-btn danger';
          deleteBtn.title = 'Delete';
          deleteBtn.innerHTML = '\u003cspan class="codicon codicon-trash"\u003e\u003c/span\u003e';
          deleteBtn.onclick = (e) =\u003e {
            e.stopPropagation();
            if (confirm('Delete this conversation?')) {
              vscode.postMessage({ type: 'deleteConversation', payload: { conversationId: conv.id } });
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
        historyModal.addEventListener('click', (e) =\u003e {
          if (e.target === historyModal) {
            hideHistoryModal();
          }
        });
      }

      if (historyCloseBtn) {
        historyCloseBtn.addEventListener('click', () =\u003e {
          hideHistoryModal();
        });
      }

      if (historyBtn) {
        historyBtn.addEventListener('click', () =\u003e {
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

      // Close dropdowns when clicking elsewhere
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
          if (confirm('Clear all messages?')) {
            clearMessages();
            vscode.postMessage({ type: 'clearChat', payload: {} });
          }
        });
      }
      
      messageInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
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
    })();
  `;
}
