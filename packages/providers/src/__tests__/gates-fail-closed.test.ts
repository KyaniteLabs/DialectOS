import { describe, it, expect, vi, afterEach } from "vitest";
import { garbagePatternCheck, negationPreservationCheck, runQualityGates } from "../quality-gates.js";
import type { QualityGateContext } from "../quality-gates.js";
import { LLMProvider, QualityGateError } from "../providers/llm.js";

function ctx(overrides: Partial<QualityGateContext> = {}): QualityGateContext {
  return { sourceText: "Hello world", translatedText: "Hola mundo", dialect: "es-MX", modelTier: "large", ...overrides };
}

describe("quality gates fail closed", () => {
  it("a gate that throws is a failure, not a pass", async () => {
    const results = await runQualityGates(ctx({ translatedText: undefined as unknown as string }));
    const errored = results.filter((r) => r.details?.startsWith("Gate error"));
    expect(errored.length).toBeGreaterThan(0);
    expect(errored.every((r) => r.passed === false)).toBe(true);
  });

  it("negation reversal fails on every tier", async () => {
    for (const modelTier of ["tiny", "small", "medium", "large"] as const) {
      const results = await runQualityGates(
        ctx({ sourceText: "You must not delete the file.", translatedText: "Debes eliminar el archivo.", modelTier })
      );
      expect(results.find((r) => r.name === "negationPreservation")?.passed).toBe(false);
    }
  });

  it("negation kept passes", () => {
    expect(
      negationPreservationCheck(ctx({ sourceText: "You must not delete the file.", translatedText: "No debes eliminar el archivo." })).passed
    ).toBe(true);
  });
});

describe("garbagePatternCheck cognates", () => {
  it.each(["Total", "Hotel", "Email", "Chat"])("accepts the unchanged cognate %s", (word) => {
    expect(garbagePatternCheck(ctx({ sourceText: word, translatedText: word })).passed).toBe(true);
  });

  it("still rejects an unchanged English sentence", () => {
    const s = "Save the file before you close the window.";
    expect(garbagePatternCheck(ctx({ sourceText: s, translatedText: s })).passed).toBe(false);
  });
});

describe("content failures do not open the circuit breaker", () => {
  const realFetch = global.fetch;
  afterEach(() => {
    global.fetch = realFetch;
  });

  it("keeps the provider available after repeated gate rejections", async () => {
    // The model echoes English back: transport succeeds, content fails the gates.
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      headers: { get: (name: string) => (name === "content-type" ? "application/json" : null) },
      json: async () => ({ choices: [{ message: { content: "Save the file before you close the window." } }] }),
    } as unknown as Response) as typeof fetch;

    const provider = new LLMProvider({
      endpoint: "https://llm.example/v1/chat/completions",
      model: "dialect-model",
      apiKey: "test-key",
      failureThreshold: 2,
      maxRequests: 1000,
    });

    for (let i = 0; i < 4; i++) {
      await expect(
        provider.translate("Save the file before you close the window.", "en", "es", { dialect: "es-MX" })
      ).rejects.toBeInstanceOf(QualityGateError);
    }
  });
});

describe("DeepL dialect requests are downgraded honestly", () => {
  it("es-MX through DeepL targets base es and says so", async () => {
    const { ProviderRegistry } = await import("../registry.js");
    const { DeepLProvider } = await import("../providers/deepl.js");
    const registry = new ProviderRegistry();
    registry.register(
      new DeepLProvider("test-key", undefined, {
        timeout: 5000, failureThreshold: 3, resetTimeoutMs: 1000, maxRequests: 10, windowMs: 1000,
      }),
      false
    );
    const prepared = registry.prepareRequest("deepl", "Hello", "en", "es-MX", { dialect: "es-MX" });
    expect(prepared.targetLang).toBe("es");
    expect(prepared.options.dialect).toBeUndefined();
    expect(prepared.warnings.join(" ")).toMatch(/does not support dialect es-MX/);
  });
});
