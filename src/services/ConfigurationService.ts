import * as vscode from 'vscode';
import { ProviderRegistry } from '../providers/ProviderRegistry';
import { ProviderFactory } from '../providers/ProviderFactory';
import {
  JunkRatConfiguration,
  ProviderSettings,
  ValidationResult,
  ProviderId,
  ConfigurationChangeEvent,
} from '../types/configuration';

const CONFIG_NAMESPACE = 'junkrat';
const DEBOUNCE_INTERVAL = 300;

export class ConfigurationService implements vscode.Disposable {
  private readonly _context: vscode.ExtensionContext;
  private readonly _providerRegistry: ProviderRegistry;
  private readonly _onDidChangeConfiguration = new vscode.EventEmitter<ConfigurationChangeEvent>();
  public readonly onDidChangeConfiguration = this._onDidChangeConfiguration.event;

  private _configListener: vscode.Disposable | undefined;
  private _debounceTimer: NodeJS.Timeout | undefined;

  constructor(context: vscode.ExtensionContext, providerRegistry: ProviderRegistry) {
    this._context = context;
    this._providerRegistry = providerRegistry;

    this._subscribeToConfigurationChanges();
    void this._initializeProviders();
  }

  getConfiguration(): JunkRatConfiguration {
    const config = vscode.workspace.getConfiguration(CONFIG_NAMESPACE);
    const activeProvider = (config.get<string>('activeProvider') as ProviderId) ?? 'ollama';

    return {
      activeProvider,
      ollama: this.getProviderSettings('ollama'),
      gemini: this.getProviderSettings('gemini'),
      openrouter: this.getProviderSettings('openrouter'),
      custom: this.getProviderSettings('custom'),
      'gemini-cli': this.getProviderSettings('gemini-cli'),
    };
  }

  getProviderSettings(providerId: ProviderId): ProviderSettings {
    const defaults = ProviderFactory.getDefaultConfig(providerId);
    const config = vscode.workspace.getConfiguration(CONFIG_NAMESPACE);

    const enabled = config.get<boolean>(`${providerId}.enabled`, providerId === 'ollama');
    const apiKey = config.get<string | undefined>(`${providerId}.apiKey`);
    const baseUrl = config.get<string | undefined>(`${providerId}.baseUrl`);
    const model = config.get<string | undefined>(`${providerId}.model`);
    const timeout = config.get<number | undefined>(`${providerId}.timeout`);
    const maxRetries = config.get<number | undefined>(`${providerId}.maxRetries`);

    return {
      enabled,
      apiKey,
      baseUrl: baseUrl ?? defaults.baseUrl,
      model: model ?? defaults.model,
      timeout: timeout ?? defaults.timeout,
      maxRetries: maxRetries ?? defaults.maxRetries,
    };
  }

  getActiveProviderId(): ProviderId {
    const config = vscode.workspace.getConfiguration(CONFIG_NAMESPACE);
    const active = config.get<string>('activeProvider');
    if (active && ProviderFactory.getSupportedProviders().includes(active)) {
      return active as ProviderId;
    }
    return 'ollama';
  }

  async setActiveProvider(providerId: ProviderId): Promise<void> {
    if (!ProviderFactory.getSupportedProviders().includes(providerId)) {
      throw new Error(`Unsupported provider: ${providerId}`);
    }

    const settings = this.getProviderSettings(providerId);
    const validation = this.validateProviderSettings(providerId, settings);

    if (!settings.enabled) {
      throw new Error(`Provider "${providerId}" is disabled. Enable it in settings first.`);
    }

    if (!validation.valid) {
      throw new Error(`Provider "${providerId}" configuration is invalid: ${validation.errors.join(', ')}`);
    }

    if (!this._providerRegistry.hasProvider(providerId)) {
      await this._registerProvider(providerId, settings);
    }

    if (!this._providerRegistry.hasProvider(providerId)) {
      throw new Error(`Provider "${providerId}" could not be initialized.`);
    }

    const configuration = vscode.workspace.getConfiguration(CONFIG_NAMESPACE);
    await configuration.update('activeProvider', providerId, vscode.ConfigurationTarget.Global);

    if (this._providerRegistry.hasProvider(providerId)) {
      this._providerRegistry.setActiveProvider(providerId);
    }
  }

  validateProviderSettings(providerId: ProviderId, settings: ProviderSettings): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (settings.enabled) {
      if (providerId === 'gemini' || providerId === 'openrouter') {
        if (!settings.apiKey) {
          errors.push('API key is required when enabled.');
        }
      }

      if (providerId === 'ollama' || providerId === 'custom') {
        if (!settings.baseUrl) {
          errors.push('Base URL is required when enabled.');
        } else if (!this._isValidUrl(settings.baseUrl)) {
          errors.push('Base URL must be a valid URL.');
        }
      }

      if (settings.timeout !== undefined && settings.timeout <= 0) {
        errors.push('Timeout must be greater than 0.');
      }

      if (settings.maxRetries !== undefined && settings.maxRetries < 0) {
        errors.push('Max retries must be 0 or greater.');
      }
    } else {
      warnings.push('Provider is disabled.');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  validateAllProviders(): Map<ProviderId, ValidationResult> {
    const results = new Map<ProviderId, ValidationResult>();
    for (const providerId of ProviderFactory.getSupportedProviders() as ProviderId[]) {
      const settings = this.getProviderSettings(providerId);
      results.set(providerId, this.validateProviderSettings(providerId, settings));
    }
    return results;
  }

  async openSettings(settingId?: string): Promise<void> {
    const query = settingId ? ` ${settingId}` : '';
    await vscode.commands.executeCommand(
      'workbench.action.openSettings',
      `@ext:junkrat-dev.junkrat${query}`
    );
  }

  dispose(): void {
    this._onDidChangeConfiguration.dispose();
    this._configListener?.dispose();
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
      this._debounceTimer = undefined;
    }
  }

  private _subscribeToConfigurationChanges(): void {
    this._configListener = vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration(CONFIG_NAMESPACE)) {
        this._scheduleReinitialization(event);
      }
    });
  }

  private _scheduleReinitialization(event: vscode.ConfigurationChangeEvent): void {
    if (this._debounceTimer) {
      clearTimeout(this._debounceTimer);
    }

    this._debounceTimer = setTimeout(() => {
      void this._handleConfigurationChange(event);
    }, DEBOUNCE_INTERVAL);
  }

  private async _handleConfigurationChange(event: vscode.ConfigurationChangeEvent): Promise<void> {
    const activeProviderChanged = event.affectsConfiguration(`${CONFIG_NAMESPACE}.activeProvider`);
    const providerIds = ProviderFactory.getSupportedProviders() as ProviderId[];

    if (activeProviderChanged) {
      const activeProviderId = this.getActiveProviderId();
      if (this._providerRegistry.hasProvider(activeProviderId)) {
        this._providerRegistry.setActiveProvider(activeProviderId);
      }
      this._onDidChangeConfiguration.fire({
        providerId: activeProviderId,
        settings: this.getProviderSettings(activeProviderId),
        requiresReinitialization: false,
      });
    }

    for (const providerId of providerIds) {
      const affectsProvider = event.affectsConfiguration(`${CONFIG_NAMESPACE}.${providerId}`);
      if (!affectsProvider) {
        continue;
      }

      const settings = this.getProviderSettings(providerId);
      const validation = this.validateProviderSettings(providerId, settings);
      const requiresReinitialization = settings.enabled && validation.valid;

      if (requiresReinitialization) {
        await this._registerProvider(providerId, settings);
      } else {
        this._providerRegistry.unregister(providerId);
      }

      this._onDidChangeConfiguration.fire({
        providerId,
        settings,
        requiresReinitialization,
      });
    }

    this._ensureActiveProviderFallback();
  }

  private async _initializeProviders(): Promise<void> {
    const config = this.getConfiguration();

    for (const providerId of ProviderFactory.getSupportedProviders() as ProviderId[]) {
      const settings = config[providerId];
      const validation = this.validateProviderSettings(providerId, settings);
      if (settings.enabled && validation.valid) {
        await this._registerProvider(providerId, settings);
      } else {
        this._providerRegistry.unregister(providerId);
      }
    }

    this._ensureActiveProviderFallback();
  }

  private async _registerProvider(providerId: ProviderId, settings: ProviderSettings): Promise<void> {
    try {
      const defaults = ProviderFactory.getDefaultConfig(providerId);
      const provider = ProviderFactory.createProvider(providerId, {
        ...defaults,
        baseUrl: settings.baseUrl ?? defaults.baseUrl,
        apiKey: settings.apiKey ?? defaults.apiKey,
        model: settings.model ?? defaults.model,
        timeout: settings.timeout ?? defaults.timeout,
        maxRetries: settings.maxRetries ?? defaults.maxRetries,
      });

      this._providerRegistry.unregister(providerId);
      this._providerRegistry.register(provider);
    } catch (error) {
      console.error(`Failed to register provider ${providerId}:`, error);
    }
  }

  private _ensureActiveProviderFallback(): void {
    const activeProviderId = this.getActiveProviderId();

    if (this._providerRegistry.hasProvider(activeProviderId)) {
      this._providerRegistry.setActiveProvider(activeProviderId);
      return;
    }

    const availableProviders = this._providerRegistry.listProviders();
    if (availableProviders.length > 0) {
      this._providerRegistry.setActiveProvider(availableProviders[0] as ProviderId);
    }
  }

  private _isValidUrl(value: string): boolean {
    try {
      // eslint-disable-next-line no-new
      new URL(value);
      return true;
    } catch {
      return false;
    }
  }
}
