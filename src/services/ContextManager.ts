import { IAIProvider } from '../providers/IAIProvider';
import { ChatRequest } from '../types/provider';
import {
  Conversation,
  ConversationMessage,
  ConversationState,
} from '../types/conversation';
import { PromptEngine } from './PromptEngine';
import * as vscode from 'vscode';
import { PromptRole } from '../types/prompts';

export interface WorkspaceContext {
  projectRoot: string;
  fileCount: number;
  filesByType: Record<string, number>;
  topLevelDirectories: string[];
  technologies: string[];
  dependencies?: Record<string, string>;
  gitBranch?: string;
  gitStatus?: { modified: number; added: number; deleted: number };
  openFiles: string[];
  hasTests: boolean;
  hasDocumentation: boolean;
}

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
    const currentMessageIds = new Set(messages.map((message) => message.id));

    const merged = [...messages];

    // Iterate in reverse to maintain order when unshifting, or just unshift in correct order?
    // The original code iterated systemMessages and unshifted.
    // If we have Sys1, Sys2. Sys1 is missing. We want [Sys1, ...messages].
    // If we iterate Sys1, Sys2. Sys1 missing -> unshift -> [Sys1, ...]. Sys2 present.
    // Result: [Sys1, ...]. Correct.
    // If multiple missing: Sys1, Sys2 both missing.
    // Sys1 -> unshift -> [Sys1, ...].
    // Sys2 -> unshift -> [Sys2, Sys1, ...].
    // This REVERSES the order of system prompts if unshifted one by one.
    // Original code:
    // systemMessages.forEach((message) => { ... merged.unshift(message); });
    // So if Sys1 and Sys2 are both missing, it would result in Sys2, Sys1.
    // Usually we want preserved order.
    // Better to identify missing ones and unshift them in REVERSE order of appearance (so the first one ends up at top) OR just collect missing ones and prepend them.

    // Let's stick to the "verbatim" instruction if possible, or "logic" of the instruction.
    // Instruction says: "iterate over systemMessages and unshift those whose IDs are not in that set."
    // It doesn't specify order handling, but unshifting in forward loop reverses order.
    // I should probably fix the order too because that's implied "preservation".
    // But the comment specifically says: "iterate over systemMessages and unshift those..."
    // If I iterate in reverse (last to first), unshifting preserves order.
    // Let's try to do it right.

    const missingSystemMessages = systemMessages.filter(msg => !currentMessageIds.has(msg.id));
    // Prepend missing messages to merged
    return [...missingSystemMessages, ...merged];
  }

  // --- Workspace Analysis ---

  private _lastWorkspaceContext?: WorkspaceContext;
  private _lastAnalysisTime: number = 0;
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  async analyzeWorkspace(): Promise<WorkspaceContext | undefined> {
    // Check cache
    if (
      this._lastWorkspaceContext &&
      Date.now() - this._lastAnalysisTime < this.CACHE_TTL
    ) {
      return this._lastWorkspaceContext;
    }

    if (!vscode.workspace.workspaceFolders || vscode.workspace.workspaceFolders.length === 0) {
      return undefined;
    }

    const rootPath = vscode.workspace.workspaceFolders[0].uri.fsPath;

    try {
      const [files, gitStatus, openFiles, metadata] = await Promise.all([
        this._getWorkspaceFiles(),
        this._getGitStatus(),
        this._getOpenFiles(),
        this._getProjectMetadata(rootPath)
      ]);

      const context: WorkspaceContext = {
        projectRoot: rootPath,
        fileCount: files.totalCount,
        filesByType: files.byType,
        topLevelDirectories: files.topDirs,
        technologies: metadata.technologies,
        dependencies: metadata.dependencies,
        gitBranch: gitStatus.branch,
        gitStatus: gitStatus.stats,
        openFiles: openFiles,
        hasTests: files.hasTests,
        hasDocumentation: files.hasDocs
      };

      this._lastWorkspaceContext = context;
      this._lastAnalysisTime = Date.now();

      return context;
    } catch (error) {
      console.error('Workspace analysis failed:', error);
      return undefined;
    }
  }

  formatWorkspaceContextForPrompt(context: WorkspaceContext): string {
    const sections: string[] = [];

    sections.push(`**Project Structure**:
- Root: ${context.projectRoot}
- Files: ${context.fileCount} (by type: ${Object.entries(context.filesByType)
        .map(([ext, count]) => `${ext}: ${count}`)
        .join(', ')})
- Top-level Dirs: ${context.topLevelDirectories.join(', ')}`);

    if (context.technologies.length > 0) {
      sections.push(`**Technologies**: ${context.technologies.join(', ')}`);
    }

    if (context.dependencies && Object.keys(context.dependencies).length > 0) {
      const deps = Object.entries(context.dependencies)
        .slice(0, 15) // Limit to 15 key dependencies to save tokens
        .map(([name, ver]) => `${name}: ${ver}`)
        .join(', ');
      sections.push(`**Key Dependencies**: ${deps}`);
    }

    if (context.gitBranch) {
      const stats = context.gitStatus
        ? `(+${context.gitStatus.added} ~${context.gitStatus.modified} -${context.gitStatus.deleted})`
        : '';
      sections.push(`**Git Status**: Branch '${context.gitBranch}' ${stats}`);
    }

    if (context.openFiles.length > 0) {
      sections.push(`**Open Files**:
${context.openFiles.map((f) => `- ${f}`).join('\n')}`);
    }

    return sections.join('\n\n');
  }

  private async _getWorkspaceFiles(): Promise<{
    totalCount: number;
    byType: Record<string, number>;
    topDirs: string[];
    hasTests: boolean;
    hasDocs: boolean;
  }> {
    // Get configuration
    const config = vscode.workspace.getConfiguration('junkrat.workspace');
    const maxFiles = config.get<number>('maxFiles') || 1000;
    const excludePatterns = config.get<string[]>('excludePatterns') || [
      '**/node_modules/**',
      '**/.git/**',
      '**/dist/**',
      '**/build/**',
      '**/out/**'
    ];

    // Construct glob pattern for exclusion
    const exclude = `{${excludePatterns.join(',')}}`;
    const files = await vscode.workspace.findFiles('**/*', exclude, maxFiles);

    const byType: Record<string, number> = {};
    const topDirs = new Set<string>();
    let hasTests = false;
    let hasDocs = false;

    files.forEach((file) => {
      const path = file.path;
      const ext = path.split('.').pop() || 'no-ext';
      byType[ext] = (byType[ext] || 0) + 1;

      // Get relative path for top-level dirs
      const relative = vscode.workspace.asRelativePath(file);
      const parts = relative.split('/');
      if (parts.length > 1) {
        topDirs.add(parts[0]);
      }

      if (path.includes('.test.') || path.includes('.spec.') || path.includes('/tests/')) {
        hasTests = true;
      }
      if (path.toLowerCase().endsWith('readme.md')) {
        hasDocs = true;
      }
    });

    return {
      totalCount: files.length,
      byType,
      topDirs: Array.from(topDirs).slice(0, 10),
      hasTests,
      hasDocs
    };
  }

  private async _getGitStatus(): Promise<{
    branch?: string;
    stats?: { modified: number; added: number; deleted: number };
  }> {
    try {
      const gitExtension = vscode.extensions.getExtension<any>('vscode.git');
      if (!gitExtension) { return {}; }

      const git = gitExtension.exports.getAPI(1);
      if (!git.repositories.length) { return {}; }

      const repo = git.repositories[0];
      const branch = repo.state.HEAD?.name;

      // Rough count of changes
      const changes = repo.state.workingTreeChanges.concat(repo.state.indexChanges);
      const stats = {
        modified: changes.filter((c: any) => c.status !== 5 && c.status !== 6).length, // 5=Added, 6=Deleted (approx)
        added: changes.filter((c: any) => c.status === 5).length || 0, // 5 is Untracked/Added
        deleted: changes.filter((c: any) => c.status === 6).length || 0
      };

      return { branch, stats };
    } catch (e) {
      return {};
    }
  }

  private _getOpenFiles(): string[] {
    return vscode.workspace.textDocuments
      .filter(doc => !doc.isUntitled && doc.uri.scheme === 'file')
      .map(doc => vscode.workspace.asRelativePath(doc.uri));
  }

  private async _getProjectMetadata(rootPath: string): Promise<{
    technologies: string[];
    dependencies: Record<string, string>;
  }> {
    const techs = new Set<string>();
    const dependencies: Record<string, string> = {};

    // Check package.json
    try {
      const packageJsonUri = vscode.Uri.file(`${rootPath}/package.json`);
      const content = await vscode.workspace.fs.readFile(packageJsonUri);
      const json = JSON.parse(new TextDecoder().decode(content));

      techs.add('Node.js');
      if (json.dependencies) {
        Object.assign(dependencies, json.dependencies);
        if (json.dependencies.react) { techs.add('React'); }
        if (json.dependencies.vue) { techs.add('Vue'); }
        if (json.dependencies.typescript) { techs.add('TypeScript'); }
        if (json.dependencies.express) { techs.add('Express'); }
      }
      if (json.devDependencies) {
        if (json.devDependencies.typescript) { techs.add('TypeScript'); }
      }
    } catch (e) {
      // Ignore if not found
    }

    // Check other files for hints
    const files = await vscode.workspace.findFiles('{tsconfig.json,Cargo.toml,go.mod,pom.xml,requirements.txt}', '**/node_modules/**', 1);
    files.forEach(f => {
      if (f.fsPath.endsWith('tsconfig.json')) { techs.add('TypeScript'); }
      if (f.fsPath.endsWith('Cargo.toml')) { techs.add('Rust'); }
      if (f.fsPath.endsWith('go.mod')) { techs.add('Go'); }
      if (f.fsPath.endsWith('pom.xml')) { techs.add('Java'); }
      if (f.fsPath.endsWith('requirements.txt')) { techs.add('Python'); }
    });

    return {
      technologies: Array.from(techs),
      dependencies
    };
  }
}
