/**
 * Provider factory - creates a ProviderRegistry with available providers
 * Checks environment variables to determine which providers to register
 */

import { ProviderRegistry } from "@espanol/providers";
import { DeepLProvider } from "@espanol/providers";
import { LibreTranslateProvider } from "@espanol/providers";
import { MyMemoryProvider } from "@espanol/providers";
import { LLMProvider } from "@espanol/providers";

/**
 * Create a ProviderRegistry with all available providers
 * Providers are registered based on environment variables:
 * - LLM_API_URL + LLM_MODEL → LLMProvider (semantic dialect-aware primary)
 * - DEEPL_AUTH_KEY → DeepLProvider
 * - LIBRETRANSLATE_URL → LibreTranslateProvider
 * - ENABLE_MYMEMORY=1 → MyMemoryProvider (legacy fallback)
 */
export function createProviderRegistry(): ProviderRegistry {
  const registry = new ProviderRegistry();

  // Register LLM first when configured; getAuto also ranks semantic providers first.
  const llmEndpoint = process.env.LLM_API_URL || process.env.LLM_ENDPOINT;
  const llmModel = process.env.LLM_MODEL;
  if (llmEndpoint && llmModel) {
    const llmProvider = new LLMProvider({
      endpoint: llmEndpoint,
      model: llmModel,
      apiKey: process.env.LLM_API_KEY,
      allowLocal: process.env.LLM_ALLOW_LOCAL === "1",
    });
    registry.register(llmProvider);
  }

  // Register DeepL if API key is available
  const deeplKey = process.env.DEEPL_AUTH_KEY;
  if (deeplKey) {
    const deeplProvider = new DeepLProvider(deeplKey);
    registry.register(deeplProvider);
  }

  // Register LibreTranslate if URL is available (recommended self-hosted default)
  const libreUrl = process.env.LIBRETRANSLATE_URL;
  if (libreUrl) {
    const libreProvider = new LibreTranslateProvider({
      endpoint: libreUrl,
    });
    registry.register(libreProvider);
  }

  // MyMemory is opt-in only (legacy fallback). Set ENABLE_MYMEMORY=1 to register it.
  const enableMyMemory = process.env.ENABLE_MYMEMORY === "1";
  if (enableMyMemory) {
    // Align CLI behavior with MCP: allow runtime limit tuning for bulk docs.
    const myMemoryLimit = parseInt(process.env.MYMEMORY_RATE_LIMIT || "", 10);
    const myMemoryWindow = parseInt(process.env.MYMEMORY_RATE_WINDOW_MS || "", 10);
    const myMemoryProvider = new MyMemoryProvider({
      maxRequests: myMemoryLimit > 0 ? myMemoryLimit : 60,
      windowMs: myMemoryWindow > 0 ? myMemoryWindow : 60000,
    });
    registry.register(myMemoryProvider);
  }

  return registry;
}

/**
 * Get the default provider registry (singleton pattern)
 */
let defaultRegistry: ProviderRegistry | null = null;

export function getDefaultProviderRegistry(): ProviderRegistry {
  if (!defaultRegistry) {
    defaultRegistry = createProviderRegistry();
  }
  return defaultRegistry;
}

export function resetDefaultProviderRegistryForTests(): void {
  defaultRegistry = null;
}
