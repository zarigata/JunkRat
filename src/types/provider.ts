export interface ProviderConfig {
  id: string;
  name: string;
  baseUrl: string;
  apiKey: string | undefined;
  model: string;
  timeout: number;
  maxRetries: number;
}

export interface ChatRequest {
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  model: string | undefined;
  temperature: number | undefined;
  maxTokens: number | undefined;
  stream: boolean;
  signal: AbortSignal | undefined;
}

export interface ChatResponse {
  id: string;
  content: string;
  model: string;
  finishReason: 'stop' | 'length' | 'error' | 'cancelled';
  usage: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
}

export interface StreamChunk {
  delta: string;
  done: boolean;
  finishReason?: ChatResponse['finishReason'];
  model?: string;
}
