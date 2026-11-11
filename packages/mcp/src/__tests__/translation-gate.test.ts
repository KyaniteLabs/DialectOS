/**
 * The MCP translate paths run the same validator as the CLI and the
 * GitHub Action, and return provider downgrade warnings instead of
 * dropping them.
 */
import { describe, it, expect } from "vitest";
import { handleTranslateText, handleValidateTranslation } from "../tools/translator-handlers.js";
import { gateTranslation, assertGate, QUALITY_GATE_FAILED } from "../lib/translation-gate.js";

const rateLimiter = { acquire: async () => undefined } as never;

function registryReturning(translatedText: string, warnings: string[] = []) {
  const provider = { name: "fake", translate: async () => ({ translatedText, provider: "fake" }) };
  return {
    get: () => provider,
    getAuto: () => provider,
    prepareRequest: (_n: string, _t: string, sourceLang: string, targetLang: string, options: object) => ({
      sourceLang,
      targetLang,
      options,
      warnings,
    }),
  } as never;
}

function body(result: { content: Array<{ text: string }> }) {
  return JSON.parse(result.content[0].text);
}

describe("MCP translation gate", () => {
  it("translate_text blocks a translation that drops the negation", async () => {
    const result = await handleTranslateText(
      { text: "Do not delete this file.", dialect: "es-MX" },
      registryReturning("Elimina este archivo."),
      rateLimiter
    );
    expect(result.isError).toBe(true);
    expect(body(result).error).toBe(QUALITY_GATE_FAILED);
    expect(body(result).message).toMatch(/Negation/);
  });

  it("translate_text returns a passing translation with its warnings", async () => {
    const warning = "Provider deepl does not support dialect es-MX; using generic Spanish target es";
    const result = await handleTranslateText(
      { text: "Do not delete this file.", dialect: "es-MX" },
      registryReturning("No elimines este archivo.", [warning]),
      rateLimiter
    );
    expect(result.isError).toBeUndefined();
    expect(body(result).translatedText).toBe("No elimines este archivo.");
    expect(body(result).warnings).toEqual([warning]);
    expect(body(result).validation.valid).toBe(true);
  });

  it("a short UI string like Welcome passes with no semantic advisory", () => {
    const gate = gateTranslation({ source: "Welcome", translated: "Bienvenido", dialect: "es-ES" });
    expect(gate.blocking).toEqual([]);
    expect(gate.advisories).toEqual([]);
  });

  it("a score-only semantic miss is advisory, not blocking", () => {
    const input = { source: "Email Maria at Kyanite Labs about the release", translated: "Escribe", dialect: "es-ES" as const };
    const gate = gateTranslation(input);
    expect(gate.blocking).toEqual([]);
    expect(gate.advisories.join(" ")).toMatch(/Semantic quality below threshold/);
    expect(() => assertGate(input)).not.toThrow();
  });

  it("assertGate throws QUALITY_GATE_FAILED for a dropped negation", () => {
    expect(() =>
      assertGate({ source: "Never share your password.", translated: "Comparte tu contraseña.", dialect: "es-ES" })
    ).toThrow(QUALITY_GATE_FAILED);
  });

  it("validate_translation returns the full report without calling a provider", async () => {
    const result = await handleValidateTranslation(
      { source: "Do not delete this file.", translated: "Elimina este archivo.", dialect: "es-MX" },
      undefined as never,
      rateLimiter
    );
    expect(result.isError).toBeUndefined();
    const report = body(result);
    expect(report.valid).toBe(false);
    expect(report.semanticCheck.negationDropped).toBe(true);
  });

  it("validate_translation rejects empty input as a tool error", async () => {
    const result = await handleValidateTranslation(
      { source: "Hello", translated: " ", dialect: "es-ES" },
      undefined as never,
      rateLimiter
    );
    expect(result.isError).toBe(true);
  });
});
