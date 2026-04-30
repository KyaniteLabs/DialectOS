/**
 * Provider factory — thin wrapper around @dialectos/providers factory
 *
 * Delegates to the unified implementation in packages/providers/src/factory.ts
 * to eliminate duplication with packages/mcp/src/lib/provider-factory.ts.
 */

import {
  createProviderRegistry as createProviderRegistryImpl,
  getDefaultProviderRegistry as getDefaultProviderRegistryImpl,
  resetDefaultProviderRegistryForTests as resetDefaultProviderRegistryForTestsImpl,
} from "@dialectos/providers";

export function createProviderRegistry(useCache = false) {
  return createProviderRegistryImpl(undefined, useCache);
}

export function getDefaultProviderRegistry() {
  return getDefaultProviderRegistryImpl();
}

export function resetDefaultProviderRegistryForTests() {
  return resetDefaultProviderRegistryForTestsImpl();
}
