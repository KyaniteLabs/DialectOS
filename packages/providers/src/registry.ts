/**
 * Provider registry with automatic failover
 * Manages multiple translation providers and selects available ones
 */

import type { TranslationProvider } from "./types.js";
import { CircuitBreaker } from "./circuit-breaker.js";

interface ProviderEntry {
  provider: TranslationProvider;
  breaker: CircuitBreaker;
}

export class ProviderRegistry {
  private providers = new Map<string, ProviderEntry>();

  constructor(
    private readonly failureThreshold: number = 5,
    private readonly resetTimeoutMs: number = 60000
  ) {}

  /**
   * Register a translation provider
   */
  register(provider: TranslationProvider): void {
    const breaker = new CircuitBreaker(
      this.failureThreshold,
      this.resetTimeoutMs
    );

    this.providers.set(provider.name, { provider, breaker });
  }

  /**
   * Get a specific provider by name
   */
  get(name: string): TranslationProvider {
    const entry = this.providers.get(name);
    if (!entry) {
      throw new Error(`Provider not found: ${name}`);
    }
    return entry.provider;
  }

  /**
   * Get the first available provider (with closed circuit)
   */
  getAuto(): TranslationProvider {
    for (const [_, entry] of this.providers) {
      if (entry.breaker.canExecute()) {
        return entry.provider;
      }
    }

    throw new Error("No available providers - all circuits are open");
  }

  /**
   * Get circuit breaker for a provider
   */
  getBreaker(name: string): CircuitBreaker | undefined {
    return this.providers.get(name)?.breaker;
  }

  /**
   * List all registered provider names
   */
  listProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Check if a provider is available (circuit not open)
   */
  isAvailable(name: string): boolean {
    const entry = this.providers.get(name);
    return entry ? entry.breaker.canExecute() : false;
  }

  /**
   * Record a successful translation for a provider
   */
  recordSuccess(name: string): void {
    const entry = this.providers.get(name);
    if (entry) {
      entry.breaker.recordSuccess();
    }
  }

  /**
   * Record a failed translation for a provider
   */
  recordFailure(name: string): void {
    const entry = this.providers.get(name);
    if (entry) {
      entry.breaker.recordFailure();
    }
  }
}
