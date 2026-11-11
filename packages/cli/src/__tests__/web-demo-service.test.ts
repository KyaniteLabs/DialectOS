import { describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { ProviderRegistry, TranslationMemory } from "@dialectos/providers";
import type { ProviderCapability, TranslationProvider } from "@dialectos/types";
import {
  getWebDemoProviderStatus,
  translateForWebDemo,
  validateWebDemoDialect,
} from "../lib/web-demo-service.js";

function makeProvider(
  name = "llm",
  capabilityOverrides: Partial<ProviderCapability> = {}
): TranslationProvider {
  return {
    name,
    translate: vi.fn(async (text: string, sourceLang: string, targetLang: string, options) => ({
      translatedText: options?.dialect === "es-MX" && text.includes("file") ? "Recoge el archivo antes de estacionar el carro." : `[${options?.dialect}] ${text}`,
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
      ...capabilityOverrides,
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

    expect(result.translatedText).toBe("Recoge el archivo antes de estacionar el carro.");
    expect(result.providerUsed).toBe("llm");
    expect(result.semanticPromptApplied).toBe(true);
    expect(result.providerStatus.semanticProviders).toEqual(["llm"]);
    expect(result).not.toHaveProperty("semanticContext");
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

  it("does not expose internal prompt context in public demo results", async () => {
    const registry = new ProviderRegistry();
    registry.register(makeProvider());

    const result = await translateForWebDemo({
      text: "Pick up the file before deployment.",
      dialect: "es-MX",
    }, registry);

    expect(JSON.stringify(result)).not.toContain("Dialect quality contract");
    expect(JSON.stringify(result)).not.toContain("Lexical ambiguity constraints");
    expect(result.semanticPromptApplied).toBe(true);
  });

  it("refuses generic non-semantic providers for the full-app demo", async () => {
    const registry = new ProviderRegistry();
    registry.register(makeProvider("libretranslate", {
      displayName: "Mock generic MT",
      supportsContext: false,
      supportsDialect: false,
      dialectHandling: "none",
    }));

    const status = getWebDemoProviderStatus(registry);
    expect(status.configured).toBe(true);
    expect(status.ready).toBe(false);
    expect(status.semanticProviders).toEqual([]);

    await expect(translateForWebDemo({
      text: "Pick up the file before deployment.",
      dialect: "es-MX",
    }, registry)).rejects.toThrow(/not semantic enough/);
  });

  it("does not fall back from semantic providers to generic providers", async () => {
    const registry = new ProviderRegistry();
    const failingSemantic = makeProvider("llm");
    vi.mocked(failingSemantic.translate).mockRejectedValue(new Error("semantic down"));
    const generic = makeProvider("libretranslate", {
      displayName: "Mock generic MT",
      supportsContext: false,
      supportsDialect: false,
      dialectHandling: "none",
    });
    registry.register(failingSemantic);
    registry.register(generic);

    await expect(translateForWebDemo({
      text: "Pick up the file before deployment.",
      dialect: "es-MX",
    }, registry)).rejects.toThrow(/All semantic demo providers failed/);
    expect(generic.translate).not.toHaveBeenCalled();
  });

  it("reports a cache hit only when the cache actually served the request", async () => {
    const cacheDir = mkdtempSync(path.join(tmpdir(), "dialectos-demo-cache-"));
    try {
      const registry = new ProviderRegistry(undefined, undefined, true, new TranslationMemory({ cacheDir }));
      const provider = makeProvider("llm");
      registry.register(provider);
      const request = { text: "Pick up the file before you park the car.", dialect: "es-MX" as const };

      const first = await translateForWebDemo(request, registry);
      const second = await translateForWebDemo(request, registry);

      expect(first.cacheHit).toBe(false);
      expect(second.cacheHit).toBe(true);
      expect(provider.translate).toHaveBeenCalledTimes(1);
    } finally {
      rmSync(cacheDir, { recursive: true, force: true });
    }
  });

  it("never reports a cache hit when no cache is configured", async () => {
    const registry = new ProviderRegistry();
    registry.register(makeProvider("llm"));
    const request = { text: "Pick up the file before you park the car.", dialect: "es-MX" as const };

    await translateForWebDemo(request, registry);
    const second = await translateForWebDemo(request, registry);

    expect(second.cacheHit).toBe(false);
  });

  it("returns quality warnings for non-critical judge issues instead of rejecting", async () => {
    const registry = new ProviderRegistry();
    const provider = makeProvider("llm");
    vi.mocked(provider.translate).mockResolvedValue({
      translatedText: "Recoger the file before deploying.",
      provider: "llm" as never,
    });
    registry.register(provider);

    const result = await translateForWebDemo({
      text: "Pick up the file before deployment.",
      dialect: "es-MX",
    }, registry);
    expect(result.ok !== false).toBe(true);
    expect(result.translatedText).toBe("Recoger the file before deploying.");
    expect(result.qualityWarnings.length).toBeGreaterThan(0);
    expect(result.qualityWarnings.some((w: string) => /accuracy/.test(w))).toBe(true);
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
