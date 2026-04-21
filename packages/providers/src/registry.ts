/**
 * Provider registry with automatic failover
 * Manages multiple translation providers and selects available ones
 */

import type { TranslationProvider, ProviderCapability, TranslateOptions } from "./types.js";
import { CircuitBreaker } from "./circuit-breaker.js";

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

  private canonicalName(name: string): string {
    if (name === "libre") return "libretranslate";
    return name;
  }

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
    const entry = this.providers.get(this.canonicalName(name));
    if (!entry) {
      throw new Error("Provider not available");
    }
    return entry.provider;
  }

  /**
   * Get the best available provider (with closed circuit).
   * Semantic dialect-aware providers win over generic machine translation.
   */
  getAuto(): TranslationProvider {
    const rankedEntries = Array.from(this.providers.values()).sort((a, b) =>
      this.providerRank(b.provider) - this.providerRank(a.provider)
    );

    for (const entry of rankedEntries) {
      if (entry.breaker.canExecute()) {
        return entry.provider;
      }
    }

    throw new Error("No translation providers are currently available");
  }

  private providerRank(provider: TranslationProvider): number {
    const caps = provider.getCapabilities?.();
    switch (caps?.dialectHandling) {
      case "semantic":
        return 4;
      case "native":
        return 3;
      case "approximate":
        return 2;
      case "none":
        return 1;
      default:
        return 0;
    }
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
