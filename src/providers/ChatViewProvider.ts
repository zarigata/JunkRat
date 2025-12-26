import * as vscode from 'vscode';
import { getNonce } from '../utils/getNonce';
import { getChatStyles } from '../webview/chatStyles';
import { getChatScript } from '../webview/chatScript';
import { ChatService } from '../services/ChatService';
import {
  WebviewMessage,
  ExtensionMessage,
  ChatMessage,
  ProviderListMessage,
  ConfigurationStatusMessage,
  PhasePlanMessage,
  ConversationStateMessage,
  ModelListMessage,
} from '../types/messages';
import { ConfigurationService } from '../services/ConfigurationService';
import { ProviderFactory } from './ProviderFactory';
import { ProviderId } from '../types/configuration';
import { PhasePlan, PhaseTask } from '../types/conversation';
import { PhasePlanFormatter } from '../services/PhasePlanFormatter';
import { OllamaProvider, OllamaModelInfo } from './OllamaProvider';
import { PhaseManager } from '../services/PhaseManager';
import { TelemetryService } from '../services/TelemetryService';

/**
 * Provides the chat webview for the JunkRat sidebar
 */
export class ChatViewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private _messageListener?: vscode.Disposable;
  private _configChangeDisposable?: vscode.Disposable;
  private _pollingInterval?: ReturnType<typeof setInterval>;
  private _lastProviderAvailable: boolean = false;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _chatService: ChatService,
    private readonly _configService: ConfigurationService,
    private readonly _telemetryService?: TelemetryService
  ) { }

  /**
   * Resolves the webview view and sets up its content and message handling
   */
  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ): void | Thenable<void> {
    this._view = webviewView;

    // Configure webview options
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    // Set HTML content
    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    // Handle messages from the webview
    this._messageListener = webviewView.webview.onDidReceiveMessage(async (message: WebviewMessage) => {
      await this._handleMessage(message);
    });

    this._configChangeDisposable = this._configService.onDidChangeConfiguration(async () => {
      await this._sendProviderList();
      await this._sendConfigurationStatus();
    });

    // Start polling for provider availability
    this._startProviderPolling();

    // Handle view disposal
    webviewView.onDidDispose(() => {
      if (this._messageListener) {
        this._messageListener.dispose();
        this._messageListener = undefined;
      }
      if (this._configChangeDisposable) {
        this._configChangeDisposable.dispose();
        this._configChangeDisposable = undefined;
      }
      if (this._pollingInterval) {
        clearInterval(this._pollingInterval);
        this._pollingInterval = undefined;
      }
      this._view = undefined;
    });
  }

  /**
   * Start polling for provider availability (auto-refresh when Ollama starts)
   */
  private _startProviderPolling(): void {
    // Poll every 5 seconds
    this._pollingInterval = setInterval(async () => {
      await this._checkProviderAndRefresh();
    }, 5000);
  }

  /**
   * Check if provider became available and refresh UI
   */
  private async _checkProviderAndRefresh(): Promise<void> {
    if (!this._view) {
      return;
    }

    const activeProviderId = this._configService.getActiveProviderId();
    const isAvailable = await this._chatService.checkProviderAvailability(activeProviderId);

    // If availability changed, refresh the UI
    if (isAvailable !== this._lastProviderAvailable) {
      this._lastProviderAvailable = isAvailable;
      await this._sendProviderList();

      // If Ollama became available, also refresh model list
      if (isAvailable && activeProviderId === 'ollama') {
        await this._sendModelList();
      }
    }
  }

  private async _sendConversationState(): Promise<void> {
    const conversation = this._chatService.getActiveConversation();
    if (!conversation) {
      return;
    }

    const message: ConversationStateMessage = {
      type: 'conversationState',
      payload: {
        state: conversation.metadata.state,
        conversationId: conversation.metadata.id,
        metadata: conversation.metadata,
      },
    };

    this.sendMessageToWebview(message);
  }

  private async _sendActivePhasePlan(conversationId?: string, explicitRequest = false): Promise<void> {
    const conversation = conversationId
      ? this._chatService.getConversation(conversationId)
      : this._chatService.getActiveConversation();

    if (!conversation || !conversation.phasePlan) {
      if (explicitRequest) {
        this.sendMessageToWebview({
          type: 'error',
          payload: {
            error: 'No phase plan available. Continue the conversation to generate one.',
          },
        });
      }
      return;
    }

    this._sendPhasePlan(conversation.phasePlan);
  }

  private _sendPhasePlan(plan: PhasePlan): void {
    const formattedMarkdown = PhasePlanFormatter.toMarkdown(plan);

    const message: PhasePlanMessage = {
      type: 'phasePlan',
      payload: {
        plan,
        formattedMarkdown,
        conversationId: plan.conversationId,
      },
    };

    this.sendMessageToWebview(message);
  }

  private async _handleRegeneratePhasePlan(conversationId?: string): Promise<void> {
    const activeConversation = this._chatService.getActiveConversation();
    const targetConversationId = conversationId ?? activeConversation?.metadata.id;

    if (!targetConversationId) {
      this.sendMessageToWebview({
        type: 'error',
        payload: {
          error: 'No active conversation available for phase plan regeneration.',
        },
      });
      return;
    }

    try {
      this._sendThinkingIndicator();
      const plan = await this._chatService.regeneratePhasePlan(targetConversationId);
      if (plan) {
        this._sendPhasePlan(plan);
        this._telemetryService?.sendEvent('regeneratePhasePlan');
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to regenerate phase plan.';
      this.sendMessageToWebview({
        type: 'error',
        payload: {
          error: message,
        },
      });
    }
  }

  private async _handleExportPhasePlan(conversationId: string | undefined, format: 'markdown' | 'json'): Promise<void> {
    const conversation = conversationId
      ? this._chatService.getConversation(conversationId)
      : this._chatService.getActiveConversation();

    if (!conversation || !conversation.phasePlan) {
      this.sendMessageToWebview({
        type: 'error',
        payload: {
          error: 'No phase plan available to export.',
        },
      });
      return;
    }

    const plan = conversation.phasePlan;
    const content =
      format === 'json' ? PhasePlanFormatter.toJSON(plan, true) : PhasePlanFormatter.toMarkdown(plan);

    const exportMessage: ExtensionMessage = {
      type: 'assistantMessage',
      payload: {
        id: Date.now().toString(),
        role: 'assistant',
        text: `Exported phase plan in ${format.toUpperCase()} format:\n\n${content}`,
        timestamp: Date.now(),
      },
    };

    this.sendMessageToWebview(exportMessage);
  }


  /**
   * Sends a message to the webview
   */
  public sendMessageToWebview(message: ExtensionMessage): void {
    if (this._view) {
      this._view.webview.postMessage(message);
    }
  }

  /**
   * Handles messages received from the webview
   */
  private async _handleMessage(message: WebviewMessage): Promise<void> {
    switch (message.type) {
      case 'ready':
        await this._initializeProviderList();
        await this._sendConversationState();
        await this._sendActivePhasePlan();
        break;

      case 'sendMessage':
        const userText = message.payload.text;
        console.log('User message:', userText);

        // Show thinking indicator (optional)
        this._sendThinkingIndicator();

        try {
          // Call ChatService to get AI response
          const assistantResponse = await this._chatService.sendMessage(userText);

          await this._sendConversationState();
          await this._sendActivePhasePlan();

          // Send assistant message to webview
          const assistantMessage: ChatMessage = {
            id: Date.now().toString(),
            role: 'assistant',
            text: assistantResponse,
            timestamp: Date.now(),
          };

          this.sendMessageToWebview({
            type: 'assistantMessage',
            payload: assistantMessage,
          });
        } catch (error) {
          console.error('AI request failed:', error);

          // Send error message to webview
          const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';

          this.sendMessageToWebview({
            type: 'error',
            payload: {
              error: `AI request failed: ${errorMessage}`,
            },
          });
        }
        break;

      case 'requestProviderList':
        await this._sendProviderList();
        break;

      case 'selectProvider':
        await this._handleProviderSelection(message.payload.providerId);
        break;

      case 'requestConfigurationStatus':
        await this._sendConfigurationStatus();
        break;

      case 'openSettings':
        await this._configService.openSettings(message.payload?.settingId);
        break;

      case 'requestPhasePlan':
        await this._sendActivePhasePlan(message.payload.conversationId, true);
        break;

      case 'regeneratePhasePlan':
        await this._handleRegeneratePhasePlan(message.payload.conversationId);
        break;

      case 'exportPhasePlan':
        await this._handleExportPhasePlan(message.payload.conversationId, message.payload.format);
        break;

      case 'requestModelList':
        await this._sendModelList();
        break;

      case 'selectModel':
        await this._handleModelSelection(message.payload.modelName);
        break;

      case 'executeTaskInGeminiCLI':
        await this._handleExecuteTaskInGeminiCLI(message.payload.task, message.payload.phaseTitle);
        break;

      case 'newChat':
        await this._handleNewChat();
        break;

      case 'clearChat':
        await this._handleClearChat();
        break;

      case 'showHistory':
        await this._handleShowHistory();
        break;

      case 'requestConversationList':
        await this._sendConversationList();
        break;

      case 'loadConversation':
        await this._handleLoadConversation(message.payload.conversationId);
        break;

      case 'deleteConversation':
        await this._handleDeleteConversation(message.payload.conversationId);
        break;

      case 'exportConversationToFile':
        await this._handleExportConversationToFile(message.payload.conversationId, message.payload.format);
        break;

      case 'renameConversation':
        await this._handleRenameConversation(message.payload.conversationId, message.payload.newTitle);
        break;

      case 'exportPhasePlanToFile':
        await this._handleExportPhasePlanToFile(message.payload.conversationId, message.payload.format);
        break;

      case 'verifyPhase':
        await this._handleVerifyPhase(message.payload.phaseId, message.payload.conversationId);
        break;

      case 'updateTaskStatus':
        await this._handleUpdateTaskStatus(
          message.payload.phaseId,
          message.payload.taskId,
          message.payload.status,
          message.payload.conversationId
        );
        break;

      case 'handoffTaskToTool':
        await this._handleHandoffTaskToTool(
          message.payload.task,
          message.payload.phaseTitle,
          message.payload.toolName
        );
        break;

      case 'handoffPlanToTool':
        await this._handleHandoffPlanToTool(
          message.payload.conversationId,
          message.payload.toolName
        );
        break;
    }
  }

  /**
   * Start a new chat conversation
   */
  private async _handleNewChat(): Promise<void> {
    // Create a new conversation instead of clearing the current one
    const newConversation = this._chatService.createConversation();

    if (!newConversation) {
      vscode.window.showErrorMessage('Failed to create new conversation');
      return;
    }

    // Notify webview to clear messages
    this.sendMessageToWebview({
      type: 'clearChat',
    });

    // Reset conversation state
    this._sendConversationState();

    vscode.window.showInformationMessage('Started new conversation.');
  }

  /**
   * Clear current chat messages
   */
  private async _handleClearChat(): Promise<void> {
    this._chatService.clearHistory();

    this.sendMessageToWebview({
      type: 'clearChat',
    });

    this._sendConversationState();
  }

  /**
   * Show conversation history
   */
  private async _handleShowHistory(): Promise<void> {
    await this._sendConversationList();
  }

  /**
   * Send conversation list to webview
   */
  private async _sendConversationList(): Promise<void> {
    try {
      const conversations = this._chatService.listConversations();
      const activeConversation = this._chatService.getActiveConversation();

      this.sendMessageToWebview({
        type: 'conversationList',
        payload: {
          conversations,
          activeConversationId: activeConversation?.metadata.id,
        },
      });
    } catch (error: unknown) {
      console.error('[ChatViewProvider] Failed to send conversation list:', error);
      vscode.window.showErrorMessage('Failed to load conversation history');
    }
  }

  /**
   * Load a conversation
   */
  private async _handleLoadConversation(conversationId: string): Promise<void> {
    try {
      await this._chatService.switchToConversation(conversationId);

      // Clear webview
      this.sendMessageToWebview({ type: 'clearChat' });

      // Send conversation loaded message
      const conversation = this._chatService.getConversation(conversationId);
      if (conversation) {
        this.sendMessageToWebview({
          type: 'conversationLoaded',
          payload: {
            conversationId: conversation.metadata.id,
            metadata: conversation.metadata,
          },
        });

        // Send all messages
        for (const msg of conversation.messages) {
          if (msg.role === 'user' || msg.role === 'assistant') {
            this.sendMessageToWebview({
              type: msg.role === 'user' ? 'userMessage' : 'assistantMessage',
              payload: {
                id: msg.id,
                role: msg.role,
                text: msg.content,
                timestamp: msg.timestamp,
              },
            });
          }
        }

        // Send conversation state and phase plan
        await this._sendConversationState();
        await this._sendActivePhasePlan(conversationId);
      }
    } catch (error: unknown) {
      console.error('[ChatViewProvider] Failed to load conversation:', error);
      vscode.window.showErrorMessage(`Failed to load conversation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Delete a conversation
   */
  private async _handleDeleteConversation(conversationId: string): Promise<void> {
    try {
      const result = await vscode.window.showWarningMessage(
        'Are you sure you want to delete this conversation?',
        { modal: true },
        'Delete'
      );

      if (result === 'Delete') {
        await this._chatService.deleteConversation(conversationId);

        this.sendMessageToWebview({
          type: 'conversationDeleted',
          payload: { conversationId },
        });

        // Send updated list
        await this._sendConversationList();

        vscode.window.showInformationMessage('Conversation deleted');
      }
    } catch (error: unknown) {
      console.error('[ChatViewProvider] Failed to delete conversation:', error);
      vscode.window.showErrorMessage(`Failed to delete conversation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Export conversation to file
   */
  private async _handleExportConversationToFile(conversationId: string, format: 'json' | 'markdown'): Promise<void> {
    try {
      await this._chatService.exportConversation(conversationId, format);
      this._telemetryService?.sendEvent('exportConversation', { format });
    } catch (error: unknown) {
      console.error('[ChatViewProvider] Failed to export conversation:', error);
      vscode.window.showErrorMessage(`Failed to export conversation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Export phase plan to file
   */
  private async _handleExportPhasePlanToFile(conversationId: string | undefined, format: 'json' | 'markdown'): Promise<void> {
    try {
      const activeConversation = this._chatService.getActiveConversation();
      const targetConversationId = conversationId ?? activeConversation?.metadata.id;

      if (!targetConversationId) {
        throw new Error('No active conversation to export phase plan from');
      }

      await this._chatService.exportPhasePlan(targetConversationId, format);
      this._telemetryService?.sendEvent('exportPhasePlan', { format });
    } catch (error: unknown) {
      console.error('[ChatViewProvider] Failed to export phase plan:', error);
      vscode.window.showErrorMessage(`Failed to export phase plan: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async _handleVerifyPhase(phaseId: string, conversationId?: string): Promise<void> {
    try {
      const conversation = conversationId
        ? this._chatService.getConversation(conversationId)
        : this._chatService.getActiveConversation();

      if (!conversation || !conversation.phasePlan) {
        throw new Error('No active phase plan');
      }

      const phaseManager = new PhaseManager();
      phaseManager.setActivePlan(conversation.phasePlan);

      const validation = phaseManager.canVerifyPhase(phaseId);
      if (!validation.canVerify) {
        this.sendMessageToWebview({
          type: 'error',
          payload: { error: validation.reason || 'Cannot verify phase' }
        });
        return;
      }

      phaseManager.verifyPhase(phaseId);

      // Update conversation and persist
      conversation.phasePlan = phaseManager.getActivePlan()!;
      await this._chatService.saveConversation(conversation);

      // Send updated phase plan to webview
      this._sendPhasePlan(conversation.phasePlan);

      // Send success notification
      this.sendMessageToWebview({
        type: 'phaseStatusUpdated',
        payload: {
          phaseId,
          status: 'verified',
          conversationId: conversation.metadata.id
        }
      });

      this._telemetryService?.sendEvent('verifyPhase', { phaseId });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to verify phase';
      this.sendMessageToWebview({
        type: 'error',
        payload: { error: message }
      });
    }
  }

  private async _handleUpdateTaskStatus(
    phaseId: string,
    taskId: string,
    status: 'pending' | 'in-progress' | 'completed',
    conversationId?: string
  ): Promise<void> {
    try {
      const conversation = conversationId
        ? this._chatService.getConversation(conversationId)
        : this._chatService.getActiveConversation();

      if (!conversation || !conversation.phasePlan) {
        throw new Error('No active phase plan');
      }

      const phaseManager = new PhaseManager();
      phaseManager.setActivePlan(conversation.phasePlan);
      phaseManager.updateTaskStatus(phaseId, taskId, status);

      conversation.phasePlan = phaseManager.getActivePlan()!;
      await this._chatService.saveConversation(conversation);

      this._sendPhasePlan(conversation.phasePlan);

      this._telemetryService?.sendEvent('updateTaskStatus', { phaseId, taskId, status });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update task status';
      this.sendMessageToWebview({
        type: 'error',
        payload: { error: message }
      });
    }
  }

  /**
   * Rename a conversation
   */
  private async _handleRenameConversation(conversationId: string, newTitle: string): Promise<void> {
    try {
      await this._chatService.renameConversation(conversationId, newTitle);

      // Send updated list
      await this._sendConversationList();

      vscode.window.showInformationMessage('Conversation renamed');
    } catch (error: unknown) {
      console.error('[ChatViewProvider] Failed to rename conversation:', error);
      vscode.window.showErrorMessage(`Failed to rename conversation: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Execute a task using Gemini CLI
   */
  private async _handleExecuteTaskInGeminiCLI(
    task: { id: string; title: string; goal: string; files: string[]; instructions: string[]; acceptance_criteria: string[] },
    phaseTitle: string
  ): Promise<void> {
    try {
      // Check if Gemini CLI is available
      const { exec } = await import('child_process');
      const { promisify } = await import('util');
      const execAsync = promisify(exec);

      try {
        await execAsync('gemini --version');
      } catch {
        this.sendMessageToWebview({
          type: 'error',
          payload: { error: 'Gemini CLI is not installed. Install it with: npm install -g @anthropic-ai/gemini-cli' },
        });
        return;
      }

      // Format prompt for Gemini CLI
      const prompt = this._formatTaskPrompt(task, phaseTitle);

      // Get workspace folder
      const workspaceFolders = vscode.workspace.workspaceFolders;
      const cwd = workspaceFolders?.[0]?.uri.fsPath || process.cwd();

      // Notify user that task is executing
      this.sendMessageToWebview({
        type: 'assistantMessage',
        payload: {
          id: Date.now().toString(),
          role: 'assistant',
          text: `🚀 Executing task "${task.title}" via Gemini CLI...`,
          timestamp: Date.now(),
        },
      });

      // Execute with Gemini CLI
      const escapedPrompt = prompt.replace(/"/g, '\\"').replace(/\n/g, '\\n');
      const { stdout, stderr } = await execAsync(`gemini "${escapedPrompt}"`, { cwd, maxBuffer: 10 * 1024 * 1024 });

      // Send result to webview
      this.sendMessageToWebview({
        type: 'assistantMessage',
        payload: {
          id: Date.now().toString(),
          role: 'assistant',
          text: `✅ Task completed:\n\n${stdout}${stderr ? '\n\n⚠️ Warnings:\n' + stderr : ''}`,
          timestamp: Date.now(),
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to execute task.';
      this.sendMessageToWebview({
        type: 'error',
        payload: { error: `Gemini CLI error: ${message}` },
      });
    }
  }

  /**
   * Format task into a prompt for AI execution
   */
  private _formatTaskPrompt(
    task: { goal: string; files: string[]; instructions: string[]; acceptance_criteria: string[] },
    phaseTitle: string
  ): string {
    let prompt = `Task: ${phaseTitle}\n\nGoal: ${task.goal}\n\n`;

    if (task.files.length > 0) {
      prompt += `Files to work with:\n${task.files.map(f => `- ${f}`).join('\n')}\n\n`;
    }

    prompt += `Instructions:\n${task.instructions.map((i, idx) => `${idx + 1}. ${i}`).join('\n')}\n\n`;
    prompt += `When complete, verify:\n${task.acceptance_criteria.map(c => `- ${c}`).join('\n')}`;

    return prompt;
  }

  /**
   * Sends a temporary thinking indicator to the webview
   */
  private _sendThinkingIndicator(): void {
    // Optional: Send a temporary message indicating AI is processing
    // For now, we'll just log. In future phases, this could show a typing indicator
    console.log('AI is processing the request...');
  }

  private async _initializeProviderList(): Promise<void> {
    await this._sendProviderList();
    await this._sendConfigurationStatus();
  }

  private async _sendProviderList(): Promise<void> {
    if (!this._view) {
      return;
    }

    const providerIds = ProviderFactory.getSupportedProviders() as ProviderId[];
    const activeProviderId = this._configService.getActiveProviderId();

    const providers = await Promise.all(
      providerIds.map(async (providerId) => {
        const defaults = ProviderFactory.getDefaultConfig(providerId);
        const settings = this._configService.getProviderSettings(providerId);
        const enabled = settings.enabled;
        const available = enabled ? await this._chatService.checkProviderAvailability(providerId) : false;

        return {
          id: providerId,
          name: defaults.name,
          enabled,
          available,
        };
      })
    );

    const message: ProviderListMessage = {
      type: 'providerList',
      payload: {
        providers,
        activeProviderId,
      },
    };

    this.sendMessageToWebview(message);
  }

  private async _sendConfigurationStatus(): Promise<void> {
    if (!this._view) {
      return;
    }

    const validationMap = this._configService.validateAllProviders();
    const activeProvider = this._configService.getActiveProviderId();
    const validationResults: Record<string, { valid: boolean; errors: string[]; warnings: string[] }> = {};

    for (const [providerId, result] of validationMap.entries()) {
      validationResults[providerId] = {
        valid: result.valid,
        errors: result.errors,
        warnings: result.warnings,
      };
    }

    const message: ConfigurationStatusMessage = {
      type: 'configurationStatus',
      payload: {
        validationResults,
        activeProvider,
      },
    };

    this.sendMessageToWebview(message);
  }

  private async _sendModelList(): Promise<void> {
    if (!this._view) {
      return;
    }

    const activeProviderId = this._configService.getActiveProviderId();

    // Only send model list for Ollama provider
    if (activeProviderId !== 'ollama') {
      return;
    }

    try {
      const settings = this._configService.getProviderSettings('ollama');
      const ollamaProvider = new OllamaProvider({
        baseUrl: settings.baseUrl,
        model: settings.model,
      });

      const models = await ollamaProvider.listModelsWithDetails();
      const activeModel = settings.model || 'llama3';

      const message: ModelListMessage = {
        type: 'modelList',
        payload: {
          models: models.map(m => ({
            name: m.name,
            size: m.size,
            isRunning: m.isRunning,
            family: m.family,
            parameterSize: m.parameterSize,
          })),
          activeModel,
          providerId: 'ollama',
        },
      };

      this.sendMessageToWebview(message);
    } catch (error) {
      console.error('Failed to fetch models:', error);
    }
  }

  private async _handleModelSelection(modelName: string): Promise<void> {
    if (!modelName) {
      return;
    }

    try {
      // Update the Ollama model setting
      const config = vscode.workspace.getConfiguration('junkrat.ollama');
      await config.update('model', modelName, vscode.ConfigurationTarget.Global);

      this.sendMessageToWebview({
        type: 'modelChanged',
        payload: {
          modelName,
        },
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to switch model.';
      this.sendMessageToWebview({
        type: 'error',
        payload: {
          error: message,
        },
      });
    }
  }

  private async _handleProviderSelection(providerId: string): Promise<void> {
    if (!providerId) {
      return;
    }

    const supportedProviders = ProviderFactory.getSupportedProviders();
    if (!supportedProviders.includes(providerId)) {
      this.sendMessageToWebview({
        type: 'error',
        payload: {
          error: `Unsupported provider: ${providerId}`,
        },
      });
      return;
    }

    const typedProviderId = providerId as ProviderId;
    try {
      await this._configService.setActiveProvider(typedProviderId);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to activate provider.';
      this.sendMessageToWebview({
        type: 'error',
        payload: {
          error: message,
        },
      });
      return;
    }

    const available = await this._chatService.checkProviderAvailability(typedProviderId);
    if (!available) {
      this.sendMessageToWebview({
        type: 'error',
        payload: {
          error: `Provider "${providerId}" is not available. Check configuration.`,
        },
      });
      return;
    }

    const defaults = ProviderFactory.getDefaultConfig(typedProviderId);

    this.sendMessageToWebview({
      type: 'providerChanged',
      payload: {
        providerId,
        providerName: defaults.name,
      },
    });
  }
  private _getHtmlForWebview(webview: vscode.Webview): string {
    const nonce = getNonce();
    const styles = getChatStyles();
    const script = getChatScript();

    // Get the URI for the codicon font
    const codiconsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(
        this._extensionUri,
        'node_modules',
        '@vscode/codicons',
        'dist',
        'codicon.css'
      )
    );

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'nonce-${nonce}'; font-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
  <title>JunkRat Chat</title>
  <link rel="stylesheet" href="${codiconsUri}">
  <style nonce="${nonce}">
    ${styles}
  </style>
</head>
<body>
  <div class="chat-container">
    <div class="chat-header">
      <div class="header-title">
        <span class="codicon codicon-hubot"></span>
        <span>JunkRat</span>
      </div>
      <div class="header-actions">
        <button class="header-btn" id="new-chat-btn" title="New Chat">
          <span class="codicon codicon-add"></span>
        </button>
        <button class="header-btn" id="history-btn" title="Chat History">
          <span class="codicon codicon-history"></span>
        </button>
        <button class="header-btn" id="clear-chat-btn" title="Clear Chat">
          <span class="codicon codicon-trash"></span>
        </button>
      </div>
    </div>
    <div class="provider-selector">
      <span class="provider-selector-label">AI Provider:</span>
      <select id="provider-select"></select>
      <span class="provider-status" id="provider-status">
        <span class="codicon codicon-sync"></span>
        <span>Checking…</span>
      </span>
      <button class="settings-button" id="provider-settings-button">
        <span class="codicon codicon-sync"></span>
        <span>Refresh</span>
      </button>
    </div>
    <div class="model-selector" id="model-selector-container" style="display: none;">
      <span class="model-selector-label">Model:</span>
      <select id="model-select"></select>
      <span class="model-status" id="model-status"></span>
    </div>
    <div class="messages-container" id="messages-container">
      <div class="empty-state" id="empty-state">
        <div class="codicon codicon-hubot" style="font-size: 48px; margin-bottom: 12px;"></div>
        <p><strong>Welcome to JunkRat AI</strong></p>
        <p>Plan your coding projects with AI assistance</p>
      </div>
    </div>
    <div class="input-container">
      <textarea 
        id="message-input" 
        placeholder="Describe your project idea..."
        rows="2"
      ></textarea>
      <button id="send-button">Send</button>
    </div>
    <!-- History Modal -->
    <div class="history-modal" id="history-modal" style="display: none;">
      <div class="history-modal-content">
        <div class="history-modal-header">
          <h3>Conversation History</h3>
          <button class="history-close-btn" id="history-close-btn">
            <span class="codicon codicon-close"></span>
          </button>
        </div>
        <div class="history-modal-body">
          <div id="conversation-list" class="conversation-list"></div>
        </div>
      </div>
    </div>
  </div>
  <script nonce="${nonce}">
    ${script}
  </script>
</body>
</html>`;
  }

  private async _handleHandoffTaskToTool(
    task: { id: string; title: string; goal: string; files: string[]; instructions: string[]; acceptance_criteria: string[] },
    phaseTitle: string,
    toolName: string
  ): Promise<void> {
    try {
      let formattedPrompt: string;

      switch (toolName) {
        case 'roo-code':
          formattedPrompt = PhasePlanFormatter.formatForRooCode(task as PhaseTask, phaseTitle);
          break;
        case 'windsurf':
          formattedPrompt = PhasePlanFormatter.formatForWindsurf(task as PhaseTask, phaseTitle);
          break;
        case 'aider':
          formattedPrompt = PhasePlanFormatter.formatForAider(task as PhaseTask, phaseTitle);
          break;
        case 'cursor':
          formattedPrompt = PhasePlanFormatter.formatForCursor(task as PhaseTask, phaseTitle);
          break;
        case 'continue':
          formattedPrompt = PhasePlanFormatter.formatForContinue(task as PhaseTask, phaseTitle);
          break;
        default:
          throw new Error(`Unknown tool: ${toolName}`);
      }

      // Copy to clipboard
      await vscode.env.clipboard.writeText(formattedPrompt);

      // Send success message
      this.sendMessageToWebview({
        type: 'assistantMessage',
        payload: {
          id: Date.now().toString(),
          role: 'assistant',
          text: `✅ Task formatted for ${toolName} and copied to clipboard. Paste it into your AI builder.`,
          timestamp: Date.now()
        }
      });

      this._telemetryService?.sendEvent('handoffTask', { tool: toolName });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to format task';
      this.sendMessageToWebview({
        type: 'error',
        payload: { error: message }
      });
    }
  }

  private async _handleHandoffPlanToTool(
    conversationId: string | undefined,
    toolName: string
  ): Promise<void> {
    try {
      const conversation = conversationId
        ? this._chatService.getConversation(conversationId)
        : this._chatService.getActiveConversation();

      if (!conversation || !conversation.phasePlan) {
        throw new Error('No phase plan available to handoff');
      }

      const formattedPlan = PhasePlanFormatter.formatPlanForTool(
        conversation.phasePlan,
        toolName
      );

      await vscode.env.clipboard.writeText(formattedPlan);

      this.sendMessageToWebview({
        type: 'assistantMessage',
        payload: {
          id: Date.now().toString(),
          role: 'assistant',
          text: `✅ Complete phase plan formatted for ${toolName} and copied to clipboard. Paste it into your AI builder.`,
          timestamp: Date.now()
        }
      });

      this._telemetryService?.sendEvent('handoffPlan', { tool: toolName });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to format plan';
      this.sendMessageToWebview({
        type: 'error',
        payload: { error: message }
      });
    }
  }
}
