import { describe, expect, it, vi } from "vitest";
import { ProviderRegistry } from "@espanol/providers";
import type { TranslationProvider } from "@espanol/types";
import {
  getWebDemoProviderStatus,
  translateForWebDemo,
  validateWebDemoDialect,
} from "../lib/web-demo-service.js";

function makeProvider(name = "llm"): TranslationProvider {
  return {
    name,
    translate: vi.fn(async (text: string, sourceLang: string, targetLang: string, options) => ({
      translatedText: `[${options?.dialect}] ${text}`,
      sourceLang,
      targetLang,
      provider: name as never,
    })),
    getCapabilities: () => ({
      name,
      displayName: "Mock semantic LLM",
      needsApiKey: false,
      supportsFormality: true,
      supportsContext: true,
      supportsDialect: true,
      supportedSourceLangs: ["auto", "en", "es"],
      supportedTargetLangs: ["es"],
      maxPayloadChars: 100000,
      dialectHandling: "semantic",
    }),
  };
}

describe("web demo service", () => {
  it("runs through the provider stack with semantic dialect context", async () => {
    const registry = new ProviderRegistry();
    const provider = makeProvider();
    registry.register(provider);

    const result = await translateForWebDemo({
      text: "Pick up the file before you park the car.",
      dialect: "es-MX",
      provider: "auto",
    }, registry);

    expect(result.translatedText).toBe("[es-MX] Pick up the file before you park the car.");
    expect(result.providerUsed).toBe("llm");
    expect(result.providerStatus.semanticProviders).toEqual(["llm"]);
    expect(result.semanticContext).toContain("Target dialect: Mexican Spanish");
    expect(result.semanticContext).toContain("do not translate literally word-by-word");
    expect(provider.translate).toHaveBeenCalledWith(
      "Pick up the file before you park the car.",
      "auto",
      "es",
      expect.objectContaining({
        dialect: "es-MX",
        context: expect.stringContaining("Dialect quality contract"),
      })
    );
  });

  it("reports missing providers instead of falling back to static rule substitutions", async () => {
    const registry = new ProviderRegistry();

    await expect(translateForWebDemo({
      text: "hola",
      dialect: "es-PR",
    }, registry)).rejects.toThrow(/No provider configured/);
  });

  it("validates dialects before touching a provider", () => {
    expect(() => validateWebDemoDialect("es-XX")).toThrow(/Invalid dialect/);
    expect(getWebDemoProviderStatus(new ProviderRegistry()).configured).toBe(false);
  });
});

