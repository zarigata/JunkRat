import { ProviderConfig, ChatRequest, ChatResponse, StreamChunk } from '../types/provider';

export interface IAIProvider {
  readonly id: string;
  readonly name: string;
  readonly config: ProviderConfig;

  chat(request: ChatRequest): Promise<ChatResponse>;
  streamChat(request: ChatRequest): AsyncGenerator<StreamChunk, void, unknown>;
  isAvailable(): Promise<boolean>;
  listModels(): Promise<string[]>;
}
