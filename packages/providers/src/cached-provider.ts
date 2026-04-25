/**
 * CachedProvider wraps a TranslationProvider with translation memory caching
 */

import type { TranslationProvider, TranslationResult, ProviderCapability, TranslateOptions } from "./types.js";
import type { TranslationMemory } from "./translation-memory.js";

export class CachedProvider implements TranslationProvider {
  readonly name: string;
  private hits = 0;
  private misses = 0;

  constructor(
    private readonly provider: TranslationProvider,
    private readonly cache: TranslationMemory
  ) {
    this.name = provider.name;
  }

  async translate(
    text: string,
    sourceLang: string,
    targetLang: string,
    options?: TranslateOptions
  ): Promise<TranslationResult> {
    const key = this.cache.computeKey(text, sourceLang, targetLang, options);
    const cached = await this.cache.get(key);

    if (cached) {
      this.hits++;
      return cached.result;
    }

    this.misses++;
    const result = await this.provider.translate(text, sourceLang, targetLang, options);
    await this.cache.set(key, result);
    return result;
  }

  getCapabilities(): ProviderCapability {
    return (
      this.provider.getCapabilities?.() ?? {
        name: this.name,
        displayName: this.name,
        needsApiKey: false,
        supportsFormality: false,
        supportsContext: false,
        supportsDialect: false,
        supportedSourceLangs: [],
        supportedTargetLangs: [],
        maxPayloadChars: 0,
        dialectHandling: "none",
      }
    );
  }

  /**
   * Return cache hit/miss statistics and current cache size.
   */
  getCacheStats(): { hits: number; misses: number; size: number } {
    return {
      hits: this.hits,
      misses: this.misses,
      size: this.cache.getSize(),
    };
  }
}
