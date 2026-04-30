/**
 * Provider factory — centralized registry creation
 *
 * Moved from cli/lib and mcp/lib to eliminate duplication.
 * Consumers pass environment variables; this module owns provider instantiation.
 */

import { ProviderRegistry } from "./registry.js";
import { LLMProvider } from "./providers/llm.js";
import { DeepLProvider } from "./providers/deepl.js";
import { LibreTranslateProvider } from "./providers/libre-translate.js";
import { MyMemoryProvider } from "./providers/my-memory.js";

export interface ProviderFactoryEnv {
  LLM_API_URL?: string;
  LLM_ENDPOINT?: string;
  LM_STUDIO_URL?: string;
  LLM_MODEL?: string;
  LLM_API_FORMAT?: string;
  LLM_API_KEY?: string;
  LLM_ALLOW_LOCAL?: string;
  DEEPL_AUTH_KEY?: string;
  LIBRETRANSLATE_URL?: string;
  ENABLE_MYMEMORY?: string;
  MYMEMORY_RATE_LIMIT?: string;
  MYMEMORY_RATE_WINDOW_MS?: string;
}

function parseLLMApiFormat(value: string | undefined): "openai" | "anthropic" | "lmstudio" {
  return value === "anthropic" || value === "lmstudio" ? value : "openai";
}

/**
 * Create a ProviderRegistry with all available providers.
 * Providers are registered based on environment variables.
 */
export function createProviderRegistry(
  env: ProviderFactoryEnv = process.env as ProviderFactoryEnv,
  useCache = false
): ProviderRegistry {
  const registry = new ProviderRegistry(5, 60000, useCache);

  const llmEndpoint = env.LLM_API_URL || env.LLM_ENDPOINT || env.LM_STUDIO_URL;
  const llmModel = env.LLM_MODEL;
  if ((llmEndpoint || env.LLM_API_FORMAT === "lmstudio") && llmModel) {
    registry.register(
      new LLMProvider({
        endpoint: llmEndpoint,
        model: llmModel,
        apiFormat: parseLLMApiFormat(env.LLM_API_FORMAT),
        apiKey: env.LLM_API_KEY,
        allowLocal: env.LLM_API_FORMAT === "lmstudio" || env.LLM_ALLOW_LOCAL === "1",
      })
    );
  }

  const deeplKey = env.DEEPL_AUTH_KEY;
  if (deeplKey) {
    registry.register(new DeepLProvider(deeplKey));
  }

  const libreUrl = env.LIBRETRANSLATE_URL;
  if (libreUrl) {
    registry.register(new LibreTranslateProvider({ endpoint: libreUrl }));
  }

  const enableMyMemory = env.ENABLE_MYMEMORY === "1";
  if (enableMyMemory) {
    const myMemoryLimit = parseInt(env.MYMEMORY_RATE_LIMIT || "", 10);
    const myMemoryWindow = parseInt(env.MYMEMORY_RATE_WINDOW_MS || "", 10);
    registry.register(
      new MyMemoryProvider({
        maxRequests: myMemoryLimit > 0 ? myMemoryLimit : 60,
        windowMs: myMemoryWindow > 0 ? myMemoryWindow : 60000,
      })
    );
  }

  return registry;
}

let defaultRegistry: ProviderRegistry | null = null;

/**
 * Get the default provider registry (singleton).
 */
export function getDefaultProviderRegistry(): ProviderRegistry {
  if (!defaultRegistry) {
    defaultRegistry = createProviderRegistry();
  }
  return defaultRegistry;
}

/**
 * Reset the singleton for tests.
 */
export function resetDefaultProviderRegistryForTests(): void {
  defaultRegistry = null;
}
