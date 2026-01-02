import * as vscode from 'vscode';
import { ChatViewProvider } from './providers/ChatViewProvider';
import { ProviderRegistry } from './providers/ProviderRegistry';
import { ChatService } from './services/ChatService';
import { ConfigurationService } from './services/ConfigurationService';
import { SettingsHelperProvider } from './providers/SettingsHelperProvider';
import { ProviderFactory } from './providers/ProviderFactory';
import { PhaseManager } from './services/PhaseManager';
import { AgentService } from './services/AgentService';
import { ConversationManager } from './services/ConversationManager';
import { StorageService } from './services/StorageService';
import { TelemetryService } from './services/TelemetryService';
import { OllamaProvider } from './providers/OllamaProvider';
import { ProviderHealthService } from './services/ProviderHealthService';
import { UIStateManager } from './services/UIStateManager';
import { AutonomousExecutionService } from './services/AutonomousExecutionService';

export async function activate(context: vscode.ExtensionContext) {
  // Create Output Channel immediately
  const outputChannel = vscode.window.createOutputChannel('JunkRat');
  context.subscriptions.push(outputChannel);

  try {
    outputChannel.appendLine('JunkRat activation started...');
    console.log('JunkRat AI Phase Planner activated');

    // Initialize telemetry
    const telemetryService = new TelemetryService(context);
    telemetryService.sendActivationEvent();

    // First-time activation check
    const isFirstActivation = !context.globalState.get<boolean>('junkrat.hasActivatedBefore');
    if (isFirstActivation) {
      await context.globalState.update('junkrat.hasActivatedBefore', true);
    }

    // Initialize provider system
    const providerRegistry = new ProviderRegistry();
    const configurationService = new ConfigurationService(context, providerRegistry);

    // Create PhaseManager and AgentService
    const phaseManager = new PhaseManager();
    const agentService = new AgentService();

    // Create StorageService for conversation persistence
    const storageService = new StorageService(context);

    // Create ConversationManager with StorageService
    const conversationManager = new ConversationManager(providerRegistry, storageService);

    // Load conversations from storage
    await conversationManager.loadConversationsFromStorage();

    // Create ChatService
    const chatService = new ChatService(providerRegistry, phaseManager, agentService, conversationManager);

    // Create new services for multi-provider support and autonomous mode
    const providerHealthService = new ProviderHealthService(providerRegistry);
    const uiStateManager = new UIStateManager();
    const autonomousExecutionService = new AutonomousExecutionService(chatService, uiStateManager, outputChannel);

    // Start provider health monitoring
    providerHealthService.startHealthMonitoring();

    // Register services for disposal
    context.subscriptions.push(providerHealthService, uiStateManager, autonomousExecutionService);

    // Register chat view provider with ChatService and new services
    const chatProvider = new ChatViewProvider(
      context.extensionUri,
      chatService,
      configurationService,
      telemetryService,
      providerHealthService,
      uiStateManager,
      autonomousExecutionService,
      outputChannel
    );
    const chatViewRegistration = vscode.window.registerWebviewViewProvider(
      'junkrat.chatView',
      chatProvider,
      {
        webviewOptions: {
          retainContextWhenHidden: false,
        },
      }
    );
    context.subscriptions.push(chatViewRegistration);

    // Register open chat command
    const openChatCommand = vscode.commands.registerCommand('junkrat.openChat', () => {
      vscode.commands.executeCommand('junkrat.chatView.focus');
    });
    context.subscriptions.push(openChatCommand);

    // Register settings helper view provider
    const settingsHelperProvider = new SettingsHelperProvider(
      context.extensionUri,
      configurationService,
      providerRegistry,
      outputChannel
    );
    const settingsViewRegistration = vscode.window.registerWebviewViewProvider(
      'junkrat.settingsHelper',
      settingsHelperProvider,
      {
        webviewOptions: {
          retainContextWhenHidden: true,
        },
      }
    );
    context.subscriptions.push(settingsViewRegistration);

    // Register configuration commands
    context.subscriptions.push(
      vscode.commands.registerCommand('junkrat.openSettings', async () => {
        await configurationService.openSettings();
      })
    );

    context.subscriptions.push(
      vscode.commands.registerCommand('junkrat.validateConfiguration', async () => {
        const results = configurationService.validateAllProviders();
        const providerIds = Array.from(results.keys());
        const summary = providerIds.map((id) => {
          const result = results.get(id)!;
          const defaults = ProviderFactory.getDefaultConfig(id as any);
          return `${defaults.name}: ${result.valid ? '✅' : '⚠️'}`;
        });
        await vscode.window.showInformationMessage(`Configuration status:\n${summary.join('\n')}`);
      })
    );

    context.subscriptions.push(
      vscode.commands.registerCommand('junkrat.switchProvider', async () => {
        const providerIds = ProviderFactory.getSupportedProviders();
        const picks = providerIds.map((id) => {
          const defaults = ProviderFactory.getDefaultConfig(id);
          return {
            label: defaults.name,
            description: id,
            id,
          };
        });

        const selected = await vscode.window.showQuickPick(picks, {
          placeHolder: 'Select the provider to use',
        });

        if (selected) {
          await configurationService.setActiveProvider(selected.id as any);
          vscode.window.showInformationMessage(`Switched active provider to ${selected.label}`);
        }
      })
    );

    context.subscriptions.push(
      vscode.commands.registerCommand('junkrat.testConnection', async () => {
        const activeProviderId = configurationService.getActiveProviderId();

        // Show progress indicator
        await vscode.window.withProgress({
          location: vscode.ProgressLocation.Notification,
          title: `Testing connection to ${activeProviderId}...`,
          cancellable: false
        }, async (progress) => {
          try {
            const isAvailable = await chatService.checkProviderAvailability(activeProviderId);

            if (isAvailable) {
              let message = `✅ Connection to ${activeProviderId} successful!`;

              if (activeProviderId === 'ollama') {
                const provider = chatService.registry.getProvider('ollama') as OllamaProvider;
                if (provider) {
                  const models = await provider.listModelsWithDetails();

                  if (models.length > 0) {
                    const formatSize = (bytes: number) => {
                      if (bytes === 0) return '0 B';
                      const k = 1024;
                      const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
                      const i = Math.floor(Math.log(bytes) / Math.log(k));
                      return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
                    };

                    message += `\n\n📦 Available Models (${models.length}):\n`;
                    message += models.map(m =>
                      `  • ${m.name} ${m.isRunning ? '🟢' : '⚪'} (${formatSize(m.size)})`
                    ).join('\n');
                  } else {
                    message += '\n\n⚠️ No models found. Run: ollama pull llama3';
                  }
                }
              }

              vscode.window.showInformationMessage(message, { modal: activeProviderId === 'ollama' });
            } else {
              vscode.window.showErrorMessage(`❌ Connection to ${activeProviderId} failed. Please check your API key and network connection.`);
            }
          } catch (error) {
            vscode.window.showErrorMessage(`❌ Error testing connection: ${error instanceof Error ? error.message : 'Unknown error'}`);
          }
        });
      })
    );

    context.subscriptions.push(
      vscode.commands.registerCommand('junkrat.viewLogs', () => {
        outputChannel.show();
        outputChannel.appendLine('[COMMAND] View Logs command invoked');
      })
    );

    // Auto-open settings on first activation if no provider is configured
    if (isFirstActivation) {
      const config = configurationService.getConfiguration();
      const hasConfiguredProvider =
        (config.ollama.enabled && !!config.ollama.baseUrl) ||
        (config.gemini.enabled && !!config.gemini.apiKey) ||
        (config.openrouter.enabled && !!config.openrouter.apiKey) ||
        (config.custom.enabled && !!config.custom.baseUrl);

      if (!hasConfiguredProvider) {
        // Small delay to let VS Code settle
        setTimeout(async () => {
          // Auto-open settings directly
          await configurationService.openSettings('junkrat.activeProvider');
        }, 1000);
      }
    }

    // Register hello world command (legacy testing)
    const disposable = vscode.commands.registerCommand('junkrat.helloWorld', () => {
      vscode.window.showInformationMessage('Hello from JunkRat!');
    });
    context.subscriptions.push(disposable);

    context.subscriptions.push(configurationService);

    outputChannel.appendLine('JunkRat activation completed successfully');
    console.log('JunkRat AI chat interface registered successfully');
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorStack = error instanceof Error ? error.stack : '';

    outputChannel.appendLine(`[ACTIVATION ERROR] ${errorMessage}`);
    if (errorStack) {
      outputChannel.appendLine(errorStack);
    }
    outputChannel.show();

    vscode.window.showErrorMessage(
      `JunkRat failed to activate: ${errorMessage}. Check Output > JunkRat for details.`
    );

    // Re-throw to ensure VS Code knows activation failed
    throw error;
  }
}

export function deactivate() {
  try {
    console.log('JunkRat AI Phase Planner deactivated');
  } catch (error) {
    console.error('Error during deactivation:', error);
  }
}
