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
  NoProvidersReadyMessage,
} from '../types/messages';
import { ConfigurationService } from '../services/ConfigurationService';
import { ProviderFactory } from './ProviderFactory';
import { ProviderId } from '../types/configuration';
import { PhasePlan, PhaseTask, Phase, ConversationState } from '../types/conversation';
import { PhasePlanFormatter } from '../services/PhasePlanFormatter';
import { OllamaProvider, OllamaModelInfo } from './OllamaProvider';
import { PhaseManager } from '../services/PhaseManager';
import { TelemetryService } from '../services/TelemetryService';
import { AIError } from '../types/errors';
import { ErrorMessage } from '../types/messages';

/**
 * Provides the chat webview for the JunkRat sidebar
 */
export class ChatViewProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private _messageListener?: vscode.Disposable;
  private _configChangeDisposable?: vscode.Disposable;
  private _pollingInterval?: ReturnType<typeof setInterval>;
  private _lastProviderAvailable: boolean = false;
  private _lastUserMessage: string | undefined;

  // Polling optimization state
  private _pollingAttempts: number = 0;
  private readonly _maxPollingAttempts: number = 36; // 3 minutes at 5s intervals
  private _pollingBackoffMultiplier: number = 1;

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

    // Check initial status
    this._checkInitialProviderStatus();

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
  /**
   * Start polling for provider availability (auto-refresh when Ollama starts)
   */
  private _startProviderPolling(): void {
    if (this._pollingInterval) {
      clearInterval(this._pollingInterval);
    }

    // Poll with dynamic interval
    const interval = 5000 * this._pollingBackoffMultiplier;

    this._pollingInterval = setInterval(async () => {
      await this._checkProviderAndRefresh();
    }, interval);
  }

  /**
   * Check initial provider status to decide whether to poll
   */
  private async _checkInitialProviderStatus(): Promise<void> {
    const activeProviderId = this._configService.getActiveProviderId();
    const isAvailable = await this._chatService.checkProviderAvailability(activeProviderId);

    if (isAvailable) {
      this._lastProviderAvailable = true;
      // Skip polling if already available
    } else {
      // Start polling if not available
      this._startProviderPolling();
    }
  }

  /**
   * Check if provider became available and refresh UI
   */
  private async _checkProviderAndRefresh(): Promise<void> {
    if (!this._view) {
      return;
    }

    // Check if we exceeded max attempts
    if (this._pollingAttempts >= this._maxPollingAttempts) {
      if (this._pollingInterval) {
        clearInterval(this._pollingInterval);
        this._pollingInterval = undefined;
      }

      if (!this._lastProviderAvailable) {
        const message: NoProvidersReadyMessage = {
          type: 'noProvidersReady',
          payload: {
            message: 'No AI providers are ready. Please configure a provider in Settings.',
            showOnboarding: true
          }
        };
        this.sendMessageToWebview(message);
      }
      return;
    }

    this._pollingAttempts++;

    // Implement backoff after 1 minute (12 attempts)
    if (this._pollingAttempts === 12) {
      this._pollingBackoffMultiplier = 2;
      // Restart polling with new interval
      this._startProviderPolling();
      return;
    }

    const activeProviderId = this._configService.getActiveProviderId();
    const isAvailable = await this._chatService.checkProviderAvailability(activeProviderId);

    // If availability changed, refresh the UI
    if (isAvailable !== this._lastProviderAvailable) {
      this._lastProviderAvailable = isAvailable;

      // Reset polling state on success
      if (isAvailable) {
        this._pollingAttempts = 0;
        this._pollingBackoffMultiplier = 1;
        // Keep polling but gently to detect disconnects? 
        // Or stop polling? The original code polled indefinitely.
        // Let's reset to gentle polling or stop if we consider "connected" as done.
        // For robustness, let's keep polling but reset backoff.
        // Actually original logic was to auto-refresh. 
        // We will keep polling with standard interval.
        if (this._pollingBackoffMultiplier > 1) {
          this._pollingBackoffMultiplier = 1;
          this._startProviderPolling();
        }
      }

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
            retryable: false,
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

    this._sendPhaseProgress();

    const suggestions = this._generateNextActionSuggestions(plan);
    this.sendMessageToWebview({
      type: 'nextActionSuggestions',
      payload: { suggestions }
    });
  }

  private async _handleRegeneratePhasePlan(conversationId?: string): Promise<void> {
    const activeConversation = this._chatService.getActiveConversation();
    const targetConversationId = conversationId ?? activeConversation?.metadata.id;

    if (!targetConversationId) {
      this.sendMessageToWebview({
        type: 'error',
        payload: {
          error: 'No active conversation available for phase plan regeneration.',
          retryable: false,
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
          retryable: true, // Likely retryable if it failed mid-generation
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
          retryable: false,
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

  private async _handleExportAllConversations(format: 'markdown' | 'json'): Promise<void> {
    try {
      await this._chatService.exportAllConversations(format);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to export all conversations.';
      this.sendMessageToWebview({
        type: 'error',
        payload: {
          error: message,
          retryable: false,
        },
      });
    }
  }

  private _generateNextActionSuggestions(plan: PhasePlan): string[] {
    const suggestions: string[] = [];

    // Analyze complexity
    if (plan.metadata && plan.metadata.complexity === 'very-complex') {
      suggestions.push('Review phase dependencies carefully');
    }

    // Check first phase
    if (plan.phases.length > 0) {
      suggestions.push(`Start with Phase 1: ${plan.phases[0].title}`);
    }

    // Phase count
    if (plan.phases.length > 5) {
      suggestions.push('Consider tackling phases in parallel where dependencies allow');
    }

    // Always suggest
    suggestions.push('Export plan to your preferred AI builder (Windsurf, Cursor, etc.)');

    // Tech stack check (heuristic)
    suggestions.push('Set up testing infrastructure early');

    return suggestions;
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
        this._lastUserMessage = userText; // Store for retry
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
          await this._handleAIError(error);
        }
        break;

      case 'retryLastRequest':
        await this._handleRetryLastRequest();
        break;

      case 'switchProviderAndRetry':
        await this._handleSwitchProviderAndRetry(message.payload.providerId);
        break;

      case 'refreshModels':
        await this._handleRefreshModels(message.payload.providerId);
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

      case 'exportAllConversations':
        await this._handleExportAllConversations(message.payload.format);
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

      case 'addPhase':
        await this._handleAddPhase(
          message.payload.conversationId,
          message.payload.userPrompt,
          message.payload.afterPhaseId
        );
        break;

      case 'editPhase':
        await this._handleEditPhase(
          message.payload.conversationId,
          message.payload.phaseId,
          message.payload.updates
        );
        break;

      case 'deletePhase':
        await this._handleDeletePhase(message.payload.conversationId, message.payload.phaseId);
        break;

      case 'triggerPhaseGeneration':
        await this._handleTriggerPhaseGeneration();
        break;



      case 'verifyAllPhases':
        await this._handleVerifyAllPhases();
        break;

      case 'requestPhaseProgress':
        this._sendPhaseProgress();
        break;

      case 'testOllamaConnection':
        const isAvailable = await this._chatService.checkProviderAvailability('ollama');
        if (isAvailable) {
          vscode.window.showInformationMessage('Verifying connection...');
          // Trigger a refresh which will update the UI
          await this._checkProviderAndRefresh();
        } else {
          // Force a check/fail
          await this._checkProviderAndRefresh();
        }
        break;

      case 'openExternalLink':
        if (message.payload.url) {
          vscode.env.openExternal(vscode.Uri.parse(message.payload.url));
        }
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
          payload: { error: validation.reason || 'Cannot verify phase', retryable: false }
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

      this._sendPhaseProgress(conversation.metadata.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to verify phase';
      this.sendMessageToWebview({
        type: 'error',
        payload: { error: message, retryable: false }
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

      this._sendPhaseProgress(conversation.metadata.id);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to update task status';
      this.sendMessageToWebview({
        type: 'error',
        payload: { error: message, retryable: false }
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
          payload: { error: 'Gemini CLI is not installed. Install it with: npm install -g @anthropic-ai/gemini-cli', retryable: false },
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
        payload: { error: `Gemini CLI error: ${message}`, retryable: false },
      });
    }
  }

  private async _handleAIError(error: unknown): Promise<void> {
    const aiError = error instanceof AIError ? error : undefined;
    const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';

    let errorType: ErrorMessage['payload']['errorType'] = 'api_error';
    let suggestedActions: ErrorMessage['payload']['suggestedActions'] = [];

    if (aiError) {
      // Map AIError types to errorType
      switch (aiError.code) {
        case 'NETWORK_ERROR':
          errorType = 'network';
          break;
        case 'TIMEOUT':
          errorType = 'timeout';
          break;
        case 'RATE_LIMIT':
          errorType = 'rate_limit';
          break;
        case 'INVALID_REQUEST':
          errorType = 'invalid_request';
          break;
        default:
          errorType = 'api_error';
      }

      // Add retry action if retryable
      if (aiError.retryable) {
        suggestedActions.push({
          action: 'retry',
          label: 'Retry Request',
        });
      }

      // Add switch provider action
      const nextProvider = this._chatService.registry.getNextAvailableProvider([aiError.provider]);
      if (nextProvider) {
        suggestedActions.push({
          action: 'switchProvider',
          label: `Switch to ${nextProvider.name}`,
          providerId: nextProvider.id,
        });
      }

      // Check if it's a model-related error
      if (errorMessage.toLowerCase().includes('model') || errorMessage.toLowerCase().includes('not found')) {
        errorType = 'model_not_found';
        suggestedActions.push({
          action: 'refreshModels',
          label: 'Refresh Model List',
        });

        // Automatically refresh model list
        if (aiError.provider === 'ollama') {
          await this._sendModelList(aiError.provider);
        }
      }
    } else {
      // Generic error, offer retry and settings
      suggestedActions.push(
        { action: 'retry', label: 'Retry Request' },
        { action: 'openSettings', label: 'Open Settings' }
      );
    }

    this.sendMessageToWebview({
      type: 'error',
      payload: {
        error: errorMessage,
        errorType,
        retryable: aiError?.retryable ?? true,
        failedProvider: aiError?.provider,
        suggestedActions,
        details: aiError?.cause?.message,
      },
    });
  }

  private async _handleRetryLastRequest(): Promise<void> {
    if (!this._lastUserMessage) {
      vscode.window.showWarningMessage('No previous request to retry');
      return;
    }

    // Re-send the last message
    await this._handleMessage({
      type: 'sendMessage',
      payload: { text: this._lastUserMessage },
    });
  }

  private async _handleSwitchProviderAndRetry(providerId: string): Promise<void> {
    try {
      await this._configService.setActiveProvider(providerId as ProviderId);
      await this._sendProviderList();

      vscode.window.showInformationMessage(`Switched to ${providerId}`);

      // Retry the last request
      if (this._lastUserMessage) {
        await this._handleRetryLastRequest();
      }
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to switch provider: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async _handleRefreshModels(providerId?: string): Promise<void> {
    try {
      await this._sendModelList(providerId);
      vscode.window.showInformationMessage('Model list refreshed');
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to refresh models: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

  private async _handleAddPhase(
    conversationId: string,
    userPrompt: string,
    afterPhaseId: string | null
  ): Promise<void> {
    try {
      this._sendThinkingIndicator();

      const plan = await this._chatService.addPhaseWithAI(
        userPrompt,
        afterPhaseId,
        conversationId
      );

      this._sendPhasePlan(plan);

      this.sendMessageToWebview({
        type: 'phaseAdded',
        payload: {
          phasePlan: plan,
          conversationId: plan.conversationId,
        },
      });

      this._telemetryService?.sendEvent('addPhase');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to add phase';
      this.sendMessageToWebview({
        type: 'error',
        payload: { error: message, retryable: false },
      });
    }
  }

  private async _handleEditPhase(
    conversationId: string,
    phaseId: string,
    updates: Partial<Phase>
  ): Promise<void> {
    try {
      const plan = await this._chatService.editPhase(phaseId, updates, conversationId);

      this._sendPhasePlan(plan);

      this.sendMessageToWebview({
        type: 'phaseEdited',
        payload: {
          phasePlan: plan,
          conversationId: plan.conversationId,
        },
      });

      this._telemetryService?.sendEvent('editPhase');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to edit phase';
      this.sendMessageToWebview({
        type: 'error',
        payload: { error: message, retryable: false },
      });
    }
  }

  private async _handleDeletePhase(conversationId: string, phaseId: string): Promise<void> {
    try {
      const result = await vscode.window.showWarningMessage(
        'Are you sure you want to delete this phase?',
        { modal: true },
        'Delete'
      );

      if (result !== 'Delete') {
        return;
      }

      const plan = await this._chatService.deletePhase(phaseId, conversationId);

      this._sendPhasePlan(plan);

      this.sendMessageToWebview({
        type: 'phaseDeleted',
        payload: {
          phasePlan: plan,
          conversationId: plan.conversationId,
        },
      });

      this._telemetryService?.sendEvent('deletePhase');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to delete phase';
      this.sendMessageToWebview({
        type: 'error',
        payload: { error: message, retryable: false },
      });
    }
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

  private async _sendModelList(providerId?: string): Promise<void> {
    if (!this._view) {
      return;
    }

    const activeProviderId = providerId || this._configService.getActiveProviderId();

    // Only send model list for Ollama provider
    if (activeProviderId !== 'ollama') {
      return;
    }

    try {
      // Access registry through ChatService
      const provider = this._chatService.registry.getProvider(activeProviderId);

      if (!provider) {
        // Fallback to creating one if not in registry (legacy behavior) or return
        // Ideally we use registry.
      }

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
          retryable: false,
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
          retryable: false,
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
          retryable: true,
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
          retryable: true,
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
        <span>JunkRat</span>
      </div>
      <div class="phase-dashboard" id="phase-dashboard" style="display: none;">
        <div class="dashboard-chart">
          <svg viewBox="0 0 36 36">
            <path class="dashboard-chart-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
            <path class="dashboard-chart-fill" stroke-dasharray="0, 100" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
          </svg>
        </div>
        <div class="dashboard-stats">
          <span id="dashboard-stats-verified">0/0 Verified</span>
          <span class="dashboard-label">Phase Progress</span>
        </div>
      </div>
      <div class="header-actions">
        <!-- Reordered buttons: Clear -> New -> History -->
        <button class="header-btn primary" id="clear-chat-btn" title="Clear Chat">
          <span class="codicon codicon-trash"></span>
        </button>
        <button class="header-btn" id="new-chat-btn" title="New Chat">
          <span class="codicon codicon-add"></span>
        </button>
        <button class="header-btn" id="history-btn" title="History">
          <span class="codicon codicon-history"></span>
        </button>
      </div>
    </div>
    <div class="provider-selector">
      <span class="provider-selector-label">AI Provider:</span>
      <select id="provider-select"></select>
      <span class="provider-status" id="provider-status">
        <span class="codicon codicon-sync"></span>
        <span>Checking...</span>
      </span>
      <button class="settings-button" id="provider-settings-button">
        <span class="codicon codicon-settings-gear"></span>
        <span>Config</span>
      </button>
    </div>
    <div class="model-selector" id="model-selector-container" style="display: none;">
      <span class="model-selector-label">Model:</span>
      <select id="model-select"></select>
      <span class="model-status" id="model-status"></span>
    </div>
    <div class="conversation-state-container" id="conversation-state-container" style="display: none;">
      <div class="conversation-state-badge" id="conversation-state-badge">
        <span class="codicon codicon-info"></span> Idle
      </div>
      <div class="phase-progress-bar" id="phase-progress-bar" style="display: none;">
        <div class="progress-bar-track">
          <div class="progress-bar-fill" id="progress-bar-fill" style="width: 0%"></div>
        </div>
        <div class="progress-bar-label" id="progress-bar-label">0 / 0 phases completed</div>
      </div>
    </div>
    <div class="workflow-actions-container" id="workflow-actions-container" style="display: none;">
      <!-- Buttons will be dynamically inserted here by chatScript.ts -->
    </div>
    <div class="messages-container" id="messages-container">
      
      <!-- Onboarding Wizard -->
      <div id="onboarding-wizard" style="display: none;">
        <div class="onboarding-content">
          <h2>Welcome to JunkRat! 🚀</h2>
          <p>Let's set up your AI provider to start planning phases.</p>
          
          <div class="onboarding-options">
            <div class="onboarding-option recommended">
              <span class="codicon codicon-star-full"></span>
              <h3>Ollama (Recommended)</h3>
              <p>Free, private, local AI models</p>
              <button class="onboarding-btn" data-action="install-ollama">
                Install Ollama
              </button>
              <button class="onboarding-btn secondary" data-action="test-ollama">
                Test Connection
              </button>
            </div>
            
            <div class="onboarding-option">
              <span class="codicon codicon-cloud"></span>
              <h3>Google Gemini</h3>
              <p>Cloud-based AI with API key</p>
              <button class="onboarding-btn" data-action="config-gemini">
                Enter API Key
              </button>
            </div>
            
            <div class="onboarding-option">
              <span class="codicon codicon-settings-gear"></span>
              <h3>Other Providers</h3>
              <p>OpenRouter, Custom endpoints</p>
              <button class="onboarding-btn" data-action="config-other">
                Configure
              </button>
            </div>
          </div>
          
          <button class="onboarding-refresh" data-action="refresh-status">
            <span class="codicon codicon-refresh"></span>
            Refresh Status
          </button>
        </div>
      </div>

      <div class="empty-state" id="empty-state">
        <div class="codicon codicon-hubot"></div>
        <h2>Hey there, vibe coder! 🚀</h2>
        <p class="subtitle">Tell me your wildest project idea and I'll break it down into epic phases</p>
        <div class="empty-state-features">
          <div class="feature-item">
            <span class="codicon codicon-comment-discussion"></span>
            <span>Just describe what you want in plain English</span>
          </div>
          <div class="feature-item">
            <span class="codicon codicon-lightbulb"></span>
            <span>I'll ask smart questions to nail the details</span>
          </div>
          <div class="feature-item">
            <span class="codicon codicon-rocket"></span>
            <span>Get a battle-tested phase plan ready for any AI builder</span>
          </div>
        </div>
        <p class="empty-state-cta">Drop your idea below and let's make magic happen ✨</p>
      </div>
    </div>
    <div class="input-container">
      <textarea 
        id="message-input" 
        placeholder="Describe your project idea..." 
        rows="1"
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
          <div class="history-header-actions">
            <button class="history-action-btn" id="export-all-btn" title="Export All Conversations">
              <span class="codicon codicon-export"></span>
              <span>Export All</span>
            </button>
          </div>
        </div>
        <div class="history-modal-body" style="flex: 1; overflow-y: auto; padding: 10px;">
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
        payload: { error: message, retryable: false }
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
        payload: { error: message, retryable: false }
      });
    }
  }
  private async _handleTriggerPhaseGeneration(): Promise<void> {
    try {
      const conversation = this._chatService.getActiveConversation();
      if (!conversation) {
        throw new Error('No active conversation');
      }

      // Manually transition to phase generation
      this._chatService.transitionState(conversation.metadata.id, ConversationState.ANALYZING_REQUIREMENTS);

      // Send state update to webview
      this.sendMessageToWebview({
        type: 'conversationState',
        payload: {
          state: ConversationState.ANALYZING_REQUIREMENTS,
          conversationId: conversation.metadata.id,
          metadata: conversation.metadata
        }
      });

      // Trigger phase plan generation
      const plan = await this._chatService.regeneratePhasePlan(conversation.metadata.id);

      // Display the plan
      if (plan) {
        await this._sendPhasePlan(plan);
        await this._sendConversationState();
      }

      this._telemetryService?.sendEvent('triggerPhaseGeneration');
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to generate phase plan';
      this.sendMessageToWebview({
        type: 'error',
        payload: { error: message, retryable: false }
      });
    }
  }

  private async _handleVerifyAllPhases(): Promise<void> {
    try {
      const conversation = this._chatService.getActiveConversation();
      if (!conversation || !conversation.phasePlan) {
        throw new Error('No phase plan available');
      }

      const phaseManager = new PhaseManager();
      phaseManager.setActivePlan(conversation.phasePlan);

      let verifiedCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      for (const phase of conversation.phasePlan.phases) {
        const { canVerify, reason } = phaseManager.canVerifyPhase(phase.id);
        if (canVerify) {
          phaseManager.verifyPhase(phase.id);
          verifiedCount++;
        } else {
          errorCount++;
          errors.push(`${phase.title}: ${reason}`);
        }
      }

      // Update conversation with modified plan
      conversation.phasePlan = phaseManager.getActivePlan()!;
      await this._chatService.saveConversation(conversation);

      // Send updated plan to webview
      this._sendPhasePlan(conversation.phasePlan);

      // Send feedback message
      let feedbackMessage = `✅ Verified ${verifiedCount} phase(s).`;
      if (errorCount > 0) {
        feedbackMessage += `\n\n⚠️ Could not verify ${errorCount} phase(s):\n${errors.map(e => `- ${e}`).join('\n')}`;
      }

      this.sendMessageToWebview({
        type: 'assistantMessage',
        payload: {
          id: Date.now().toString(),
          role: 'assistant',
          text: feedbackMessage,
          timestamp: Date.now()
        }
      });

      this._telemetryService?.sendEvent('verifyAllPhases', { verifiedCount: verifiedCount.toString(), errorCount: errorCount.toString() });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to verify phases';
      this.sendMessageToWebview({
        type: 'error',
        payload: { error: message, retryable: false }
      });
    }
  }

  private _sendPhaseProgress(conversationId?: string): void {
    const conversation = conversationId
      ? this._chatService.getConversation(conversationId)
      : this._chatService.getActiveConversation();

    if (!conversation || !conversation.phasePlan) {
      return;
    }

    const phaseManager = new PhaseManager();
    phaseManager.setActivePlan(conversation.phasePlan);
    const progress = phaseManager.getPhaseProgress();

    this.sendMessageToWebview({
      type: 'phaseProgress',
      payload: progress,
    });
  }
}
