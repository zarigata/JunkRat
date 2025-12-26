import * as vscode from 'vscode';
import { Conversation, ConversationMetadata, PhasePlan } from '../types/conversation';
import { PhasePlanFormatter } from './PhasePlanFormatter';

/**
 * Storage keys for VS Code globalState
 */
const STORAGE_KEYS = {
    CONVERSATIONS: 'junkrat.conversations',
    ACTIVE_CONVERSATION_ID: 'junkrat.activeConversationId',
    PHASE_PLANS: 'junkrat.phasePlans',
} as const;

/**
 * Service for persisting conversation data using VS Code's globalState API
 */
export class StorageService {
    constructor(private readonly context: vscode.ExtensionContext) { }

    /**
     * Save a single conversation to storage
     */
    async saveConversation(conversation: Conversation): Promise<void> {
        try {
            const conversations = await this._loadConversationsMap();
            conversations[conversation.metadata.id] = conversation;
            await this.context.globalState.update(STORAGE_KEYS.CONVERSATIONS, conversations);
            console.log(`[StorageService] Saved conversation ${conversation.metadata.id}`);
        } catch (error) {
            console.error(`[StorageService] Failed to save conversation ${conversation.metadata.id}:`, error);
            throw new Error(`Failed to save conversation: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Load a single conversation by ID
     */
    async loadConversation(conversationId: string): Promise<Conversation | undefined> {
        try {
            const conversations = await this._loadConversationsMap();
            return conversations[conversationId];
        } catch (error) {
            console.error(`[StorageService] Failed to load conversation ${conversationId}:`, error);
            return undefined;
        }
    }

    /**
     * Load all saved conversations
     */
    async loadAllConversations(): Promise<Conversation[]> {
        try {
            const conversations = await this._loadConversationsMap();
            return Object.values(conversations);
        } catch (error) {
            console.error('[StorageService] Failed to load all conversations:', error);
            return [];
        }
    }

    /**
     * Delete a conversation from storage
     */
    async deleteConversation(conversationId: string): Promise<boolean> {
        try {
            const conversations = await this._loadConversationsMap();
            if (!conversations[conversationId]) {
                return false;
            }
            delete conversations[conversationId];
            await this.context.globalState.update(STORAGE_KEYS.CONVERSATIONS, conversations);

            // Clear active conversation if it was deleted
            const activeId = await this.getActiveConversationId();
            if (activeId === conversationId) {
                await this.setActiveConversationId(undefined);
            }

            console.log(`[StorageService] Deleted conversation ${conversationId}`);
            return true;
        } catch (error) {
            console.error(`[StorageService] Failed to delete conversation ${conversationId}:`, error);
            return false;
        }
    }

    /**
     * Get lightweight metadata for all conversations
     */
    async listConversationMetadata(): Promise<ConversationMetadata[]> {
        try {
            const conversations = await this.loadAllConversations();
            return conversations.map(conv => this._extractMetadata(conv));
        } catch (error) {
            console.error('[StorageService] Failed to list conversation metadata:', error);
            return [];
        }
    }

    /**
     * Set the active conversation ID
     */
    async setActiveConversationId(id: string | undefined): Promise<void> {
        try {
            await this.context.globalState.update(STORAGE_KEYS.ACTIVE_CONVERSATION_ID, id);
            console.log(`[StorageService] Set active conversation ID to ${id}`);
        } catch (error) {
            console.error('[StorageService] Failed to set active conversation ID:', error);
            throw error;
        }
    }

    /**
     * Get the active conversation ID
     */
    async getActiveConversationId(): Promise<string | undefined> {
        try {
            return this.context.globalState.get<string>(STORAGE_KEYS.ACTIVE_CONVERSATION_ID);
        } catch (error) {
            console.error('[StorageService] Failed to get active conversation ID:', error);
            return undefined;
        }
    }

    /**
     * Export a conversation to a file
     */
    async exportPhasePlanToFile(conversationId: string, format: 'json' | 'markdown'): Promise<void> {
        try {
            let phasePlan: PhasePlan | undefined;

            // Try loading from conversation first (most up-to-date)
            const conversation = await this.loadConversation(conversationId);
            if (conversation?.phasePlan) {
                phasePlan = conversation.phasePlan;
            } else {
                // Fallback to separate phase plan storage
                phasePlan = await this.loadPhasePlan(conversationId);
            }

            if (!phasePlan) {
                throw new Error(`Phase plan for conversation ${conversationId} not found`);
            }

            const filename = this._generatePhasePlanExportFilename(phasePlan, format);
            const uri = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.file(filename),
                filters: {
                    'JSON': ['json'],
                    'Markdown': ['md'],
                },
            });

            if (!uri) {
                return; // User cancelled
            }

            let content: string;
            if (format === 'json') {
                content = PhasePlanFormatter.toJSON(phasePlan, true);
            } else {
                content = PhasePlanFormatter.toMarkdown(phasePlan);
            }

            await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf-8'));
            vscode.window.showInformationMessage(`Phase plan exported to ${uri.fsPath}`);
            console.log(`[StorageService] Exported phase plan for ${conversationId} to ${uri.fsPath}`);
        } catch (error) {
            console.error(`[StorageService] Failed to export phase plan for ${conversationId}:`, error);
            vscode.window.showErrorMessage(`Failed to export phase plan: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Export a conversation to a file
     */
    async exportConversationToFile(conversationId: string, format: 'json' | 'markdown'): Promise<void> {
        try {
            const conversation = await this.loadConversation(conversationId);
            if (!conversation) {
                throw new Error(`Conversation ${conversationId} not found`);
            }

            const filename = this._generateExportFilename(conversation, format);
            const uri = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.file(filename),
                filters: {
                    'JSON': ['json'],
                    'Markdown': ['md'],
                },
            });

            if (!uri) {
                return; // User cancelled
            }

            let content: string;
            if (format === 'json') {
                content = JSON.stringify(conversation, null, 2);
            } else {
                content = this._conversationToMarkdown(conversation);
            }

            await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf-8'));
            vscode.window.showInformationMessage(`Conversation exported to ${uri.fsPath}`);
            console.log(`[StorageService] Exported conversation ${conversationId} to ${uri.fsPath}`);
        } catch (error) {
            console.error(`[StorageService] Failed to export conversation ${conversationId}:`, error);
            vscode.window.showErrorMessage(`Failed to export conversation: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Clear all stored conversations (for testing/reset)
     */
    async clearAllConversations(): Promise<void> {
        try {
            await this.context.globalState.update(STORAGE_KEYS.CONVERSATIONS, {});
            await this.context.globalState.update(STORAGE_KEYS.ACTIVE_CONVERSATION_ID, undefined);
            await this.context.globalState.update(STORAGE_KEYS.PHASE_PLANS, {});
            console.log('[StorageService] Cleared all conversations');
        } catch (error) {
            console.error('[StorageService] Failed to clear conversations:', error);
            throw error;
        }
    }

    /**
     * Save a phase plan
     */
    async savePhasePlan(conversationId: string, phasePlan: PhasePlan): Promise<void> {
        try {
            const phasePlans = this.context.globalState.get<Record<string, PhasePlan>>(STORAGE_KEYS.PHASE_PLANS, {});
            phasePlans[conversationId] = phasePlan;
            await this.context.globalState.update(STORAGE_KEYS.PHASE_PLANS, phasePlans);
            console.log(`[StorageService] Saved phase plan for conversation ${conversationId}`);
        } catch (error) {
            console.error(`[StorageService] Failed to save phase plan for ${conversationId}:`, error);
        }
    }

    /**
     * Load a phase plan
     */
    async loadPhasePlan(conversationId: string): Promise<PhasePlan | undefined> {
        try {
            const phasePlans = this.context.globalState.get<Record<string, PhasePlan>>(STORAGE_KEYS.PHASE_PLANS, {});
            return phasePlans[conversationId];
        } catch (error) {
            console.error(`[StorageService] Failed to load phase plan for ${conversationId}:`, error);
            return undefined;
        }
    }

    /**
     * Private helper to load conversations map with error handling
     */
    private async _loadConversationsMap(): Promise<Record<string, Conversation>> {
        try {
            const conversations = this.context.globalState.get<Record<string, Conversation>>(STORAGE_KEYS.CONVERSATIONS, {});
            // Validate and migrate if needed
            return this._validateAndMigrateConversations(conversations);
        } catch (error) {
            console.error('[StorageService] Failed to load conversations map, returning empty:', error);
            return {};
        }
    }

    /**
     * Validate and migrate conversations data
     */
    private _validateAndMigrateConversations(conversations: Record<string, Conversation>): Record<string, Conversation> {
        // Basic validation - ensure all conversations have required fields
        const validated: Record<string, Conversation> = {};
        for (const [id, conv] of Object.entries(conversations)) {
            if (conv && conv.metadata && conv.metadata.id && conv.messages && Array.isArray(conv.messages)) {
                validated[id] = conv;
            } else {
                console.warn(`[StorageService] Skipping invalid conversation ${id}`);
            }
        }
        return validated;
    }

    /**
     * Extract metadata from a conversation
     */
    private _extractMetadata(conversation: Conversation): ConversationMetadata {
        const lastMessage = conversation.messages[conversation.messages.length - 1];
        const lastMessagePreview = lastMessage?.content?.substring(0, 100) || '';

        return {
            ...conversation.metadata,
            lastMessagePreview,
            messageCount: conversation.messages.length,
            lastModified: conversation.metadata.updatedAt,
        };
    }

    /**
     * Generate export filename
     */
    private _generateExportFilename(conversation: Conversation, format: string): string {
        const date = new Date(conversation.metadata.createdAt).toISOString().split('T')[0];
        const workspaceName = vscode.workspace.workspaceFolders?.[0]?.name || 'conversation';
        const sanitizedName = workspaceName.replace(/[^a-z0-9]/gi, '-').toLowerCase();
        return `junkrat-${sanitizedName}-${date}-${conversation.metadata.id.substring(0, 8)}.${format}`;
    }

    /**
     * Generate export filename for phase plan
     */
    private _generatePhasePlanExportFilename(plan: PhasePlan, format: string): string {
        const date = new Date(plan.createdAt).toISOString().split('T')[0];
        const workspaceName = vscode.workspace.workspaceFolders?.[0]?.name || 'conversation';
        const sanitizedName = workspaceName.replace(/[^a-z0-9]/gi, '-').toLowerCase();
        return `junkrat-phaseplan-${sanitizedName}-${date}-${plan.id.substring(0, 8)}.${format}`;
    }

    /**
     * Convert conversation to markdown format
     */
    private _conversationToMarkdown(conversation: Conversation): string {
        const lines: string[] = [];
        lines.push(`# JunkRat Conversation Export`);
        lines.push(`**ID:** ${conversation.metadata.id}`);
        lines.push(`**Title:** ${conversation.metadata.title}`);
        lines.push(`**Created:** ${new Date(conversation.metadata.createdAt).toLocaleString()}`);
        lines.push(`**Last Modified:** ${new Date(conversation.metadata.updatedAt).toLocaleString()}`);
        lines.push(`**State:** ${conversation.metadata.state}`);
        lines.push(`**Messages:** ${conversation.messages.length}`);
        lines.push('');
        lines.push('---');
        lines.push('');

        for (const message of conversation.messages) {
            lines.push(`## ${message.role === 'user' ? 'User' : 'Assistant'}`);
            lines.push(`*${new Date(message.timestamp).toLocaleString()}*`);
            lines.push('');
            lines.push(message.content);
            lines.push('');
            lines.push('---');
            lines.push('');
        }

        return lines.join('\n');
    }
}
