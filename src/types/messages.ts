import { ConversationMetadata, ConversationState, PhasePlan } from './conversation';

/**
 * Type-safe message protocol for webview-extension communication
 */

// Message types from webview to extension
export interface SendMessageMessage {
  type: 'sendMessage';
  payload: {
    text: string;
  };
}

export interface ReadyMessage {
  type: 'ready';
}

export interface SelectProviderMessage {
  type: 'selectProvider';
  payload: {
    providerId: string;
  };
}

export interface RequestProviderListMessage {
  type: 'requestProviderList';
}

export interface RequestConfigurationStatusMessage {
  type: 'requestConfigurationStatus';
}

export interface OpenSettingsMessage {
  type: 'openSettings';
  payload?: {
    settingId?: string;
  };
}

export interface OpenNativeSettingsMessage {
  type: 'openNativeSettings';
}

export interface TestProviderMessage {
  type: 'testProvider';
  payload: {
    providerId: string;
  };
}

export interface ValidateAllMessage {
  type: 'validateAll';
}

export interface RequestProviderStatusMessage {
  type: 'requestProviderStatus';
}

export interface RequestPhasePlanMessage {
  type: 'requestPhasePlan';
  payload: {
    conversationId?: string;
  };
}

export interface RegeneratePhasePlanMessage {
  type: 'regeneratePhasePlan';
  payload: {
    conversationId?: string;
  };
}

export interface ExportPhasePlanMessage {
  type: 'exportPhasePlan';
  payload: {
    format: 'markdown' | 'json';
    conversationId?: string;
  };
}

export interface RequestModelListMessage {
  type: 'requestModelList';
}

export interface SelectModelMessage {
  type: 'selectModel';
  payload: {
    modelName: string;
  };
}

export interface RequestConversationListMessage {
  type: 'requestConversationList';
}

export interface LoadConversationMessage {
  type: 'loadConversation';
  payload: {
    conversationId: string;
  };
}

export interface DeleteConversationMessage {
  type: 'deleteConversation';
  payload: {
    conversationId: string;
  };
}

export interface ExportConversationToFileMessage {
  type: 'exportConversationToFile';
  payload: {
    conversationId: string;
    format: 'json' | 'markdown';
  };
}

export interface ExportPhasePlanToFileMessage {
  type: 'exportPhasePlanToFile';
  payload: {
    conversationId?: string;
    format: 'markdown' | 'json';
  };
}

export interface RenameConversationMessage {
  type: 'renameConversation';
  payload: {
    conversationId: string;
    newTitle: string;
  };
}

export interface NewChatMessage {
  type: 'newChat';
}

export interface ClearChatRequestMessage {
  type: 'clearChat';
}

export interface VerifyPhaseMessage {
  type: 'verifyPhase';
  payload: {
    phaseId: string;
    conversationId?: string;
  };
}

export interface UpdateTaskStatusMessage {
  type: 'updateTaskStatus';
  payload: {
    phaseId: string;
    taskId: string;
    status: 'pending' | 'in-progress' | 'completed';
    conversationId?: string;
  };
}

export interface PhaseStatusUpdatedMessage {
  type: 'phaseStatusUpdated';
  payload: {
    phaseId: string;
    status: 'pending' | 'in-progress' | 'completed' | 'verified';
    conversationId: string;
  };
}

export interface ShowHistoryMessage {
  type: 'showHistory';
}

export interface AddPhaseMessage {
  type: 'addPhase';
  payload: {
    conversationId: string;
    afterPhaseId: string | null;
    userPrompt: string;
  };
}

export interface EditPhaseMessage {
  type: 'editPhase';
  payload: {
    conversationId: string;
    phaseId: string;
    updates: {
      title?: string;
      description?: string;
      estimatedComplexity?: 'low' | 'medium' | 'high';
      tags?: string[];
      files?: string[];
    };
  };
}

export interface DeletePhaseMessage {
  type: 'deletePhase';
  payload: {
    conversationId: string;
    phaseId: string;
  };
}

export interface PhaseAddedMessage {
  type: 'phaseAdded';
  payload: {
    phasePlan: PhasePlan;
    conversationId: string;
  };
}

export interface PhaseEditedMessage {
  type: 'phaseEdited';
  payload: {
    phasePlan: PhasePlan;
    conversationId: string;
  };
}

export interface PhaseDeletedMessage {
  type: 'phaseDeleted';
  payload: {
    phasePlan: PhasePlan;
    conversationId: string;
  };
}

export type WebviewMessage =
  | SendMessageMessage
  | ReadyMessage
  | SelectProviderMessage
  | RequestProviderListMessage
  | RequestConfigurationStatusMessage
  | OpenSettingsMessage
  | OpenNativeSettingsMessage
  | TestProviderMessage
  | ValidateAllMessage
  | RequestProviderStatusMessage
  | RequestPhasePlanMessage
  | RegeneratePhasePlanMessage
  | ExportPhasePlanMessage
  | RequestModelListMessage
  | SelectModelMessage
  | RequestConversationListMessage
  | LoadConversationMessage
  | DeleteConversationMessage
  | ExportConversationToFileMessage
  | RenameConversationMessage
  | NewChatMessage
  | ClearChatRequestMessage
  | ShowHistoryMessage
  | VerifyPhaseMessage
  | UpdateTaskStatusMessage
  | ExportPhasePlanToFileMessage
  | ExecuteTaskInGeminiCLIMessage
  | HandoffTaskToToolMessage
  | HandoffPlanToToolMessage
  | AddPhaseMessage
  | EditPhaseMessage
  | DeletePhaseMessage;

export interface ExecuteTaskInGeminiCLIMessage {
  type: 'executeTaskInGeminiCLI';
  payload: {
    task: {
      id: string;
      title: string;
      goal: string;
      files: string[];
      instructions: string[];
      acceptance_criteria: string[];
    };
    phaseTitle: string;
  };
}

export interface HandoffTaskToToolMessage {
  type: 'handoffTaskToTool';
  payload: {
    task: {
      id: string;
      title: string;
      goal: string;
      files: string[];
      instructions: string[];
      acceptance_criteria: string[];
    };
    phaseTitle: string;
    toolName: 'roo-code' | 'windsurf' | 'aider' | 'cursor' | 'continue';
  };
}

export interface HandoffPlanToToolMessage {
  type: 'handoffPlanToTool';
  payload: {
    conversationId?: string;
    toolName: 'roo-code' | 'windsurf' | 'aider' | 'cursor' | 'continue';
  };
}

// Message types from extension to webview
export interface UserMessageMessage {
  type: 'userMessage';
  payload: ChatMessage;
}

export interface AssistantMessageMessage {
  type: 'assistantMessage';
  payload: ChatMessage;
}

export interface ErrorMessage {
  type: 'error';
  payload: {
    error: string;
  };
}

export interface ClearChatMessage {
  type: 'clearChat';
}

export interface ProviderListMessage {
  type: 'providerList';
  payload: {
    providers: Array<{
      id: string;
      name: string;
      enabled: boolean;
      available: boolean;
    }>;
    activeProviderId: string;
  };
}

export interface ProviderChangedMessage {
  type: 'providerChanged';
  payload: {
    providerId: string;
    providerName: string;
  };
}

export interface ConfigurationStatusMessage {
  type: 'configurationStatus';
  payload: {
    validationResults: Record<
      string,
      {
        valid: boolean;
        errors: string[];
        warnings: string[];
      }
    >;
    activeProvider: string;
  };
}

export interface ProviderStatusUpdateMessage {
  type: 'providerStatusUpdate';
  payload: {
    providers: Array<{
      id: string;
      name: string;
      enabled: boolean;
      available: boolean;
      validation: {
        valid: boolean;
        errors: string[];
        warnings: string[];
      };
    }>;
    validationResults: Record<
      string,
      {
        valid: boolean;
        errors: string[];
        warnings: string[];
        available: boolean;
      }
    >;
  };
}

export interface PhasePlanMessage {
  type: 'phasePlan';
  payload: {
    plan: PhasePlan;
    formattedMarkdown: string;
    conversationId: string;
  };
}

export interface ConversationStateMessage {
  type: 'conversationState';
  payload: {
    state: ConversationState;
    conversationId: string;
    metadata: ConversationMetadata;
  };
}

export interface ValidationResultMessage {
  type: 'validationResult';
  payload: {
    validationResults: Record<
      string,
      {
        valid: boolean;
        errors: string[];
        warnings: string[];
        available: boolean;
      }
    >;
    message?: {
      severity: 'success' | 'warning' | 'error';
      text: string;
    };
  };
}

export interface ModelInfo {
  name: string;
  size: number;
  isRunning?: boolean;
  family?: string;
  parameterSize?: string;
}

export interface ModelListMessage {
  type: 'modelList';
  payload: {
    models: ModelInfo[];
    activeModel: string;
    providerId: string;
  };
}

export interface ModelChangedMessage {
  type: 'modelChanged';
  payload: {
    modelName: string;
  };
}

export interface ConversationListMessage {
  type: 'conversationList';
  payload: {
    conversations: ConversationMetadata[];
    activeConversationId: string | undefined;
  };
}

export interface ConversationLoadedMessage {
  type: 'conversationLoaded';
  payload: {
    conversationId: string;
    metadata: ConversationMetadata;
  };
}

export interface ConversationDeletedMessage {
  type: 'conversationDeleted';
  payload: {
    conversationId: string;
  };
}

export type ExtensionMessage =
  | UserMessageMessage
  | AssistantMessageMessage
  | ErrorMessage
  | ClearChatMessage
  | ProviderListMessage
  | ProviderChangedMessage
  | ConfigurationStatusMessage
  | ProviderStatusUpdateMessage
  | ValidationResultMessage
  | PhasePlanMessage
  | ConversationStateMessage
  | ModelListMessage
  | ModelChangedMessage
  | ConversationListMessage
  | ConversationLoadedMessage
  | ConversationDeletedMessage
  | PhaseStatusUpdatedMessage
  | PhaseAddedMessage
  | PhaseEditedMessage
  | PhaseDeletedMessage;

// Helper types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
}
