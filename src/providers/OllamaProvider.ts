import { IAIProvider } from './IAIProvider';
import { ProviderConfig, ChatRequest, ChatResponse, StreamChunk } from '../types/provider';
import { createAIError } from '../types/errors';
import { retry, RetryOptions } from '../utils/retry';

interface OllamaChatRequest {
  model: string;
  messages: Array<{
    role: string;
    content: string;
  }>;
  stream?: boolean;
  options?: {
    temperature?: number;
  };
}

interface OllamaChatResponse {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

interface OllamaStreamChunk {
  model: string;
  created_at: string;
  message: {
    role: string;
    content: string;
  };
  done: boolean;
}

/** Information about an Ollama model */
export interface OllamaModelInfo {
  name: string;
  size: number;
  digest: string;
  modifiedAt: string;
  family?: string;
  parameterSize?: string;
  quantizationLevel?: string;
  isRunning?: boolean;
}

interface OllamaTagsResponse {
  models?: Array<{
    name: string;
    size: number;
    digest: string;
    modified_at: string;
    details?: {
      family?: string;
      parameter_size?: string;
      quantization_level?: string;
    };
  }>;
}

interface OllamaPsResponse {
  models?: Array<{
    name: string;
    size: number;
    digest: string;
  }>;
}

export class OllamaProvider implements IAIProvider {
  public readonly id: string = 'ollama';
  public readonly name: string = 'Ollama';
  public readonly config: ProviderConfig;

  constructor(config: Partial<ProviderConfig> = {}) {
    this.config = {
      id: 'ollama',
      name: 'Ollama',
      baseUrl: 'http://127.0.0.1:11434',
      apiKey: undefined,
      model: 'llama3',
      timeout: 30000,
      maxRetries: 3,
      ...config,
    };
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    try {
      const retryOptions: Partial<RetryOptions> = {
        maxRetries: this.config.maxRetries,
        signal: request.signal,
      };

      return await retry(async () => {
        const controller = this._createAbortController(request.signal, this.config.timeout);

        // Auto-detect model if configured one is missing
        let modelToUse = request.model || this.config.model;
        try {
          const models = await this.listModels();
          if (models.length > 0 && !models.includes(modelToUse)) {
            console.warn(`Configured model '${modelToUse}' not found. Using '${models[0]}' instead.`);
            modelToUse = models[0];
          }
        } catch (e) {
          console.warn('Failed to auto-detect models:', e);
        }

        const response = await fetch(`${this.config.baseUrl}/api/chat`, {
          method: 'POST',
          headers: this._buildHeaders(),
          body: JSON.stringify({
            model: modelToUse,
            messages: request.messages,
            stream: false,
            options: request.temperature !== undefined ? { temperature: request.temperature } : undefined,
          }),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw await this._createFetchError(response);
        }

        const data = await response.json() as OllamaChatResponse;

        return {
          id: `ollama-${Date.now()}`,
          content: data.message.content,
          model: data.model,
          finishReason: 'stop',
          usage: {
            promptTokens: data.prompt_eval_count,
            completionTokens: data.eval_count,
            totalTokens: (data.prompt_eval_count || 0) + (data.eval_count || 0),
          },
        };
      }, retryOptions);
    } catch (error) {
      throw createAIError(error, this.id, 'Ollama chat request failed');
    }
  }

  async* streamChat(request: ChatRequest): AsyncGenerator<StreamChunk, void, unknown> {
    let accumulatedContent = '';

    try {
      const retryOptions: Partial<RetryOptions> = {
        maxRetries: this.config.maxRetries,
        signal: request.signal,
      };

      const response = await retry(async () => {
        const controller = this._createAbortController(request.signal, this.config.timeout);

        // Auto-detect model if configured one is missing (copied from chat())
        let modelToUse = request.model || this.config.model;
        try {
          const models = await this.listModels();
          if (models.length > 0 && !models.includes(modelToUse)) {
            console.warn(`Configured model '${modelToUse}' not found. Using '${models[0]}' instead.`);
            modelToUse = models[0];
          }
        } catch (e) {
          console.warn('Failed to auto-detect models:', e);
        }

        const result = await fetch(`${this.config.baseUrl}/api/chat`, {
          method: 'POST',
          headers: this._buildHeaders(),
          body: JSON.stringify({
            model: modelToUse,
            messages: request.messages,
            stream: true,
            options: request.temperature !== undefined ? { temperature: request.temperature } : undefined,
          }),
          signal: controller.signal,
        });

        if (!result.ok) {
          throw await this._createFetchError(result);
        }

        return result;
      }, retryOptions);

      if (!response.body) {
        throw new Error('Response body is null');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();

      try {
        let buffer = '';

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            yield { delta: '', done: true };
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || ''; // Keep incomplete line in buffer

          for (const line of lines) {
            if (line.trim() === '') continue;

            try {
              const chunk: OllamaStreamChunk = JSON.parse(line);

              if (chunk.message?.content) {
                accumulatedContent += chunk.message.content;
                yield {
                  delta: chunk.message.content,
                  done: chunk.done,
                };
              }

              if (chunk.done) {
                yield { delta: '', done: true };
                return;
              }
            } catch (parseError) {
              // Skip malformed JSON lines
              continue;
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      throw createAIError(error, this.id, 'Ollama streaming request failed');
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.config.baseUrl}/api/tags`, {
        method: 'GET',
        headers: this._buildHeaders(),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      return false;
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${this.config.baseUrl}/api/tags`, {
        method: 'GET',
        headers: this._buildHeaders(),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return [];
      }

      const data = await response.json() as { models?: Array<{ name: string }> };
      return data.models?.map((model) => model.name) || [];
    } catch (error) {
      return [];
    }
  }

  /**
   * List all downloaded models with detailed information
   */
  async listModelsWithDetails(): Promise<OllamaModelInfo[]> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000);

      const response = await fetch(`${this.config.baseUrl}/api/tags`, {
        method: 'GET',
        headers: this._buildHeaders(),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return [];
      }

      const data = await response.json() as OllamaTagsResponse;
      const runningModels = await this.listRunningModels();
      const runningNames = new Set(runningModels.map(m => m.name));

      return data.models?.map((model) => ({
        name: model.name,
        size: model.size,
        digest: model.digest,
        modifiedAt: model.modified_at,
        family: model.details?.family,
        parameterSize: model.details?.parameter_size,
        quantizationLevel: model.details?.quantization_level,
        isRunning: runningNames.has(model.name),
      })) || [];
    } catch (error) {
      return [];
    }
  }

  /**
   * List models currently loaded in memory (running)
   */
  async listRunningModels(): Promise<OllamaModelInfo[]> {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const response = await fetch(`${this.config.baseUrl}/api/ps`, {
        method: 'GET',
        headers: this._buildHeaders(),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        return [];
      }

      const data = await response.json() as OllamaPsResponse;
      return data.models?.map((model) => ({
        name: model.name,
        size: model.size,
        digest: model.digest,
        modifiedAt: '',
        isRunning: true,
      })) || [];
    } catch (error) {
      return [];
    }
  }

  private _buildHeaders(): Record<string, string> {
    return {
      'Content-Type': 'application/json',
    };
  }

  private _createAbortController(signal?: AbortSignal, timeout?: number): AbortController {
    const controller = new AbortController();

    // If a timeout is specified, create a timeout that will abort the controller
    if (timeout && timeout > 0) {
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      // Clean up timeout if the signal is aborted externally
      signal?.addEventListener('abort', () => {
        clearTimeout(timeoutId);
      }, { once: true });
    }

    // If an external signal is provided, forward abort events
    if (signal) {
      signal.addEventListener('abort', () => {
        controller.abort();
      }, { once: true });
    }

    return controller;
  }

  private async _createFetchError(response: Response): Promise<Error> {
    let message = `HTTP ${response.status}: ${response.statusText}`;

    try {
      const errorData = await response.json() as { error?: string };
      if (errorData.error) {
        message += ` - ${errorData.error}`;
      }
    } catch {
      // Ignore JSON parse errors
    }

    const error = new Error(message);
    (error as any).status = response.status;
    return error;
  }
}
