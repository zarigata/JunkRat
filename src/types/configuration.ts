export type ProviderId = 'ollama' | 'gemini' | 'openrouter' | 'custom' | 'gemini-cli';

export interface ProviderSettings {
  enabled: boolean;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  timeout?: number;
  maxRetries?: number;
}

export interface JunkRatConfiguration {
  activeProvider: ProviderId;
  ollama: ProviderSettings;
  gemini: ProviderSettings;
  openrouter: ProviderSettings;
  custom: ProviderSettings;
  'gemini-cli': ProviderSettings;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ConfigurationChangeEvent {
  providerId: ProviderId;
  settings: ProviderSettings;
  requiresReinitialization: boolean;
}
