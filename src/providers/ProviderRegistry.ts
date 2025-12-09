import { IAIProvider } from './IAIProvider';

export class ProviderRegistry {
  private _providers: Map<string, IAIProvider> = new Map();
  private _activeProviderId: string | undefined;

  constructor() {
    // Initialize with empty registry
  }

  register(provider: IAIProvider): void {
    this._providers.set(provider.id, provider);

    // Set as active if it's the first provider
    if (!this._activeProviderId) {
      this._activeProviderId = provider.id;
    }
  }

  unregister(providerId: string): boolean {
    const removed = this._providers.delete(providerId);

    if (removed && this._activeProviderId === providerId) {
      // If the active provider was removed, set active to first available or undefined
      this._activeProviderId = this._providers.keys().next().value || undefined;
    }

    return removed;
  }

  getProvider(providerId?: string): IAIProvider | undefined {
    if (providerId) {
      return this._providers.get(providerId);
    }

    return this._activeProviderId ? this._providers.get(this._activeProviderId) : undefined;
  }

  setActiveProvider(providerId: string): void {
    if (!this._providers.has(providerId)) {
      throw new Error(`Provider not found: ${providerId}`);
    }

    this._activeProviderId = providerId;
  }

  getActiveProvider(): IAIProvider | undefined {
    return this._activeProviderId ? this._providers.get(this._activeProviderId) : undefined;
  }

  listProviders(): string[] {
    return Array.from(this._providers.keys());
  }

  hasProvider(providerId: string): boolean {
    return this._providers.has(providerId);
  }

  clear(): void {
    this._providers.clear();
    this._activeProviderId = undefined;
  }
}
