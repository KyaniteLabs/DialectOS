/**
 * Provider factory - creates a ProviderRegistry with available providers
 * Checks environment variables to determine which providers to register
 */

import { ProviderRegistry } from "@espanol/providers";
import { DeepLProvider } from "@espanol/providers";
import { LibreTranslateProvider } from "@espanol/providers";
import { MyMemoryProvider } from "@espanol/providers";

/**
 * Create a ProviderRegistry with all available providers
 * Providers are registered based on environment variables:
 * - DEEPL_AUTH_KEY → DeepLProvider
 * - LIBRETRANSLATE_URL → LibreTranslateProvider
 * - MyMemoryProvider is always registered (free, no auth required)
 */
export function createProviderRegistry(): ProviderRegistry {
  const registry = new ProviderRegistry();

  // Register DeepL if API key is available
  const deeplKey = process.env.DEEPL_AUTH_KEY;
  if (deeplKey) {
    const deeplProvider = new DeepLProvider(deeplKey);
    registry.register(deeplProvider);
  }

  // Register LibreTranslate if URL is available
  const libreUrl = process.env.LIBRETRANSLATE_URL;
  if (libreUrl) {
    const libreProvider = new LibreTranslateProvider({
      endpoint: libreUrl,
    });
    registry.register(libreProvider);
  }

  // Always register MyMemory (free, no auth required)
  const myMemoryProvider = new MyMemoryProvider();
  registry.register(myMemoryProvider);

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
