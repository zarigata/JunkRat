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

export async function activate(context: vscode.ExtensionContext) {
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

  // Register chat view provider with ChatService
  const chatProvider = new ChatViewProvider(context.extensionUri, chatService, configurationService, telemetryService);
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
    providerRegistry
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
            vscode.window.showInformationMessage(`✅ Connection to ${activeProviderId} successful!`);
          } else {
            vscode.window.showErrorMessage(`❌ Connection to ${activeProviderId} failed. Please check your API key and network connection.`);
          }
        } catch (error) {
          vscode.window.showErrorMessage(`❌ Error testing connection: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
      });
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
        const selection = await vscode.window.showInformationMessage(
          'Welcome to JunkRat! Let\'s configure your AI provider to get started.',
          'Open Settings'
        );
        if (selection === 'Open Settings') {
          await configurationService.openSettings();
        }
      }, 1000);
    }
  }

  // Register hello world command (legacy testing)
  const disposable = vscode.commands.registerCommand('junkrat.helloWorld', () => {
    vscode.window.showInformationMessage('Hello from JunkRat!');
  });
  context.subscriptions.push(disposable);

  context.subscriptions.push(configurationService);

  console.log('JunkRat AI chat interface registered successfully');
}

export function deactivate() {
  console.log('JunkRat AI Phase Planner deactivated');
}
