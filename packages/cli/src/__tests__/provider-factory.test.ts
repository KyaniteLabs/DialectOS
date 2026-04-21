import { afterEach, describe, expect, it } from "vitest";
import { createProviderRegistry, resetDefaultProviderRegistryForTests } from "../lib/provider-factory.js";

const ENV_KEYS = [
  "DEEPL_AUTH_KEY",
  "LIBRETRANSLATE_URL",
  "ENABLE_MYMEMORY",
  "LLM_API_URL",
  "LLM_ENDPOINT",
  "LLM_MODEL",
  "LLM_API_KEY",
  "LLM_ALLOW_LOCAL",
];

function clearProviderEnv() {
  for (const key of ENV_KEYS) {
    delete process.env[key];
  }
  resetDefaultProviderRegistryForTests();
}

describe("provider factory", () => {
  afterEach(() => {
    clearProviderEnv();
  });

  it("registers a configured LLM provider as the semantic auto provider", () => {
    clearProviderEnv();
    process.env.LLM_API_URL = "https://llm.example/v1/chat/completions";
    process.env.LLM_MODEL = "dialect-model";
    process.env.LLM_API_KEY = "test-key";
    process.env.LIBRETRANSLATE_URL = "https://libretranslate.example";

    const registry = createProviderRegistry();

    expect(registry.listProviders()).toContain("llm");
    expect(registry.listProviders()).toContain("libretranslate");
    expect(registry.getAuto().name).toBe("llm");
    expect(registry.getCapabilities("llm")?.dialectHandling).toBe("semantic");
  });

  it("does not register generic fallback providers unless explicitly configured", () => {
    clearProviderEnv();

    const registry = createProviderRegistry();

    expect(registry.listProviders()).toEqual([]);
  });
});
