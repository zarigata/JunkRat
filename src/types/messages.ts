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

export interface TriggerPhaseGenerationMessage {
  type: 'triggerPhaseGeneration';
}



export interface VerifyAllPhasesMessage {
  type: 'verifyAllPhases';
}

export interface RequestPhaseProgressMessage {
  type: 'requestPhaseProgress';
}

export interface RetryLastRequestMessage {
  type: 'retryLastRequest';
}

export interface SwitchProviderAndRetryMessage {
  type: 'switchProviderAndRetry';
  payload: {
    providerId: string;
  };
}

export interface RefreshModelsMessage {
  type: 'refreshModels';
  payload: {
    providerId?: string;
  };
}

export interface NextActionSuggestionsMessage {
  type: 'nextActionSuggestions';
  payload: {
    suggestions: string[];
  };
}

export interface NoProvidersReadyMessage {
  type: 'noProvidersReady';
  payload: {
    message: string;
    showOnboarding: boolean;
    allowSkip?: boolean;
  };
}

export interface OnboardingActionMessage {
  type: 'onboardingAction';
  payload: {
    action: string;
    timestamp: number;
    context?: Record<string, any>;
  };
}

export interface TestOllamaConnectionMessage {
  type: 'testOllamaConnection';
}

export interface OpenExternalLinkMessage {
  type: 'openExternalLink';
  payload: {
    url: string;
  };
}

export interface ExportAllConversationsMessage {
  type: 'exportAllConversations';
  payload: {
    format: 'json' | 'markdown';
  };
}

export interface AnalyzeWorkspaceMessage {
  type: 'analyzeWorkspace';
}

export interface WorkspaceAnalyzedMessage {
  type: 'workspaceAnalyzed';
  context: import('../services/ContextManager').WorkspaceContext;
  summary: string;
}

export interface ScanGitProgressMessage {
  type: 'scanGitProgress';
  payload: {
    dryRun: boolean;
  };
}

export interface RunAndAnalyzeMessage {
  type: 'runAndAnalyze';
  payload: {
    phaseId?: string; // Optional: analyze specific phase
    command?: string; // Optional: override default command
  };
}

export interface RunAnalysisCompleteMessage {
  type: 'runAnalysisComplete';
  payload: {
    success: boolean;
    exitCode: number;
    stdout: string;
    stderr: string;
    duration: number; // milliseconds
    command: string;
    analysis?: {
      summary: string;
      affectedPhases: Array<{
        phaseId: string;
        status: 'passed' | 'failed' | 'skipped';
        reason: string;
      }>;
      suggestions: string[];
    };
  };
}

export interface GitScanCompleteMessage {
  type: 'gitScanComplete';
  payload: {
    updated: number;
    results: Array<{
      phaseId: string;
      matchedCommits: Array<{
        hash: string;
        message: string;
        author: string;
        date: Date; // or string if serialized
        files: string[];
      }>;
      confidence: number;
    }>;
  };
}

export interface ToggleAutonomousModeMessage {
  type: 'toggleAutonomousMode';
  payload: {
    enabled: boolean;
    prompt?: string;
  };
}

export interface StopAutonomousModeMessage {
  type: 'stopAutonomousMode';
}

export interface PauseAutonomousModeMessage {
  type: 'pauseAutonomousMode';
}

export interface ResumeAutonomousModeMessage {
  type: 'resumeAutonomousMode';
}

export interface AutonomousProgressMessage {
  type: 'autonomousProgress';
  payload: {
    currentIteration: number;
    maxIterations: number;
    currentPhaseId?: string;
    currentTaskId?: string;
    completedTasks: number;
    totalTasks: number;
    status: 'running' | 'paused' | 'stopped' | 'completed' | 'error';
  };
}

export interface AutonomousCompleteMessage {
  type: 'autonomousComplete';
  payload: {
    success: boolean;
    iterations: number;
  };
}

export interface ProviderHealthStatusMessage {
  type: 'providerHealthStatus';
  payload: {
    statuses: Array<{
      id: string;
      available: boolean;
      lastChecked: number;
      error?: string;
      capabilities?: {
        streaming: boolean;
        vision: boolean;
        localModel: boolean;
      };
    }>;
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

  | DeletePhaseMessage
  | TriggerPhaseGenerationMessage
  | VerifyAllPhasesMessage
  | VerifyAllPhasesMessage
  | RequestPhaseProgressMessage
  | RetryLastRequestMessage
  | SwitchProviderAndRetryMessage
  | RefreshModelsMessage
  | TestOllamaConnectionMessage
  | TestOllamaConnectionMessage
  | OpenExternalLinkMessage
  | ExportAllConversationsMessage
  | ExportAllConversationsMessage
  | AnalyzeWorkspaceMessage
  | ScanGitProgressMessage
  | RunAndAnalyzeMessage
  | OnboardingActionMessage
  | ToggleAutonomousModeMessage
  | StopAutonomousModeMessage
  | PauseAutonomousModeMessage
  | ResumeAutonomousModeMessage
  | WebviewErrorMessage;

export interface WebviewErrorMessage {
  type: 'webviewError';
  payload: {
    message: string;
    source?: string;
    line?: number;
    column?: number;
    stack?: string;
  };
}

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
    errorType?: 'network' | 'timeout' | 'rate_limit' | 'invalid_request' | 'api_error' | 'model_not_found' | 'provider_unavailable';
    retryable: boolean;
    failedProvider?: string;
    suggestedActions?: Array<{
      action: 'retry' | 'switchProvider' | 'refreshModels' | 'openSettings';
      label: string;
      providerId?: string; // For switchProvider action
    }>;
    details?: string; // Technical details for debugging
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
    // Full update fields
    providers?: Array<{
      id: string;
      name: string;
      enabled: boolean;
      available: boolean;
    }>;
    activeProviderId?: string;

    // Legacy/Single update fields
    providerId?: string;
    available?: boolean;

    // Detailed validation results (optional)
    validationResults?: Record<
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
  | PhaseEditedMessage
  | PhaseDeletedMessage
  | PhaseDeletedMessage
  | PhaseProgressMessage
  | NoProvidersReadyMessage
  | NoProvidersReadyMessage
  | NextActionSuggestionsMessage
  | NextActionSuggestionsMessage
  | WorkspaceAnalyzedMessage
  | GitScanCompleteMessage
  | RunAnalysisCompleteMessage
  | AutonomousProgressMessage
  | AutonomousCompleteMessage
  | ProviderHealthStatusMessage;

export interface PhaseProgressMessage {
  type: 'phaseProgress';
  payload: {
    completed: number;
    verified: number;
    total: number;
  };
}

// Helper types
export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: number;
}
