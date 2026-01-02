import { ProviderRegistry } from '../providers/ProviderRegistry';
import { ChatRequest } from '../types/provider';
import { retry } from '../utils/retry';
import { AIError, isRetryableError } from '../types/errors';
import {
  Conversation,
  ConversationState,
  PhasePlan,
  Phase,
} from '../types/conversation';
import { ConversationManager } from './ConversationManager';
import { PhaseManager } from './PhaseManager';
import { AgentService } from './AgentService';

export class ChatService {
  private _registry: ProviderRegistry;

  get registry(): ProviderRegistry {
    return this._registry;
  }
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

  async analyzeWorkspace(): Promise<import('./ContextManager').WorkspaceContext | undefined> {
    if (!this._conversationManager) {
      return undefined;
    }
    return this._conversationManager.analyzeWorkspace();
  }

  async sendMessage(
    userMessage: string,
    providerId?: string
  ): Promise<string> {
    if (this._useConversationManager && this._conversationManager) {
      const result = await this._conversationManager.sendMessage(userMessage, undefined, providerId);
      return result.response;
    }

    // Add user message to history
    this._conversationHistory.push({ role: 'user', content: userMessage });

    const attemptedProviders = new Set<string>();
    let currentProviderId = providerId;

    // Check if any providers are configured
    if (this._registry.listProviders().length === 0) {
      throw new AIError(
        'No AI providers configured. Please configure at least one provider (Ollama recommended) in settings.',
        'NO_PROVIDER',
        'system',
        undefined,
        false
      );
    }

    // eslint-disable-next-line no-constant-condition
    while (true) {
      let provider = this._registry.getProvider(currentProviderId);

      if (!provider) {
        if (currentProviderId) attemptedProviders.add(currentProviderId);

        provider = this._registry.getNextAvailableProvider(Array.from(attemptedProviders));
        if (!provider) {
          throw new Error('No AI provider available');
        }
        currentProviderId = provider.id;
      }

      attemptedProviders.add(provider.id);

      try {
        return await retry(async () => {
          try {
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
            const response = await provider!.chat(request);

            // Check for agent commands in response (simple heuristic for now)
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
        }, {
          maxRetries: 3,
          initialDelayMs: 1000,
          maxDelayMs: 10000,
          factor: 2,
          jitter: true,
          shouldRetry: (error) => isRetryableError(error),
          onRetry: (attempt, delay, error) => {
            console.log(`Retrying request (attempt ${attempt}) after ${delay}ms due to: ${error}`);
          }
        });
      } catch (error) {
        console.warn(`Provider ${currentProviderId} failed:`, error);

        const nextProvider = this._registry.getNextAvailableProvider(Array.from(attemptedProviders));
        if (!nextProvider) {
          throw error;
        }
        currentProviderId = nextProvider.id;
      }
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

    // Add user message to history
    this._conversationHistory.push({ role: 'user', content: userMessage });

    const attemptedProviders = new Set<string>();
    let currentProviderId = providerId;
    let hasReceivedData = false;

    // Check if any providers are configured
    if (this._registry.listProviders().length === 0) {
      throw new AIError(
        'No AI providers configured. Please configure at least one provider (Ollama recommended) in settings.',
        'NO_PROVIDER',
        'system',
        undefined,
        false
      );
    }

    // eslint-disable-next-line no-constant-condition
    while (true) {
      let provider = this._registry.getProvider(currentProviderId);

      if (!provider) {
        if (currentProviderId) attemptedProviders.add(currentProviderId);

        provider = this._registry.getNextAvailableProvider(Array.from(attemptedProviders));
        if (!provider) {
          throw new Error('No AI provider available');
        }
        currentProviderId = provider.id;
      }

      attemptedProviders.add(provider.id);

      try {
        return await retry(async () => {
          let accumulatedContent = '';
          hasReceivedData = false;

          try {
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
            for await (const chunk of provider!.streamChat(request)) {
              hasReceivedData = true;
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
        }, {
          maxRetries: 3,
          initialDelayMs: 1000,
          maxDelayMs: 10000,
          shouldRetry: (error) => !hasReceivedData && isRetryableError(error),
          onRetry: (attempt, delay, error) => {
            console.log(`Retrying streaming request (attempt ${attempt}) after ${delay}ms due to: ${error}`);
          }
        });
      } catch (error) {
        console.warn(`Provider ${currentProviderId} failed:`, error);

        const nextProvider = this._registry.getNextAvailableProvider(Array.from(attemptedProviders));
        if (!nextProvider) {
          throw error;
        }
        currentProviderId = nextProvider.id;
      }
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

  listConversations(): import('../types/conversation').ConversationMetadata[] {
    if (!this._useConversationManager || !this._conversationManager) {
      return [];
    }

    return this._conversationManager.listConversations();
  }

  async switchToConversation(conversationId: string): Promise<void> {
    if (!this._useConversationManager || !this._conversationManager) {
      throw new Error('Conversation manager not enabled');
    }

    await this._conversationManager.switchToConversation(conversationId);
  }

  async deleteConversation(conversationId: string): Promise<boolean> {
    if (!this._useConversationManager || !this._conversationManager) {
      return false;
    }

    return this._conversationManager.deleteConversation(conversationId);
  }

  async exportConversation(conversationId: string, format: 'json' | 'markdown'): Promise<void> {
    if (!this._useConversationManager || !this._conversationManager) {
      throw new Error('Conversation manager not enabled');
    }

    await this._conversationManager.exportConversation(conversationId, format);
  }

  async exportPhasePlan(conversationId: string, format: 'json' | 'markdown'): Promise<void> {
    if (!this._useConversationManager || !this._conversationManager) {
      throw new Error('Conversation manager not enabled');
    }

    await this._conversationManager.exportPhasePlan(conversationId, format);
  }

  async exportAllConversations(format: 'json' | 'markdown'): Promise<void> {
    if (!this._useConversationManager || !this._conversationManager) {
      throw new Error('Conversation manager not enabled');
    }

    await this._conversationManager.exportAllConversations(format);
  }

  async renameConversation(conversationId: string, newTitle: string): Promise<void> {
    if (!this._useConversationManager || !this._conversationManager) {
      throw new Error('Conversation manager not enabled');
    }

    await this._conversationManager.renameConversation(conversationId, newTitle);
  }

  async saveConversation(conversation: import('../types/conversation').Conversation): Promise<void> {
    if (!this._useConversationManager || !this._conversationManager) {
      throw new Error('Conversation manager not enabled');
    }

    await this._conversationManager.saveConversation(conversation);
  }

  async addPhaseWithAI(
    userPrompt: string,
    afterPhaseId: string | null,
    conversationId?: string,
    providerId?: string
  ): Promise<PhasePlan> {
    if (!this._useConversationManager || !this._conversationManager) {
      throw new Error('Conversation manager not enabled');
    }

    const targetConversationId =
      conversationId ?? this._conversationManager.getActiveConversation()?.metadata.id;
    if (!targetConversationId) {
      throw new Error('No active conversation');
    }

    return this._conversationManager.addPhaseWithAI(
      targetConversationId,
      userPrompt,
      afterPhaseId,
      providerId
    );
  }

  async editPhase(
    phaseId: string,
    updates: Partial<Phase>,
    conversationId?: string
  ): Promise<PhasePlan> {
    if (!this._useConversationManager || !this._conversationManager) {
      throw new Error('Conversation manager not enabled');
    }

    const targetConversationId =
      conversationId ?? this._conversationManager.getActiveConversation()?.metadata.id;
    if (!targetConversationId) {
      throw new Error('No active conversation');
    }

    return this._conversationManager.editPhase(targetConversationId, phaseId, updates);
  }

  async deletePhase(phaseId: string, conversationId?: string): Promise<PhasePlan> {
    if (!this._useConversationManager || !this._conversationManager) {
      throw new Error('Conversation manager not enabled');
    }

    const targetConversationId =
      conversationId ?? this._conversationManager.getActiveConversation()?.metadata.id;
    if (!targetConversationId) {
      throw new Error('No active conversation');
    }

    return this._conversationManager.deletePhase(targetConversationId, phaseId);
  }

  transitionState(conversationId: string, newState: ConversationState): void {
    if (!this._useConversationManager || !this._conversationManager) {
      throw new Error('Conversation manager not enabled');
    }

    this._conversationManager.transitionState(conversationId, newState);
  }

  getPhaseManager(): PhaseManager {
    return this._phaseManager;
  }
}
