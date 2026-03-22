/**
 * Shared provider factory for MCP tools
 */

import {
  ProviderRegistry,
  DeepLProvider,
  LibreTranslateProvider,
  MyMemoryProvider,
} from "@espanol/providers";

/**
 * Create a provider registry from environment variables
 */
export function createProviderRegistry(): ProviderRegistry {
  const registry = new ProviderRegistry();

  const deeplKey = process.env.DEEPL_AUTH_KEY;
  if (deeplKey) {
    registry.register(new DeepLProvider(deeplKey));
  }

  const libreUrl = process.env.LIBRETRANSLATE_URL;
  if (libreUrl) {
    registry.register(new LibreTranslateProvider({ endpoint: libreUrl }));
  }

  const myMemoryLimit = parseInt(process.env.MYMEMORY_RATE_LIMIT || "", 10);
  registry.register(new MyMemoryProvider({
    maxRequests: myMemoryLimit > 0 ? myMemoryLimit : 60,
  }));

  return registry;
}
