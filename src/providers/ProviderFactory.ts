import { IAIProvider } from './IAIProvider';
import { OllamaProvider } from './OllamaProvider';
import { GeminiProvider } from './GeminiProvider';
import { OpenRouterProvider } from './OpenRouterProvider';
import { CustomProvider } from './CustomProvider';
import { GeminiCLIProvider } from './GeminiCLIProvider';
import { ProviderConfig } from '../types/provider';

export class ProviderFactory {
  static createProvider(providerId: string, config: Partial<ProviderConfig> = {}): IAIProvider {
    switch (providerId) {
      case 'ollama':
        return new OllamaProvider(config);
      case 'gemini':
        return new GeminiProvider(config);
      case 'openrouter':
        return new OpenRouterProvider(config);
      case 'custom':
        return new CustomProvider(config);
      case 'gemini-cli':
        return new GeminiCLIProvider();
      default:
        throw new Error(`Unknown provider: ${providerId}`);
    }
  }

  static getDefaultConfig(providerId: string): ProviderConfig {
    switch (providerId) {
      case 'ollama':
        return {
          id: 'ollama',
          name: 'Ollama',
          baseUrl: 'http://127.0.0.1:11434',
          apiKey: undefined,
          model: 'llama3',
          timeout: 30000,
          maxRetries: 3,
        };
      case 'gemini':
        return {
          id: 'gemini',
          name: 'Google Gemini',
          baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
          apiKey: undefined,
          model: 'gemini-2.0-flash-exp',
          timeout: 60000,
          maxRetries: 3,
        };
      case 'openrouter':
        return {
          id: 'openrouter',
          name: 'OpenRouter',
          baseUrl: 'https://openrouter.ai/api/v1',
          apiKey: undefined,
          model: 'openai/gpt-4o',
          timeout: 60000,
          maxRetries: 3,
        };
      case 'custom':
        return {
          id: 'custom',
          name: 'Custom OpenAI-Compatible',
          baseUrl: 'http://localhost:8080/v1',
          apiKey: undefined,
          model: 'gpt-3.5-turbo',
          timeout: 60000,
          maxRetries: 3,
        };
      case 'gemini-cli':
        return {
          id: 'gemini-cli',
          name: 'Gemini CLI',
          baseUrl: '',
          apiKey: undefined,
          model: 'gemini-cli',
          timeout: 0,
          maxRetries: 0,
        };
      default:
        throw new Error(`Unknown provider: ${providerId}`);
    }
  }

  static getSupportedProviders(): string[] {
    return ['ollama', 'gemini', 'openrouter', 'custom', 'gemini-cli'];
  }
}
