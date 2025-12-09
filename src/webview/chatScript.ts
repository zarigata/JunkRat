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
              (phase.estimatedComplexity || 'medium') + '</span>';

            phaseItem.appendChild(phaseHeader);

            const phaseDesc = document.createElement('div');
            phaseDesc.className = 'phase-description';
            phaseDesc.textContent = phase.description;
            phaseItem.appendChild(phaseDesc);

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
                  '<span class="task-title">' + task.title + '</span>';

                const taskActions = document.createElement('div');
                taskActions.className = 'task-actions';

                // Execute dropdown button
                const executeBtn = document.createElement('div');
                executeBtn.className = 'execute-dropdown';
                executeBtn.innerHTML = '<button class="execute-btn"><span class="codicon codicon-play"></span><span>Execute</span></button>' +
                  '<div class="execute-menu">' +
                  '<button class="execute-option" data-action="copy"><span class="codicon codicon-clippy"></span>Copy to Clipboard</button>' +
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

        const copyJsonButton = document.createElement('button');
        copyJsonButton.className = 'phase-plan-action-button';
        copyJsonButton.dataset.action = 'copy-json';
        copyJsonButton.innerHTML = '<span class="codicon codicon-json"></span><span>Export JSON</span>';

        const regenerateButton = document.createElement('button');
        regenerateButton.className = 'phase-plan-action-button secondary';
        regenerateButton.dataset.action = 'regenerate';
        regenerateButton.innerHTML = '<span class="codicon codicon-sync"></span><span>Regenerate</span>';

        actionsDiv.appendChild(copyMarkdownButton);
        actionsDiv.appendChild(copyJsonButton);
        actionsDiv.appendChild(regenerateButton);

        const feedbackDiv = document.createElement('div');
        feedbackDiv.className = 'phase-plan-feedback';

        phasePlanDiv.appendChild(headerDiv);
        phasePlanDiv.appendChild(contentDiv);
        phasePlanDiv.appendChild(actionsDiv);
        phasePlanDiv.appendChild(feedbackDiv);

        messagesContainer.appendChild(phasePlanDiv);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        if (emptyState) {
          emptyState.style.display = 'none';
        }

        setState();
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
        }
      });

      messagesContainer.addEventListener('click', (event) => {
        const target = event.target.closest('button.phase-plan-action-button');
        if (!target) {
          return;
        }

        const action = target.dataset.action;
        const phasePlanContainer = target.closest('.phase-plan-message');

        if (action === 'copy-markdown') {
          copyToClipboard(currentPhaseMarkdown, 'Markdown', phasePlanContainer);
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
        const formattedTask = formatTaskForExecution(task, phaseTitle);

        if (action === 'copy') {
          copyToClipboard(formattedTask.replace(/\\\\n/g, '\\n'), 'Task', taskItem);
          const dropdown = option.closest('.execute-dropdown');
          if (dropdown) {
            dropdown.classList.remove('open');
          }
        } else if (action === 'gemini-cli') {
          vscode.postMessage({
            type: 'executeTaskInGeminiCLI',
            payload: {
              task: task,
              phaseTitle: phaseTitle,
            },
          });
          const dropdown = option.closest('.execute-dropdown');
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
