/**
 * Provider registry with automatic failover
 * Manages multiple translation providers and selects available ones
 */

import type { TranslationProvider, ProviderCapability, TranslateOptions } from "./types.js";
import { CircuitBreaker } from "./circuit-breaker.js";
import { TranslationMemory } from "./translation-memory.js";
import { CachedProvider } from "./cached-provider.js";

interface ProviderEntry {
  provider: TranslationProvider;
  breaker: CircuitBreaker;
}

export interface CapabilityValidationError {
  provider: string;
  reason: string;
}

export interface PreparedProviderRequest {
  sourceLang: string;
  targetLang: string;
  options: TranslateOptions;
  warnings: string[];
}

export class ProviderRegistry {
  private providers = new Map<string, ProviderEntry>();
  private roundRobinIndex = new Map<string, number>();
  private cache?: TranslationMemory;

  private canonicalName(name: string): string {
    if (name === "libre") return "libretranslate";
    return name;
  }

  constructor(
    private readonly failureThreshold: number = 5,
    private readonly resetTimeoutMs: number = 60000,
    useCache: boolean = false,
    cache?: TranslationMemory
  ) {
    if (useCache || cache) {
      this.cache = cache ?? new TranslationMemory();
    }
  }

  /**
   * Register a translation provider
   */
  register(provider: TranslationProvider, useCache?: boolean): void {
    let wrappedProvider = provider;
    const shouldCache = useCache ?? (this.cache !== undefined);
    if (shouldCache && this.cache) {
      wrappedProvider = new CachedProvider(provider, this.cache);
    }

    // Use the provider's own circuit breaker if available to avoid
    // the double-breaker anti-pattern where registry and provider
    // maintain separate, desynchronized breakers.
    const breaker =
      (wrappedProvider as unknown as { getCircuitBreaker?(): CircuitBreaker }).getCircuitBreaker?.() ??
      new CircuitBreaker(this.failureThreshold, this.resetTimeoutMs);

    this.providers.set(provider.name, { provider: wrappedProvider, breaker });
  }

  /**
   * Get a specific provider by name
   */
  get(name: string): TranslationProvider {
    const entry = this.providers.get(this.canonicalName(name));
    if (!entry) {
      throw new Error("Provider not available");
    }
    return entry.provider;
  }

  /**
   * Get the best available provider (with closed circuit).
   * Semantic dialect-aware providers win over generic machine translation.
   *
   * If targetLang is provided, only providers that support it are considered.
   * If options.dialect is provided, providers with better dialectHandling are preferred.
   */
  getAuto(targetLang?: string, options?: { dialect?: string }): TranslationProvider {
    const rankedEntries = Array.from(this.providers.values()).sort((a, b) =>
      this.providerRank(b.provider, options?.dialect) - this.providerRank(a.provider, options?.dialect)
    );

    // Group by rank for round-robin within same rank
    const rankGroups = new Map<number, ProviderEntry[]>();
    for (const entry of rankedEntries) {
      const rank = this.providerRank(entry.provider, options?.dialect);
      if (!rankGroups.has(rank)) rankGroups.set(rank, []);
      rankGroups.get(rank)!.push(entry);
    }

    // Try each rank group from highest to lowest
    const sortedRanks = Array.from(rankGroups.keys()).sort((a, b) => b - a);
    for (const rank of sortedRanks) {
      const group = rankGroups.get(rank)!;
      const available = group.filter((entry) => {
        if (!entry.breaker.canExecute()) return false;
        if (targetLang) {
          const caps = entry.provider.getCapabilities?.();
          const baseLang = targetLang.split("-")[0];
          const supported = caps?.supportedTargetLangs || [];
          if (!supported.includes(targetLang) && !supported.includes(baseLang)) {
            return false;
          }
        }
        return true;
      });

      if (available.length === 0) continue;

      // Round-robin within same rank
      const key = `${rank}_${targetLang || "any"}_${options?.dialect || "any"}`;
      const idx = this.roundRobinIndex.get(key) || 0;
      const selected = available[idx % available.length];
      this.roundRobinIndex.set(key, (idx + 1) % available.length);
      return selected.provider;
    }

    throw new Error("No translation providers are currently available");
  }

  private providerRank(provider: TranslationProvider, dialect?: string): number {
    const caps = provider.getCapabilities?.();
    let rank = 0;
    switch (caps?.dialectHandling) {
      case "semantic":
        rank = 4;
        break;
      case "native":
        rank = 3;
        break;
      case "approximate":
        rank = 2;
        break;
      case "none":
        rank = 1;
        break;
      default:
        rank = 0;
    }
    // Boost providers that explicitly support the requested dialect
    if (dialect && caps?.supportedTargetLangs?.includes(dialect)) {
      rank += 1;
    }
    return rank;
  }

  /**
   * Get circuit breaker for a provider
   */
  getBreaker(name: string): CircuitBreaker | undefined {
    return this.providers.get(this.canonicalName(name))?.breaker;
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
    const entry = this.providers.get(this.canonicalName(name));
    return entry ? entry.breaker.canExecute() : false;
  }

  /**
   * Get capabilities for a specific provider
   */
  getCapabilities(name: string): ProviderCapability | null {
    const entry = this.providers.get(this.canonicalName(name));
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
   * Prepare a provider-specific request from a dialect-aware request.
   *
   * Providers such as LibreTranslate and MyMemory only accept base language
   * codes (for example "es") and do not natively handle Spanish dialects.
   * This method normalizes those requests before validation so callers do not
   * accidentally send unsupported BCP-47 dialect tags to external APIs.
   */
  prepareRequest(
    name: string,
    text: string,
    sourceLang: string,
    targetLang: string,
    options: TranslateOptions = {}
  ): PreparedProviderRequest {
    const canonical = this.canonicalName(name);
    const caps = this.getCapabilities(canonical);
    const preparedOptions: TranslateOptions = { ...options };
    const warnings: string[] = [];
    let preparedTargetLang = targetLang;

    const requestedDialect = options.dialect ?? (
      targetLang.startsWith("es-") ? targetLang as TranslateOptions["dialect"] : undefined
    );

    if (requestedDialect && caps?.dialectHandling === "none") {
      preparedTargetLang = requestedDialect.split("-")[0];
      delete preparedOptions.dialect;
      warnings.push(
        `Provider ${canonical} does not support dialect ${requestedDialect}; using generic Spanish target ${preparedTargetLang}`
      );
    }

    if (preparedOptions.formality && caps && !caps.supportsFormality) {
      warnings.push(`Provider ${canonical} does not support formality; dropping formality option`);
      delete preparedOptions.formality;
    }

    if (preparedOptions.context && caps && !caps.supportsContext) {
      warnings.push(`Provider ${canonical} does not support context; dropping context option`);
      delete preparedOptions.context;
    }

    const validationErrors = this.validateRequest(
      canonical,
      text,
      sourceLang,
      preparedTargetLang,
      {
        formality: preparedOptions.formality,
        dialect: preparedOptions.dialect,
      }
    );
    if (validationErrors.length > 0) {
      throw new Error(
        validationErrors.map((error) => `${error.provider}: ${error.reason}`).join("; ")
      );
    }

    return {
      sourceLang,
      targetLang: preparedTargetLang,
      options: preparedOptions,
      warnings,
    };
  }

  /**
   * Record a successful translation for a provider
   */
  recordSuccess(name: string): void {
    const entry = this.providers.get(this.canonicalName(name));
    if (entry) {
      entry.breaker.recordSuccess();
    }
  }

  /**
   * Record a failed translation for a provider
   */
  recordFailure(name: string): void {
    const entry = this.providers.get(this.canonicalName(name));
    if (entry) {
      entry.breaker.recordFailure();
    }
  }
}
