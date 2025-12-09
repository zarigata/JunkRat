import { ConversationState } from './conversation';

export enum PromptRole {
  REQUIREMENT_GATHERER = 'REQUIREMENT_GATHERER',
  REQUIREMENT_ANALYZER = 'REQUIREMENT_ANALYZER',
  PHASE_PLANNER = 'PHASE_PLANNER',
  SUMMARIZER = 'SUMMARIZER',
}

export interface PromptTemplate {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  userPromptTemplate?: string;
  variables: string[];
}

export interface PromptContext {
  conversationState: ConversationState;
  requirements?: string;
  projectType?: string;
  technologies?: string[];
  complexity?: string;
  additionalContext: Record<string, unknown>;
  [key: string]: unknown;
}

export interface RenderedPromptMetadata {
  templateId: string;
  renderedAt: number;
  estimatedTokens?: number;
}

export interface RenderedPrompt {
  systemMessage: string;
  userMessage?: string;
  role: PromptRole;
  metadata: RenderedPromptMetadata;
}
