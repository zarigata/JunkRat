import * as vscode from 'vscode';
import { ChatViewProvider } from './providers/ChatViewProvider';
import { ProviderRegistry } from './providers/ProviderRegistry';
import { ChatService } from './services/ChatService';
import { ConfigurationService } from './services/ConfigurationService';
import { SettingsHelperProvider } from './providers/SettingsHelperProvider';
import { ProviderFactory } from './providers/ProviderFactory';
import { PhaseManager } from './services/PhaseManager';
import { AgentService } from './services/AgentService';

export async function activate(context: vscode.ExtensionContext) {
  console.log('JunkRat AI Phase Planner activated');

  // Initialize provider system
  const providerRegistry = new ProviderRegistry();
  const configurationService = new ConfigurationService(context, providerRegistry);

  // Create PhaseManager and AgentService
  const phaseManager = new PhaseManager();
  const agentService = new AgentService();

  // Create ChatService
  const chatService = new ChatService(providerRegistry, phaseManager, agentService);

  // Register chat view provider with ChatService
  const chatProvider = new ChatViewProvider(context.extensionUri, chatService, configurationService);
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
