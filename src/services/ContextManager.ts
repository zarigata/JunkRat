import { IAIProvider } from '../providers/IAIProvider';
import { ChatRequest } from '../types/provider';
import {
  Conversation,
  ConversationMessage,
  ConversationState,
} from '../types/conversation';
import { PromptEngine } from './PromptEngine';
import { PromptRole } from '../types/prompts';

interface ContextManagerConfig {
  maxContextTokens?: number;
  summaryTriggerThreshold?: number;
  slidingWindowSize?: number;
}

export interface ContextStats {
  totalMessages: number;
  totalTokens: number;
  utilizationPercent: number;
  needsSummarization: boolean;
  messagesInWindow: number;
}

export class ContextManager {
  private _maxContextTokens: number;
  private _summaryTriggerThreshold: number;
  private _slidingWindowSize: number;
  private _currentState: ConversationState = ConversationState.IDLE;

  constructor(
    private readonly _promptEngine: PromptEngine,
    config: ContextManagerConfig = {}
  ) {
    this._maxContextTokens = config.maxContextTokens ?? 4000;
    this._summaryTriggerThreshold = config.summaryTriggerThreshold ?? 0.7;
    this._slidingWindowSize = config.slidingWindowSize ?? 10;
  }

  estimateTokenCount(messages: ConversationMessage[]): number {
    const total = messages.reduce((sum, message) => {
      if (message.metadata?.tokenCount !== undefined) {
        return sum + message.metadata.tokenCount + 10;
      }

      const tokens = this._estimateMessageTokens(message);
      message.metadata = {
        ...message.metadata,
        tokenCount: tokens,
      };

      return sum + tokens + 10;
    }, 0);

    return total;
  }

  shouldSummarize(messages: ConversationMessage[]): boolean {
    const totalTokens = this.estimateTokenCount(messages);
    return totalTokens > this._maxContextTokens * this._summaryTriggerThreshold;
  }

  async summarizeConversation(
    messages: ConversationMessage[],
    provider: IAIProvider
  ): Promise<string> {
    const rendered = this._promptEngine.renderPrompt(PromptRole.SUMMARIZER, {
      conversationState: this._currentState,
      additionalContext: {},
    });

    const historyText = messages
      .filter((message) => message.role !== 'system')
      .map((message) => `${message.role.toUpperCase()}: ${message.content}`)
      .join('\n\n');

    const request: ChatRequest = {
      messages: [
        { role: 'system', content: rendered.systemMessage },
        { role: 'user', content: historyText },
      ],
      model: undefined,
      temperature: undefined,
      maxTokens: undefined,
      stream: false,
      signal: undefined,
    };

    const response = await provider.chat(request);
    return response.content;
  }

  trimContext(
    messages: ConversationMessage[],
    summary: string | undefined
  ): ConversationMessage[] {
    if (summary) {
      const summaryMessage: ConversationMessage = {
        id: 'conversation-summary',
        role: 'system',
        content: summary,
        timestamp: Date.now(),
        metadata: {
          isSummary: true,
          isSystemPrompt: true,
        },
      };

      const recentMessages = messages.slice(-this._slidingWindowSize);
      return [summaryMessage, ...recentMessages];
    }

    return messages.slice(-(this._slidingWindowSize * 2));
  }

  async buildContextForRequest(
    conversation: Conversation,
    provider: IAIProvider
  ): Promise<ConversationMessage[]> {
    this._currentState = conversation.metadata.state;

    let messages = [...conversation.messages];

    if (this.shouldSummarize(messages)) {
      const summary = await this.summarizeConversation(messages, provider);
      conversation.summary = summary;
      messages = this.trimContext(messages, summary);
    }

    const finalMessages = this._ensureSystemPromptsPreserved(messages, conversation);

    return finalMessages;
  }

  configureForProvider(providerId: string): void {
    if (providerId === 'ollama') {
      this._maxContextTokens = 4000;
    } else if (providerId === 'gemini') {
      this._maxContextTokens = 100000;
    } else if (providerId === 'openrouter') {
      this._maxContextTokens = 8000;
    } else {
      this._maxContextTokens = 4000;
    }
  }

  getContextStats(messages: ConversationMessage[]): ContextStats {
    const totalTokens = this.estimateTokenCount(messages);
    const needsSummarization = totalTokens > this._maxContextTokens * this._summaryTriggerThreshold;

    return {
      totalMessages: messages.length,
      totalTokens,
      utilizationPercent: Math.min(100, (totalTokens / this._maxContextTokens) * 100),
      needsSummarization,
      messagesInWindow: Math.min(messages.length, this._slidingWindowSize),
    };
  }

  private _estimateMessageTokens(message: ConversationMessage): number {
    const contentTokens = Math.ceil(message.content.length / 4);
    return contentTokens + 5;
  }

  private _ensureSystemPromptsPreserved(
    messages: ConversationMessage[],
    conversation: Conversation
  ): ConversationMessage[] {
    const systemMessages = conversation.messages.filter((message) => message.role === 'system');
    const preservedIds = new Set(systemMessages.map((message) => message.id));

    const merged = [...messages];

    systemMessages.forEach((message) => {
      if (!preservedIds.has(message.id)) {
        merged.unshift(message);
      }
    });

    return merged;
  }
}
