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
import { PhasePlan } from '../types/conversation';
import { PhasePlanFormatter } from '../services/PhasePlanFormatter';
import { OllamaProvider, OllamaModelInfo } from './OllamaProvider';

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
    private readonly _configService: ConfigurationService
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
    const conversation = this._chatService.getActiveConversation();

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
    }
  }

  /**
   * Start a new chat conversation
   */
  private async _handleNewChat(): Promise<void> {
    // Clear current conversation in chat service
    this._chatService.clearHistory();

    // Notify webview to clear messages
    this.sendMessageToWebview({
      type: 'clearChat',
      payload: {},
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
      payload: {},
    });

    this._sendConversationState();
  }

  /**
   * Show conversation history (placeholder - can be expanded)
   */
  private async _handleShowHistory(): Promise<void> {
    vscode.window.showInformationMessage('Chat history feature coming soon!');
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
  </div>
  <script nonce="${nonce}">
    ${script}
  </script>
</body>
</html>`;
  }
}
