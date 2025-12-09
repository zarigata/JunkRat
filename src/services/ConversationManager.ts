import { ProviderRegistry } from '../providers/ProviderRegistry';
import { IAIProvider } from '../providers/IAIProvider';
import {
  Conversation,
  ConversationMessage,
  ConversationMessageMetadata,
  ConversationMetadata,
  ConversationState,
  PhasePlan,
} from '../types/conversation';
import { PromptEngine } from './PromptEngine';
import { PromptRole, RenderedPrompt } from '../types/prompts';
import { ContextManager } from './ContextManager';
import { PhaseGenerator } from './PhaseGenerator';
import { PhasePlanFormatter } from './PhasePlanFormatter';

interface SendMessageResult {
  response: string;
  conversation: Conversation;
}

export class ConversationManager {
  private readonly _conversations: Map<string, Conversation> = new Map();
  private _activeConversationId: string | undefined;
  private readonly _promptEngine: PromptEngine;
  private readonly _phaseGenerator: PhaseGenerator;
  private readonly _contextManager: ContextManager;

  constructor(private readonly _providerRegistry: ProviderRegistry) {
    this._promptEngine = new PromptEngine();
    this._phaseGenerator = new PhaseGenerator(this._promptEngine);
    this._contextManager = new ContextManager(this._promptEngine);
  }

  createConversation(title?: string): Conversation {
    const id = this._generateId('conversation');
    const metadata: ConversationMetadata = {
      id,
      title: title ?? 'New Conversation',
      state: ConversationState.IDLE,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const conversation: Conversation = {
      metadata,
      messages: [],
      summary: undefined,
      phasePlan: undefined,
    };

    this._conversations.set(id, conversation);
    this._activeConversationId = id;

    return conversation;
  }

  getConversation(conversationId: string): Conversation | undefined {
    return this._conversations.get(conversationId);
  }

  getActiveConversation(): Conversation | undefined {
    return this._activeConversationId ? this._conversations.get(this._activeConversationId) : undefined;
  }

  setActiveConversation(conversationId: string): void {
    if (!this._conversations.has(conversationId)) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }

    this._activeConversationId = conversationId;
  }

  async sendMessage(
    userMessage: string,
    conversationId?: string,
    providerId?: string
  ): Promise<SendMessageResult> {
    const conversation = this._resolveConversation(conversationId, userMessage);
    const provider = this._resolveProvider(providerId);

    const userConversationMessage = this._createMessage('user', userMessage);
    conversation.messages.push(userConversationMessage);
    this._touchConversation(conversation);

    this._contextManager.configureForProvider(provider.id);

    const assistantResponse = await this._handleStateTransition(conversation, provider);

    return { response: assistantResponse, conversation };
  }

  transitionState(conversationId: string, newState: ConversationState): void {
    const conversation = this.getConversation(conversationId);
    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }

    conversation.metadata.state = newState;
    this._touchConversation(conversation);
  }

  async regeneratePhasePlan(conversationId: string, providerId?: string): Promise<PhasePlan> {
    const conversation = this.getConversation(conversationId);
    if (!conversation) {
      throw new Error(`Conversation not found: ${conversationId}`);
    }

    const provider = this._resolveProvider(providerId);

    const requirements =
      conversation.metadata.requirementsSummary ?? this._collectRequirements(conversation);

    if (!requirements) {
      throw new Error('Cannot regenerate phase plan without requirements.');
    }

    this._contextManager.configureForProvider(provider.id);

    const plan = await this._phaseGenerator.generatePhasePlan(
      requirements,
      conversation.metadata.id,
      provider
    );

    conversation.phasePlan = plan;
    conversation.metadata.phaseCount = plan.totalPhases;
    this._touchConversation(conversation);

    const markdown = PhasePlanFormatter.toMarkdown(plan);
    const assistantMessage = this._createMessage('assistant', markdown, {
      phaseData: plan,
    });
    conversation.messages.push(assistantMessage);

    conversation.metadata.state = ConversationState.COMPLETE;

    return plan;
  }

  clearConversation(conversationId: string): void {
    const conversation = this.getConversation(conversationId);
    if (!conversation) {
      return;
    }

    conversation.messages = [];
    conversation.summary = undefined;
    conversation.phasePlan = undefined;
    conversation.metadata.phaseCount = undefined;
    conversation.metadata.requirementsSummary = undefined;
    conversation.metadata.state = ConversationState.IDLE;
    this._touchConversation(conversation);
  }

  deleteConversation(conversationId: string): boolean {
    const deleted = this._conversations.delete(conversationId);
    if (deleted && this._activeConversationId === conversationId) {
      this._activeConversationId = undefined;
    }
    return deleted;
  }

  listConversations(): ConversationMetadata[] {
    return Array.from(this._conversations.values())
      .map((conversation) => conversation.metadata)
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }

  getConversationHistory(conversationId: string): ConversationMessage[] {
    const conversation = this.getConversation(conversationId);
    return conversation ? [...conversation.messages] : [];
  }

  private async _handleStateTransition(
    conversation: Conversation,
    provider: IAIProvider
  ): Promise<string> {
    switch (conversation.metadata.state) {
      case ConversationState.IDLE:
        return this._enterGatheringRequirements(conversation, provider);

      case ConversationState.GATHERING_REQUIREMENTS:
        if (this._isReadyForPlanning(conversation)) {
          return this._proceedToPhaseGeneration(conversation, provider);
        }
        return this._continueGatheringRequirements(conversation, provider);

      case ConversationState.ANALYZING_REQUIREMENTS:
        return this._analyzeRequirements(conversation, provider);

      case ConversationState.GENERATING_PHASES:
        return this._generatePlan(conversation, provider);

      case ConversationState.COMPLETE:
        return this._handleFollowUp(conversation, provider);

      case ConversationState.ERROR:
      default:
        return 'The conversation is in an error state. Please start a new conversation.';
    }
  }

  private async _enterGatheringRequirements(
    conversation: Conversation,
    provider: IAIProvider
  ): Promise<string> {
    const renderedPrompt = this._promptEngine.renderPrompt(PromptRole.REQUIREMENT_GATHERER, {
      conversationState: ConversationState.GATHERING_REQUIREMENTS,
      additionalContext: {},
    });

    this._ensureSystemPrompt(conversation, renderedPrompt);
    this._setState(conversation, ConversationState.GATHERING_REQUIREMENTS);

    return this._sendWithProvider(conversation, provider);
  }

  private async _continueGatheringRequirements(
    conversation: Conversation,
    provider: IAIProvider
  ): Promise<string> {
    const renderedPrompt = this._promptEngine.renderPrompt(PromptRole.REQUIREMENT_GATHERER, {
      conversationState: ConversationState.GATHERING_REQUIREMENTS,
      additionalContext: {},
    });

    this._ensureSystemPrompt(conversation, renderedPrompt);

    return this._sendWithProvider(conversation, provider);
  }

  private async _proceedToPhaseGeneration(
    conversation: Conversation,
    provider: IAIProvider
  ): Promise<string> {
    this._setState(conversation, ConversationState.ANALYZING_REQUIREMENTS);

    const summary = await this._performRequirementsAnalysis(conversation, provider);
    conversation.metadata.requirementsSummary = summary;

    this._setState(conversation, ConversationState.GENERATING_PHASES);

    const response = await this._generatePlan(conversation, provider);

    return response;
  }

  private async _analyzeRequirements(
    conversation: Conversation,
    provider: IAIProvider
  ): Promise<string> {
    const summary = await this._performRequirementsAnalysis(conversation, provider);
    conversation.metadata.requirementsSummary = summary;
    this._setState(conversation, ConversationState.GENERATING_PHASES);
    return 'Requirements analyzed. Generating phase plan...';
  }

  private async _performRequirementsAnalysis(
    conversation: Conversation,
    provider: IAIProvider
  ): Promise<string> {
    const requirementsText = this._collectRequirements(conversation);

    if (!requirementsText) {
      return 'No requirements provided.';
    }

    const renderedPrompt = this._promptEngine.renderPrompt(PromptRole.REQUIREMENT_ANALYZER, {
      conversationState: ConversationState.ANALYZING_REQUIREMENTS,
      requirements: requirementsText,
      additionalContext: {},
    });

    const requestMessages = [
      { role: 'system' as const, content: renderedPrompt.systemMessage },
      { role: 'user' as const, content: requirementsText },
    ];

    const response = await provider.chat({
      messages: requestMessages,
      model: undefined,
      temperature: undefined,
      maxTokens: undefined,
      stream: false,
      signal: undefined,
    });

    return response.content;
  }

  private async _generatePlan(
    conversation: Conversation,
    provider: IAIProvider
  ): Promise<string> {
    const requirements =
      conversation.metadata.requirementsSummary ?? this._collectRequirements(conversation);

    if (!requirements) {
      this._setState(conversation, ConversationState.ERROR);
      return 'Unable to generate a phase plan without requirements. Please provide more details.';
    }

    const plan = await this._phaseGenerator.generatePhasePlan(
      requirements,
      conversation.metadata.id,
      provider
    );

    conversation.phasePlan = plan;
    conversation.metadata.phaseCount = plan.totalPhases;

    const markdown = PhasePlanFormatter.toMarkdown(plan);
    const assistantMessage = this._createMessage('assistant', markdown, {
      phaseData: plan,
    });
    conversation.messages.push(assistantMessage);

    this._setState(conversation, ConversationState.COMPLETE);
    this._touchConversation(conversation);

    return markdown;
  }

  private async _handleFollowUp(
    conversation: Conversation,
    provider: IAIProvider
  ): Promise<string> {
    if (conversation.phasePlan) {
      this._ensurePhaseSummaryMessage(conversation.phasePlan);
    }

    return this._sendWithProvider(conversation, provider);
  }

  private async _sendWithProvider(
    conversation: Conversation,
    provider: IAIProvider
  ): Promise<string> {
    const contextMessages = await this._contextManager.buildContextForRequest(conversation, provider);

    const chatMessages = contextMessages.map((message) => ({
      role: message.role,
      content: message.content,
    }));

    const response = await provider.chat({
      messages: chatMessages,
      model: undefined,
      temperature: undefined,
      maxTokens: undefined,
      stream: false,
      signal: undefined,
    });

    const assistantMessage = this._createMessage('assistant', response.content);
    conversation.messages.push(assistantMessage);
    this._touchConversation(conversation);

    return response.content;
  }

  private _ensureSystemPrompt(conversation: Conversation, renderedPrompt: RenderedPrompt): void {
    const existingPrompt = conversation.messages.find(
      (message) =>
        message.role === 'system' && message.metadata?.templateId === renderedPrompt.metadata.templateId
    );

    if (existingPrompt) {
      return;
    }

    const systemMessage = this._createMessage('system', renderedPrompt.systemMessage, {
      isSystemPrompt: true,
      templateId: renderedPrompt.metadata.templateId,
    });

    conversation.messages.unshift(systemMessage);
  }

  private _ensurePhaseSummaryMessage(plan: PhasePlan): void {
    const conversation = this.getConversation(plan.conversationId);
    if (!conversation) {
      return;
    }

    const existing = conversation.messages.find(
      (message) => message.metadata?.phaseData?.id === plan.id
    );

    if (existing) {
      return;
    }

    const summaryText = PhasePlanFormatter.toJSON(plan, false);
    const message = this._createMessage('system', summaryText, {
      isSystemPrompt: true,
      phaseData: plan,
    });

    conversation.messages.push(message);
  }

  private _collectRequirements(conversation: Conversation): string {
    return conversation.messages
      .filter((message) => message.role === 'user')
      .map((message) => message.content)
      .join('\n\n');
  }

  private _isReadyForPlanning(conversation: Conversation): boolean {
    const userMessages = conversation.messages.filter((message) => message.role === 'user');
    if (userMessages.length < 2) {
      return false;
    }

    const lastUserMessage = userMessages[userMessages.length - 1].content.toLowerCase();
    const confirmationKeywords = ['that\'s all', 'ready for plan', 'generate phases', 'start planning'];
    if (confirmationKeywords.some((keyword) => lastUserMessage.includes(keyword))) {
      return true;
    }

    const totalContentLength = userMessages.reduce((acc, message) => acc + message.content.length, 0);
    return totalContentLength > 400;
  }

  private _resolveConversation(conversationId: string | undefined, firstMessage: string): Conversation {
    if (conversationId) {
      const conversation = this.getConversation(conversationId);
      if (!conversation) {
        throw new Error(`Conversation not found: ${conversationId}`);
      }
      this._activeConversationId = conversationId;
      return conversation;
    }

    const active = this.getActiveConversation();
    if (active) {
      return active;
    }

    return this.createConversation(this._generateConversationTitle(firstMessage));
  }

  private _resolveProvider(providerId?: string): IAIProvider {
    const provider = this._providerRegistry.getProvider(providerId);
    if (!provider) {
      throw new Error('No AI provider available');
    }

    return provider;
  }

  private _createMessage(
    role: 'user' | 'assistant' | 'system',
    content: string,
    metadata?: ConversationMessageMetadata
  ): ConversationMessage {
    return {
      id: this._generateId('msg'),
      role,
      content,
      timestamp: Date.now(),
      metadata,
    };
  }

  private _generateConversationTitle(firstMessage: string): string {
    const trimmed = firstMessage.trim();
    if (!trimmed) {
      return 'New Conversation';
    }

    if (trimmed.length <= 50) {
      return trimmed;
    }

    const shortened = trimmed.slice(0, 47);
    const lastSpace = shortened.lastIndexOf(' ');
    return `${shortened.slice(0, lastSpace > 20 ? lastSpace : shortened.length)}...`;
  }

  private _touchConversation(conversation: Conversation): void {
    conversation.metadata.updatedAt = Date.now();
  }

  private _generateId(prefix: string): string {
    if (typeof globalThis.crypto?.randomUUID === 'function') {
      return globalThis.crypto.randomUUID();
    }

    return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
  }

  private _setState(conversation: Conversation, state: ConversationState): void {
    conversation.metadata.state = state;
    this._touchConversation(conversation);
  }
}
