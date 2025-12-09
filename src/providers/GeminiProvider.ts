import { IAIProvider } from './IAIProvider';
import { ProviderConfig, ChatRequest, ChatResponse, StreamChunk } from '../types/provider';
import { createAIError, InvalidRequestError, RateLimitError, APIError } from '../types/errors';
import { retry, RetryOptions } from '../utils/retry';

interface OpenAIChatCompletionRequest {
  model: string;
  messages: ChatRequest['messages'];
  temperature?: number;
  max_tokens?: number;
  stream?: boolean;
}

interface OpenAIChatCompletionChoice {
  index: number;
  message?: {
    role: string;
    content: string;
  };
  delta?: {
    content?: string;
  };
  finish_reason?: string;
}

interface OpenAIChatCompletionResponse {
  id: string;
  object: string;
  created: number;
  model: string;
  choices: OpenAIChatCompletionChoice[];
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

export class GeminiProvider implements IAIProvider {
  public readonly id: string = 'gemini';
  public readonly name: string = 'Gemini';
  public readonly config: ProviderConfig;

  constructor(config: Partial<ProviderConfig> = {}) {
    this.config = {
      id: 'gemini',
      name: 'Gemini',
      baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai',
      apiKey: undefined,
      model: 'gemini-2.0-flash-exp',
      timeout: 60000,
      maxRetries: 3,
      ...config,
    };
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    if (!this.config.apiKey) {
      throw new InvalidRequestError('Gemini API key is required', this.id);
    }

    try {
      const retryOptions: Partial<RetryOptions> = {
        maxRetries: this.config.maxRetries,
        signal: request.signal,
      };

      return await retry(async () => {
        const controller = this._createAbortController(request.signal, this.config.timeout);
        const body: OpenAIChatCompletionRequest = {
          model: request.model || this.config.model,
          messages: request.messages,
          stream: false,
          temperature: request.temperature,
          max_tokens: request.maxTokens,
        };

        const response = await fetch(`${this.config.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: this._buildHeaders(),
          body: JSON.stringify(body),
          signal: controller.signal,
        });

        if (!response.ok) {
          throw await this._createFetchError(response);
        }

        const data = await response.json() as OpenAIChatCompletionResponse;
        const choice = data.choices?.[0];
        const content = choice?.message?.content ?? '';
        const usage = data.usage;
        const model = data.model || body.model || this.config.model;
        const finishReason = this._mapFinishReason(choice?.finish_reason);

        return {
          id: data.id || `gemini-${Date.now()}`,
          content,
          model,
          finishReason,
          usage: {
            promptTokens: usage?.prompt_tokens,
            completionTokens: usage?.completion_tokens,
            totalTokens: usage?.total_tokens,
          },
        };
      }, retryOptions);
    } catch (error) {
      throw createAIError(error, this.id, 'Gemini chat request failed');
    }
  }

  async *streamChat(request: ChatRequest): AsyncGenerator<StreamChunk, void, unknown> {
    if (!this.config.apiKey) {
      throw new InvalidRequestError('Gemini API key is required', this.id);
    }

    let accumulatedContent = '';

    try {
      const retryOptions: Partial<RetryOptions> = {
        maxRetries: this.config.maxRetries,
        signal: request.signal,
      };

      const body: OpenAIChatCompletionRequest = {
        model: request.model || this.config.model,
        messages: request.messages,
        stream: true,
        temperature: request.temperature,
        max_tokens: request.maxTokens,
      };

      const response = await retry(async () => {
        const controller = this._createAbortController(request.signal, this.config.timeout);

        const result = await fetch(`${this.config.baseUrl}/chat/completions`, {
          method: 'POST',
          headers: this._buildHeaders(),
          body: JSON.stringify(body),
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
        let finalEmitted = false;
        let lastModel: string = body.model || this.config.model;
        let finalReason: ChatResponse['finishReason'] | undefined;

        while (true) {
          const { done, value } = await reader.read();

          if (done) {
            if (!finalEmitted) {
              const finishReason = finalReason || this._mapFinishReason();
              yield { delta: '', done: true, finishReason, model: lastModel };
              finalEmitted = true;
            }
            break;
          }

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line) {
              continue;
            }

            if (line === 'data: [DONE]') {
              if (!finalEmitted) {
                const finishReason = finalReason || this._mapFinishReason();
                yield { delta: '', done: true, finishReason, model: lastModel };
                finalEmitted = true;
              }
              return;
            }

            const chunk = this._parseSSEChunk(line);
            if (!chunk) {
              continue;
            }

            const choice = chunk.choices?.[0];
            const delta = choice?.delta?.content ?? '';
            if (chunk.model) {
              lastModel = chunk.model;
            }

            if (delta) {
              accumulatedContent += delta;
              yield { delta, done: false, model: lastModel };
            }

            if (choice?.finish_reason) {
              const finishReason = this._mapFinishReason(choice.finish_reason);
              finalReason = finishReason;
              if (!finalEmitted) {
                yield { delta: '', done: true, finishReason, model: lastModel };
                finalEmitted = true;
              }
              return;
            }
          }
        }
      } finally {
        reader.releaseLock();
      }
    } catch (error) {
      throw createAIError(error, this.id, 'Gemini streaming request failed');
    }
  }

  async isAvailable(): Promise<boolean> {
    if (!this.config.apiKey) {
      return false;
    }

    try {
      const controller = this._createAbortController(undefined, 5000);
      const response = await fetch(`${this.config.baseUrl}/models`, {
        method: 'GET',
        headers: this._buildHeaders(),
        signal: controller.signal,
      });

      return response.ok;
    } catch (error) {
      return false;
    }
  }

  async listModels(): Promise<string[]> {
    if (!this.config.apiKey) {
      return [];
    }

    try {
      const controller = this._createAbortController(undefined, 10000);
      const response = await fetch(`${this.config.baseUrl}/models`, {
        method: 'GET',
        headers: this._buildHeaders(),
        signal: controller.signal,
      });

      if (!response.ok) {
        return [];
      }

      const data = await response.json() as { data?: Array<{ id: string }> };
      if (Array.isArray(data.data)) {
        return data.data.map((model) => model.id).filter((id): id is string => typeof id === 'string');
      }

      return [];
    } catch (error) {
      return [];
    }
  }

  private _buildHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };

    if (this.config.apiKey) {
      headers.Authorization = `Bearer ${this.config.apiKey}`;
    }

    return headers;
  }

  private _createAbortController(signal?: AbortSignal, timeout?: number): AbortController {
    const controller = new AbortController();

    if (timeout && timeout > 0) {
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      controller.signal.addEventListener('abort', () => clearTimeout(timeoutId), { once: true });
      signal?.addEventListener('abort', () => clearTimeout(timeoutId), { once: true });
    }

    if (signal) {
      signal.addEventListener('abort', () => controller.abort(), { once: true });
    }

    return controller;
  }

  private async _createFetchError(response: Response): Promise<Error> {
    let message = `HTTP ${response.status}: ${response.statusText}`;

    try {
      const errorData = await response.json() as { error?: { message?: string } | string; message?: string };
      const detail = errorData?.error && typeof errorData.error === 'object' ? errorData.error.message : (errorData?.error || errorData?.message);
      if (detail) {
        message += ` - ${detail}`;
      }
    } catch {
      // Ignore JSON parse errors
    }

    if (response.status === 401 || response.status === 403) {
      return new InvalidRequestError(message, this.id, response.status);
    }

    if (response.status === 429) {
      return new RateLimitError(message, this.id, response.status);
    }

    if (response.status >= 500) {
      return new APIError(message, this.id, response.status);
    }

    const error = new Error(message);
    (error as any).status = response.status;
    return error;
  }

  private _parseSSEChunk(line: string): OpenAIChatCompletionResponse | null {
    if (!line.startsWith('data:')) {
      return null;
    }

    const json = line.slice(5).trim();
    if (!json) {
      return null;
    }

    try {
      return JSON.parse(json);
    } catch {
      return null;
    }
  }

  private _mapFinishReason(reason?: string | ChatResponse['finishReason'] | null): ChatResponse['finishReason'] {
    const normalized = typeof reason === 'string' ? reason.toLowerCase() : reason;

    switch (normalized) {
      case 'stop':
      case 'tool_calls':
      case 'function_call':
      case undefined:
      case null:
        return 'stop';
      case 'length':
      case 'max_tokens':
        return 'length';
      case 'cancelled':
      case 'canceled':
      case 'user_cancelled':
        return 'cancelled';
      default:
        return 'error';
    }
  }


}
