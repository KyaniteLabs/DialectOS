/**
 * Shared provider factory for MCP tools
 * Checks environment variables to determine which providers to register
 */

import {
  ProviderRegistry,
  DeepLProvider,
  LibreTranslateProvider,
  MyMemoryProvider,
  LLMProvider,
} from "@espanol/providers";

/**
 * Create a ProviderRegistry with all available providers
 * Providers are registered based on environment variables:
 * - LLM_API_URL + LLM_MODEL → LLMProvider (semantic dialect-aware primary)
 * - DEEPL_AUTH_KEY → DeepLProvider
 * - LIBRETRANSLATE_URL → LibreTranslateProvider
 * - MyMemoryProvider is opt-in only (legacy fallback). Set ENABLE_MYMEMORY=1 to register it.
 */
export function createProviderRegistry(): ProviderRegistry {
  const registry = new ProviderRegistry();

  // Register LLM first when configured; ProviderRegistry also ranks semantic providers first.
  const llmEndpoint = process.env.LLM_API_URL || process.env.LLM_ENDPOINT;
  const llmModel = process.env.LLM_MODEL;
  if (llmEndpoint && llmModel) {
    registry.register(new LLMProvider({
      endpoint: llmEndpoint,
      model: llmModel,
      apiKey: process.env.LLM_API_KEY,
      allowLocal: process.env.LLM_ALLOW_LOCAL === "1",
    }));
  }

  // Register DeepL if API key is available
  const deeplKey = process.env.DEEPL_AUTH_KEY;
  if (deeplKey) {
    registry.register(new DeepLProvider(deeplKey));
  }

  // Register LibreTranslate if URL is available (recommended self-hosted default)
  const libreUrl = process.env.LIBRETRANSLATE_URL;
  if (libreUrl) {
    registry.register(new LibreTranslateProvider({ endpoint: libreUrl }));
  }

  // MyMemory is opt-in only (legacy fallback). Set ENABLE_MYMEMORY=1 to register it.
  const enableMyMemory = process.env.ENABLE_MYMEMORY === "1";
  if (enableMyMemory) {
    const myMemoryLimit = parseInt(process.env.MYMEMORY_RATE_LIMIT || "", 10);
    const myMemoryWindow = parseInt(process.env.MYMEMORY_RATE_WINDOW_MS || "", 10);
    registry.register(new MyMemoryProvider({
      maxRequests: myMemoryLimit > 0 ? myMemoryLimit : 60,
      windowMs: myMemoryWindow > 0 ? myMemoryWindow : 60000,
    }));
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
