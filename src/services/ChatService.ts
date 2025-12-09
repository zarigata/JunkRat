import { ProviderRegistry } from '../providers/ProviderRegistry';
import { ChatRequest } from '../types/provider';
import {
  Conversation,
  ConversationState,
  PhasePlan,
} from '../types/conversation';
import { ConversationManager } from './ConversationManager';
import { PhaseManager } from './PhaseManager';
import { AgentService } from './AgentService';

export class ChatService {
  private _registry: ProviderRegistry;
  private _conversationHistory: Array<{ role: 'user' | 'assistant' | 'system'; content: string }> = [];
  private _currentAbortController: AbortController | undefined;
  private _conversationManager: ConversationManager | undefined;
  private _phaseManager: PhaseManager;
  private _agentService: AgentService;
  private _useConversationManager = false;

  constructor(
    registry: ProviderRegistry,
    phaseManager: PhaseManager,
    agentService: AgentService,
    conversationManager?: ConversationManager
  ) {
    this._registry = registry;
    this._phaseManager = phaseManager;
    this._agentService = agentService;
    if (conversationManager) {
      this.enableConversationManager(conversationManager);
    }
  }

  async sendMessage(
    userMessage: string,
    providerId?: string
  ): Promise<string> {
    if (this._useConversationManager && this._conversationManager) {
      const result = await this._conversationManager.sendMessage(userMessage, undefined, providerId);
      return result.response;
    }

    try {
      // Add user message to history
      this._conversationHistory.push({ role: 'user', content: userMessage });

      // Get provider
      const provider = this._registry.getProvider(providerId);
      if (!provider) {
        throw new Error('No AI provider available');
      }

      // Create abort controller for cancellation support
      this._currentAbortController = new AbortController();

      // Build request
      const request: ChatRequest = {
        messages: [...this._conversationHistory],
        model: undefined,
        temperature: undefined,
        maxTokens: undefined,
        stream: false,
        signal: this._currentAbortController.signal,
      };

      // Call provider
      const response = await provider.chat(request);

      // Check for agent commands in response (simple heuristic for now)
      // In a real implementation, we'd use a more robust parsing or tool calling API
      if (response.content.includes('EXECUTE_COMMAND:')) {
        const commandMatch = response.content.match(/EXECUTE_COMMAND:\s*(.*)/);
        if (commandMatch) {
          const command = commandMatch[1].trim();
          try {
            await this._agentService.executeCommand(command);
            this._conversationHistory.push({ role: 'system', content: `Command executed successfully: ${command}` });
          } catch (err) {
            this._conversationHistory.push({ role: 'system', content: `Command execution failed: ${(err as Error).message}` });
          }
        }
      }

      // Add assistant response to history
      this._conversationHistory.push({ role: 'assistant', content: response.content });

      // Clean up abort controller
      this._currentAbortController = undefined;

      return response.content;
    } catch (error) {
      // Clean up abort controller on error
      this._currentAbortController = undefined;
      throw error;
    }
  }

  async sendMessageStreaming(
    userMessage: string,
    onChunk: (chunk: string) => void | Promise<void>,
    providerId?: string
  ): Promise<string> {
    if (this._useConversationManager) {
      console.warn('Streaming is not supported when using ConversationManager. Falling back to standard send.');
      return this.sendMessage(userMessage, providerId);
    }

    let accumulatedContent = '';

    try {
      // Add user message to history
      this._conversationHistory.push({ role: 'user', content: userMessage });

      // Get provider
      const provider = this._registry.getProvider(providerId);
      if (!provider) {
        throw new Error('No AI provider available');
      }

      // Create abort controller for cancellation support
      this._currentAbortController = new AbortController();

      // Build request
      const request: ChatRequest = {
        messages: [...this._conversationHistory],
        model: undefined,
        temperature: undefined,
        maxTokens: undefined,
        stream: true,
        signal: this._currentAbortController.signal,
      };

      // Stream the response
      for await (const chunk of provider.streamChat(request)) {
        if (chunk.delta) {
          accumulatedContent += chunk.delta;
          await onChunk(chunk.delta);
        }

        if (chunk.done) {
          break;
        }
      }

      // Add complete assistant response to history
      this._conversationHistory.push({ role: 'assistant', content: accumulatedContent });

      // Clean up abort controller
      this._currentAbortController = undefined;

      return accumulatedContent;
    } catch (error) {
      // Clean up abort controller on error
      this._currentAbortController = undefined;
      throw error;
    }
  }

  cancelCurrentRequest(): void {
    if (this._currentAbortController) {
      this._currentAbortController.abort();
      this._currentAbortController = undefined;
    }
  }

  clearHistory(): void {
    if (this._useConversationManager && this._conversationManager) {
      const active = this._conversationManager.getActiveConversation();
      if (active) {
        this._conversationManager.clearConversation(active.metadata.id);
      }
      return;
    }

    this._conversationHistory = [];
  }

  getHistory(): Array<{ role: 'user' | 'assistant' | 'system'; content: string }> {
    return [...this._conversationHistory];
  }

  async checkProviderAvailability(providerId?: string): Promise<boolean> {
    const provider = this._registry.getProvider(providerId);
    if (!provider) {
      return false;
    }

    return await provider.isAvailable();
  }

  private _buildChatRequest(
    stream: boolean,
    signal: AbortSignal | undefined
  ): ChatRequest {
    return {
      messages: [...this._conversationHistory],
      model: undefined,
      temperature: undefined,
      maxTokens: undefined,
      stream,
      signal,
    };
  }

  enableConversationManager(manager: ConversationManager): void {
    this._conversationManager = manager;
    this._useConversationManager = true;
  }

  getActiveConversation(): Conversation | undefined {
    return this._useConversationManager && this._conversationManager
      ? this._conversationManager.getActiveConversation()
      : undefined;
  }

  createConversation(title?: string): Conversation | undefined {
    return this._useConversationManager && this._conversationManager
      ? this._conversationManager.createConversation(title)
      : undefined;
  }

  getConversationState(): ConversationState | undefined {
    const conversation = this.getActiveConversation();
    return conversation?.metadata.state;
  }

  getPhasePlan(): PhasePlan | undefined {
    const conversation = this.getActiveConversation();
    return conversation?.phasePlan;
  }

  getConversation(conversationId: string): Conversation | undefined {
    if (!this._useConversationManager || !this._conversationManager) {
      return undefined;
    }

    return this._conversationManager.getConversation(conversationId);
  }

  async regeneratePhasePlan(conversationId?: string, providerId?: string): Promise<PhasePlan | undefined> {
    if (!this._useConversationManager || !this._conversationManager) {
      return undefined;
    }

    const targetConversationId =
      conversationId ?? this._conversationManager.getActiveConversation()?.metadata.id;
    if (!targetConversationId) {
      return undefined;
    }

    return this._conversationManager.regeneratePhasePlan(targetConversationId, providerId);
  }
}
