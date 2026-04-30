/**
 * Provider factory — thin wrapper around @dialectos/providers factory
 *
 * Delegates to the unified implementation in packages/providers/src/factory.ts
 * to eliminate duplication with packages/cli/src/lib/provider-factory.ts.
 */

import {
  createProviderRegistry as createProviderRegistryImpl,
  getDefaultProviderRegistry as getDefaultProviderRegistryImpl,
} from "@dialectos/providers";

export function createProviderRegistry() {
  return createProviderRegistryImpl();
}

export function getDefaultProviderRegistry() {
  return getDefaultProviderRegistryImpl();
}
