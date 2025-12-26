export enum ConversationState {
  IDLE = 'IDLE',
  GATHERING_REQUIREMENTS = 'GATHERING_REQUIREMENTS',
  ANALYZING_REQUIREMENTS = 'ANALYZING_REQUIREMENTS',
  GENERATING_PHASES = 'GENERATING_PHASES',
  COMPLETE = 'COMPLETE',
  ERROR = 'ERROR',
}

export interface ConversationMetadata {
  id: string;
  title: string;
  state: ConversationState;
  createdAt: number;
  updatedAt: number;
  phaseCount?: number;
  requirementsSummary?: string;
  lastMessagePreview?: string; // First 100 chars of last message
  messageCount?: number; // Total message count
  tags?: string[]; // User-defined tags for organization
  lastModified?: number; // Alias for updatedAt for consistency
}

export type ConversationMessageRole = 'user' | 'assistant' | 'system';

/**
 * A single actionable task within a phase, designed to be completable in one AI prompt
 */
export interface PhaseTask {
  id: string;
  title: string;
  goal: string;
  files: string[];
  instructions: string[];
  acceptance_criteria: string[];
  status: 'pending' | 'in-progress' | 'completed';
}

export interface Phase {
  id: string;
  title: string;
  description: string;
  order: number;
  estimatedComplexity?: 'low' | 'medium' | 'high';
  dependencies: string[];
  tags: string[];
  files: string[];
  tasks?: PhaseTask[];
  status: 'pending' | 'in-progress' | 'completed' | 'verified';
}

export interface PhasePlanMetadata {
  estimatedDuration?: string;
  complexity: 'simple' | 'moderate' | 'complex' | 'very-complex';
  technologies: string[];
}

export interface PhasePlan {
  id: string;
  conversationId: string;
  title: string;
  description: string;
  phases: Phase[];
  totalPhases: number;
  createdAt: number;
  metadata: PhasePlanMetadata;
}

export interface ConversationMessageMetadata {
  tokenCount?: number;
  isSystemPrompt?: boolean;
  isSummary?: boolean;
  phaseData?: PhasePlan;
  templateId?: string;
  [key: string]: unknown;
}

export interface ConversationMessage {
  id: string;
  role: ConversationMessageRole;
  content: string;
  timestamp: number;
  metadata?: ConversationMessageMetadata;
}

export interface Conversation {
  metadata: ConversationMetadata;
  messages: ConversationMessage[];
  summary?: string;
  phasePlan?: PhasePlan;
}
