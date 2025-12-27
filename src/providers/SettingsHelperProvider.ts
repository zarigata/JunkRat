import * as vscode from 'vscode';
import { getNonce } from '../utils/getNonce';
import { getSettingsHelperStyles } from '../webview/settingsHelperStyles';
import { getSettingsHelperScript } from '../webview/settingsHelper';
import { ConfigurationService } from '../services/ConfigurationService';
import { ProviderRegistry } from './ProviderRegistry';
import { ProviderId } from '../types/configuration';
import { ProviderFactory } from './ProviderFactory';
import { ProviderStatusUpdateMessage, ValidationResultMessage, WebviewMessage } from '../types/messages';

interface ProviderStatusItem {
  id: string;
  name: string;
  enabled: boolean;
  available: boolean;
  validation: {
    valid: boolean;
    errors: string[];
    warnings: string[];
  };
}

export class SettingsHelperProvider implements vscode.WebviewViewProvider {
  private _view?: vscode.WebviewView;
  private _configSubscription?: vscode.Disposable;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _configService: ConfigurationService,
    private readonly _providerRegistry: ProviderRegistry,
    private readonly _outputChannel?: vscode.OutputChannel
  ) { }

  resolveWebviewView(webviewView: vscode.WebviewView): void | Thenable<void> {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri],
    };

    webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

    webviewView.webview.onDidReceiveMessage(async (message: WebviewMessage) => {
      await this._handleMessage(message);
    });

    this._configSubscription = this._configService.onDidChangeConfiguration(async () => {
      await this._sendProviderStatus();
    });

    webviewView.onDidDispose(() => {
      this._configSubscription?.dispose();
      this._configSubscription = undefined;
      this._view = undefined;
    });
  }

  private async _handleMessage(message: WebviewMessage): Promise<void> {
    switch (message.type) {
      case 'ready':
        await this._sendProviderStatus();
        break;

      case 'webviewError':
        this._handleWebviewError(message.payload);
        break;

      case 'openSettings':
        await this._configService.openSettings(message.payload?.settingId);
        break;

      case 'openNativeSettings':
        await this._configService.openSettings();
        break;

      case 'testProvider':
        await this._handleTestProvider(message.payload?.providerId);
        break;

      case 'validateAll':
        await this._handleValidateAll();
        break;

      case 'requestProviderStatus':
        await this._sendProviderStatus();
        break;
    }
  }

  private _handleWebviewError(payload: any): void {
    const errorMessage = payload.message || 'Unknown settings webview error';
    const source = payload.source ? ` in ${payload.source}` : '';
    const location = payload.line ? ` at line ${payload.line}:${payload.column || 0}` : '';
    const stack = payload.stack || '';
    const fullMessage = `[Settings Webview Error] ${errorMessage}${source}${location}`;

    console.error(fullMessage);
    if (this._outputChannel) {
      this._outputChannel.appendLine(fullMessage);
      if (stack) {
        this._outputChannel.appendLine(stack);
      }
    }

    // Show notification for critical errors
    vscode.window.showWarningMessage(
      `JunkRat Settings Error: ${errorMessage}. Please check the configuration.`
    );
  }

  private async _handleTestProvider(providerId?: string): Promise<void> {
    if (!providerId) {
      return;
    }

    const typedId = providerId as ProviderId;
    const settings = this._configService.getProviderSettings(typedId);
    const validation = this._configService.validateProviderSettings(typedId, settings);
    const available = settings.enabled ? await this._isProviderAvailable(typedId) : false;

    const validationMessage: ValidationResultMessage = {
      type: 'validationResult',
      payload: {
        validationResults: {
          [providerId]: { ...validation, available },
        },
        message: {
          severity: validation.valid && available ? 'success' : 'error',
          text: validation.valid && available
            ? `Provider "${providerId}" is ready to use.`
            : `Provider "${providerId}" has issues. Review settings and try again.`,
        },
      },
    };
    this._postMessage(validationMessage);

    await this._sendProviderStatus();
  }

  private async _handleValidateAll(): Promise<void> {
    const validationMap = this._configService.validateAllProviders();
    const results: Record<string, any> = {};
    let validCount = 0;

    for (const [providerId, result] of validationMap.entries()) {
      const typedId = providerId as ProviderId;
      const settings = this._configService.getProviderSettings(typedId);
      const available = settings.enabled ? await this._isProviderAvailable(typedId) : false;
      results[providerId] = { ...result, available };
      if (result.valid && available) {
        validCount += 1;
      }
    }

    const allProviders = Array.from(validationMap.keys()).length;
    const allValid = validCount === allProviders && allProviders > 0;

    const validationMessage: ValidationResultMessage = {
      type: 'validationResult',
      payload: {
        validationResults: results,
        message: {
          severity: allValid ? 'success' : 'warning',
          text: allValid
            ? 'All providers are configured and available.'
            : `${validCount}/${allProviders} providers are ready. Check warnings for details.`,
        },
      },
    };
    this._postMessage(validationMessage);

    await this._sendProviderStatus();
  }

  private async _sendProviderStatus(): Promise<void> {
    if (!this._view) {
      return;
    }

    const validationMap = this._configService.validateAllProviders();
    const providers: ProviderStatusItem[] = [];

    for (const providerId of validationMap.keys()) {
      const typedId = providerId as ProviderId;
      const config = this._configService.getProviderSettings(typedId);
      const defaults = ProviderFactory.getDefaultConfig(typedId);
      const validation = validationMap.get(providerId)!;
      const available = config.enabled ? await this._isProviderAvailable(typedId) : false;

      providers.push({
        id: providerId,
        name: defaults.name,
        enabled: config.enabled,
        available,
        validation: {
          valid: validation.valid,
          errors: validation.errors,
          warnings: validation.warnings,
        },
      });
    }

    const payload = {
      providers,
      validationResults: providers.reduce<Record<string, any>>((acc, provider) => {
        acc[provider.id] = {
          valid: provider.validation.valid,
          errors: provider.validation.errors,
          warnings: provider.validation.warnings,
          available: provider.available,
        };
        return acc;
      }, {}),
    };

    const message: ProviderStatusUpdateMessage = {
      type: 'providerStatusUpdate',
      payload,
    };
    this._postMessage(message);
  }

  private _getHtmlForWebview(webview: vscode.Webview): string {
    const nonce = getNonce();
    const styles = getSettingsHelperStyles();
    const script = getSettingsHelperScript();

    const codiconsUri = webview.asWebviewUri(
      vscode.Uri.joinPath(this._extensionUri, 'node_modules', '@vscode/codicons', 'dist', 'codicon.css')
    );

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'nonce-${nonce}'; font-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>JunkRat Configuration Helper</title>
  <link rel="stylesheet" href="${codiconsUri}">
  <style nonce="${nonce}">
    ${styles}
  </style>
</head>
<body>
  <div class="settings-helper-container">
    <div class="settings-header">
      <span class="codicon codicon-gear"></span>
      <h2>Configuration Helper</h2>
    </div>

    <div id="validation-banner" class="validation-message" style="display: none;">
      <span id="validation-text"></span>
    </div>

    <section class="settings-section">
      <h3>Provider Status</h3>
      <ul id="provider-status-list" class="provider-status-list"></ul>
    </section>

    <section class="settings-section">
      <h3>Actions</h3>
      <div class="action-buttons">
        <button class="action-button" id="validate-all-button">
          <span class="codicon codicon-check-all"></span>
          Validate All
        </button>
        <button class="action-button secondary" id="open-settings-button">
          <span class="codicon codicon-gear"></span>
          Open Settings
        </button>
      </div>
    </section>

    <section class="settings-section">
      <h3>Help</h3>
      <div class="help-text">
        <p>All configuration is managed through VS Code's native Settings UI.</p>
        <p>Use the commands <code>JunkRat: Open Settings</code> or <code>JunkRat: Switch Provider</code> from the Command Palette for quick access.</p>
      </div>
    </section>
  </div>

  <script nonce="${nonce}">
    ${script}
  </script>
</body>
</html>`;
  }

  private async _isProviderAvailable(providerId: ProviderId): Promise<boolean> {
    const provider = this._providerRegistry.getProvider(providerId);
    if (!provider) {
      return false;
    }

    try {
      return await provider.isAvailable();
    } catch {
      return false;
    }
  }

  private _postMessage(message: any): void {
    if (this._view) {
      this._view.webview.postMessage(message);
    }
  }
}

function getProviderDefaults(providerId: string) {
  switch (providerId) {
    case 'ollama':
      return { name: 'Ollama (Local)' };
    case 'gemini':
      return { name: 'Google Gemini' };
    case 'openrouter':
      return { name: 'OpenRouter' };
    case 'custom':
      return { name: 'Custom OpenAI-Compatible' };
    default:
      return { name: providerId };
  }
}
