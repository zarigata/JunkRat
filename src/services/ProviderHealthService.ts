import * as vscode from 'vscode';
import { ProviderId } from '../types/configuration';
import { ProviderRegistry } from '../providers/ProviderRegistry';

export interface ProviderStatus {
    id: ProviderId;
    available: boolean;
    lastChecked: number;
    error?: string;
    capabilities?: {
        streaming: boolean;
        vision: boolean;
        localModel: boolean;
    };
}

export interface ProviderHealthCheckResult {
    providerId: ProviderId;
    healthy: boolean;
    responseTime?: number;
    error?: string;
}

/**
 * Service for monitoring provider health and availability
 * Implements background health checks with caching to avoid excessive API calls
 */
export class ProviderHealthService implements vscode.Disposable {
    private _statusCache: Map<ProviderId, ProviderStatus> = new Map();
    private _healthCheckInterval?: NodeJS.Timeout;
    private _isMonitoring: boolean = false;
    private readonly _cacheTimeout: number = 30000; // 30 seconds
    private readonly _monitoringInterval: number = 60000; // 1 minute

    private readonly _onDidChangeProviderStatus = new vscode.EventEmitter<ProviderStatus>();
    public readonly onDidChangeProviderStatus = this._onDidChangeProviderStatus.event;

    constructor(
        private readonly _providerRegistry: ProviderRegistry
    ) { }

    /**
     * Detect all available providers
     * Returns cached results if within cache timeout
     */
    async detectAvailableProviders(): Promise<ProviderStatus[]> {
        const providerIds: ProviderId[] = ['ollama', 'gemini', 'openrouter', 'custom', 'gemini-cli'];
        const statuses: ProviderStatus[] = [];

        for (const providerId of providerIds) {
            const status = await this.getProviderStatus(providerId);
            statuses.push(status);
        }

        return statuses;
    }

    /**
     * Get status for a specific provider
     * Uses cache if available and fresh
     */
    async getProviderStatus(providerId: ProviderId): Promise<ProviderStatus> {
        const cached = this._statusCache.get(providerId);
        const now = Date.now();

        // Return cached if fresh
        if (cached && (now - cached.lastChecked) < this._cacheTimeout) {
            return cached;
        }

        // Perform fresh health check
        const result = await this.checkProviderHealth(providerId);
        const status: ProviderStatus = {
            id: providerId,
            available: result.healthy,
            lastChecked: now,
            error: result.error,
            capabilities: this._getProviderCapabilities(providerId),
        };

        this._statusCache.set(providerId, status);
        this._onDidChangeProviderStatus.fire(status);

        return status;
    }

    /**
     * Check if a specific provider is healthy
     * Returns detailed health check result
     */
    async checkProviderHealth(providerId: ProviderId): Promise<ProviderHealthCheckResult> {
        const startTime = Date.now();

        try {
            // Check if provider is registered
            const provider = this._providerRegistry.getProvider(providerId);
            if (!provider) {
                return {
                    providerId,
                    healthy: false,
                    error: 'Provider not registered',
                };
            }

            // Check provider availability
            const isAvailable = await provider.isAvailable();
            const responseTime = Date.now() - startTime;

            return {
                providerId,
                healthy: isAvailable,
                responseTime,
            };
        } catch (error) {
            return {
                providerId,
                healthy: false,
                responseTime: Date.now() - startTime,
                error: error instanceof Error ? error.message : 'Unknown error',
            };
        }
    }

    /**
     * Get the best available provider based on priority and health
     * Priority: ollama > gemini > openrouter > custom > gemini-cli
     */
    async getBestAvailableProvider(): Promise<ProviderId | null> {
        const priorityOrder: ProviderId[] = ['ollama', 'gemini', 'openrouter', 'custom', 'gemini-cli'];

        for (const providerId of priorityOrder) {
            const status = await this.getProviderStatus(providerId);
            if (status.available) {
                return providerId;
            }
        }

        return null;
    }

    /**
     * Get all available providers in priority order
     */
    async getAvailableProviders(): Promise<ProviderId[]> {
        const statuses = await this.detectAvailableProviders();
        const priorityOrder: ProviderId[] = ['ollama', 'gemini', 'openrouter', 'custom', 'gemini-cli'];

        return priorityOrder.filter(id => {
            const status = statuses.find(s => s.id === id);
            return status?.available ?? false;
        });
    }

    /**
     * Start background health monitoring
     * Periodically checks all providers and emits status changes
     */
    startHealthMonitoring(): void {
        if (this._isMonitoring) {
            return;
        }

        this._isMonitoring = true;

        // Initial check
        void this.detectAvailableProviders();

        // Set up periodic checks
        this._healthCheckInterval = setInterval(() => {
            void this.detectAvailableProviders();
        }, this._monitoringInterval);
    }

    /**
     * Stop background health monitoring
     */
    stopHealthMonitoring(): void {
        if (this._healthCheckInterval) {
            clearInterval(this._healthCheckInterval);
            this._healthCheckInterval = undefined;
        }
        this._isMonitoring = false;
    }

    /**
     * Clear the status cache
     * Forces fresh health checks on next request
     */
    clearCache(): void {
        this._statusCache.clear();
    }

    /**
     * Get provider capabilities based on provider type
     */
    private _getProviderCapabilities(providerId: ProviderId): ProviderStatus['capabilities'] {
        switch (providerId) {
            case 'ollama':
                return {
                    streaming: true,
                    vision: true,
                    localModel: true,
                };
            case 'gemini':
            case 'gemini-cli':
                return {
                    streaming: true,
                    vision: true,
                    localModel: false,
                };
            case 'openrouter':
                return {
                    streaming: true,
                    vision: true,
                    localModel: false,
                };
            case 'custom':
                return {
                    streaming: true,
                    vision: false,
                    localModel: false,
                };
            default:
                return {
                    streaming: false,
                    vision: false,
                    localModel: false,
                };
        }
    }

    /**
     * Dispose of resources
     */
    dispose(): void {
        this.stopHealthMonitoring();
        this._onDidChangeProviderStatus.dispose();
        this._statusCache.clear();
    }
}
