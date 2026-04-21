/**
 * Provider registry with automatic failover
 * Manages multiple translation providers and selects available ones
 */

import type { TranslationProvider, ProviderCapability } from "./types.js";
import { CircuitBreaker } from "./circuit-breaker.js";

interface ProviderEntry {
  provider: TranslationProvider;
  breaker: CircuitBreaker;
}

export interface CapabilityValidationError {
  provider: string;
  reason: string;
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
      throw new Error("Provider not available");
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

    throw new Error("No translation providers are currently available");
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
   * Get capabilities for a specific provider
   */
  getCapabilities(name: string): ProviderCapability | null {
    const entry = this.providers.get(name);
    if (!entry) return null;
    return entry.provider.getCapabilities?.() ?? null;
  }

  /**
   * List all providers that support a given target language
   */
  findByTargetLang(targetLang: string): TranslationProvider[] {
    const matches: TranslationProvider[] = [];
    for (const [_, entry] of this.providers) {
      const caps = entry.provider.getCapabilities?.();
      if (caps && caps.supportedTargetLangs.includes(targetLang)) {
        matches.push(entry.provider);
      }
    }
    return matches;
  }

  /**
   * Validate a translation request against provider capabilities.
   * Returns an array of validation errors (empty if valid).
   */
  validateRequest(
    name: string,
    text: string,
    sourceLang: string,
    targetLang: string,
    options?: { formality?: string; dialect?: string }
  ): CapabilityValidationError[] {
    const caps = this.getCapabilities(name);
    if (!caps) {
      return [{ provider: name, reason: "Provider not found or has no capabilities" }];
    }

    const errors: CapabilityValidationError[] = [];

    if (text.length > caps.maxPayloadChars) {
      errors.push({
        provider: name,
        reason: `Payload too large: ${text.length} chars exceeds max ${caps.maxPayloadChars}`,
      });
    }

    if (sourceLang !== "auto" && !caps.supportedSourceLangs.includes(sourceLang)) {
      errors.push({
        provider: name,
        reason: `Unsupported source language: ${sourceLang}. Supported: ${caps.supportedSourceLangs.join(", ")}`,
      });
    }

    if (!caps.supportedTargetLangs.includes(targetLang)) {
      errors.push({
        provider: name,
        reason: `Unsupported target language: ${targetLang}. Supported: ${caps.supportedTargetLangs.join(", ")}`,
      });
    }

    if (options?.formality && !caps.supportsFormality) {
      errors.push({
        provider: name,
        reason: "Provider does not support formality options",
      });
    }

    if (options?.dialect && caps.dialectHandling === "none") {
      errors.push({
        provider: name,
        reason: "Provider does not support dialect variants",
      });
    }

    return errors;
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
