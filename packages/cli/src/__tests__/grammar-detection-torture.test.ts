import { describe, expect, it } from "vitest";
import { detectGrammarFeatures, grammarFeaturesToDialectHints } from "../lib/grammar-detection.js";

describe("grammar-detection torture", () => {
  it("handles 10,000 words without features efficiently", () => {
    const text = "El perro corre rápido por el parque. ".repeat(1000);
    const start = performance.now();
    const result = detectGrammarFeatures(text);
    const elapsed = performance.now() - start;
    expect(result.hasVoseo).toBe(false);
    expect(elapsed).toBeLessThan(100); // should be fast
  });

  it("handles text with only numbers and punctuation", () => {
    const result = detectGrammarFeatures("12345 !@#$% 67890");
    expect(result.hasVoseo).toBe(false);
    expect(result.hasVosotros).toBe(false);
  });

  it("handles text with only emojis", () => {
    const result = detectGrammarFeatures("🎉🎊🎁🎄🎅");
    expect(result.hasVoseo).toBe(false);
  });

  it("handles mixed scripts (Spanish + English + Chinese)", () => {
    const result = detectGrammarFeatures("Vos tenés 你有 coffee");
    expect(result.hasVoseo).toBe(true);
  });

  it("handles every voseo ending in one sentence", () => {
    const result = detectGrammarFeatures("Vos estás, tenés, venís, podés, sabés, querés");
    expect(result.hasVoseo).toBe(true);
  });

  it("handles every vosotros ending in one sentence", () => {
    const result = detectGrammarFeatures("Vosotros estáis, tenéis, venís, podéis, sabéis");
    expect(result.hasVosotros).toBe(true);
    // -ís is shared, so voseo may also trigger (documented behavior)
  });

  it("does not false-positive on French words", () => {
    const result = detectGrammarFeatures("Je suis français, après, très");
    expect(result.hasVoseo).toBe(false);
  });

  it("does not false-positive on Portuguese words", () => {
    const result = detectGrammarFeatures("Você está bem, obrigado, país");
    expect(result.hasVoseo).toBe(false);
  });

  it("detects leísmo with 'les' plural", () => {
    const result = detectGrammarFeatures("Les vi a ellos en el parque");
    expect(result.hasLeismo).toBe(true);
  });

  it("does not detect leísmo with 'le' as article (French)", () => {
    const result = detectGrammarFeatures("Le chat est noir");
    expect(result.hasLeismo).toBe(false);
  });

  it("handles extreme case: every feature in one text", () => {
    const text = "Vosotros le vi, vos la di, ustedes lo dio, y vosotras les quiero, y vos tenés";
    const result = detectGrammarFeatures(text);
    expect(result.hasVoseo).toBe(true);
    expect(result.hasVosotros).toBe(true);
    expect(result.hasUstedes).toBe(true);
    expect(result.hasLeismo).toBe(true);
    expect(result.hasLaismo).toBe(true);
    expect(result.hasLoismo).toBe(true);
  });

  it("dialectHints handles all-true features without crashing", () => {
    const hints = grammarFeaturesToDialectHints({
      hasVoseo: true,
      hasLeismo: true,
      hasLaismo: true,
      hasLoismo: true,
      hasVosotros: true,
      hasUstedes: true,
    });
    // Should include hints but not crash
    expect(Array.isArray(hints)).toBe(true);
    expect(hints.length).toBeGreaterThan(0);
  });

  it("handles newline-separated text", () => {
    const result = detectGrammarFeatures("Vos\nquerés\nir\nal\ncine");
    expect(result.hasVoseo).toBe(true);
  });

  it("handles tab-separated text", () => {
    const result = detectGrammarFeatures("Vos\tquerés\tir\tal\tcine");
    expect(result.hasVoseo).toBe(true);
  });

  // === NEW TORTURE TESTS ===

  it("does not false-positive voseo on 'interés'", () => {
    const result = detectGrammarFeatures("Tengo mucho interés en este tema");
    expect(result.hasVoseo).toBe(false);
  });

  it("does not false-positive voseo on 'compás'", () => {
    const result = detectGrammarFeatures("El compás marca el ritmo");
    expect(result.hasVoseo).toBe(false);
  });

  it("does not false-positive voseo on 'revés'", () => {
    const result = detectGrammarFeatures("Todo salió al revés");
    expect(result.hasVoseo).toBe(false);
  });

  it("does not false-positive voseo on 'además'", () => {
    const result = detectGrammarFeatures("Además, quiero más agua");
    expect(result.hasVoseo).toBe(false);
  });

  it("does not false-positive voseo on 'quizás'", () => {
    const result = detectGrammarFeatures("Quizás venga mañana");
    expect(result.hasVoseo).toBe(false);
  });

  it("handles null input gracefully", () => {
    const result = detectGrammarFeatures(null as any);
    expect(result.hasVoseo).toBe(false);
    expect(result.hasVosotros).toBe(false);
    expect(result.hasUstedes).toBe(false);
    expect(result.hasLeismo).toBe(false);
    expect(result.hasLaismo).toBe(false);
    expect(result.hasLoismo).toBe(false);
  });

  it("handles undefined input gracefully", () => {
    const result = detectGrammarFeatures(undefined as any);
    expect(result.hasVoseo).toBe(false);
    expect(result.hasVosotros).toBe(false);
  });

  it("handles number input gracefully", () => {
    const result = detectGrammarFeatures(12345 as any);
    expect(result.hasVoseo).toBe(false);
  });

  it("handles object input gracefully", () => {
    const result = detectGrammarFeatures({ toString: () => "vos tenés" } as any);
    // Object without text property — should return all false due to typeof check
    expect(result.hasVoseo).toBe(false);
  });

  it("handles string object with toString that returns voseo text", () => {
    // This tests that we don't accidentally coerce objects
    const result = detectGrammarFeatures(String("vos tenés") as any);
    expect(result.hasVoseo).toBe(true);
  });

  it("handles text with only voseo false positives and no real voseo", () => {
    const text = "Más país atrás después adiós anís francés inglés interés compás revés además quizás";
    const result = detectGrammarFeatures(text);
    expect(result.hasVoseo).toBe(false);
  });

  it("handles NFD Unicode decomposition", () => {
    // NFD form of "ñ" is "n" + combining tilde
    const nfdVos = "vos tene\u0301s"; // "tenés" in NFD
    const result = detectGrammarFeatures(nfdVos);
    // toLowerCase() normalizes for comparison, but endsWith on NFD may not match
    // This documents current behavior with decomposed Unicode
    expect(typeof result.hasVoseo).toBe("boolean");
  });

  it("handles zero-width joiners and format characters", () => {
    const text = "Vos\u200Dquer\u00E9s"; // ZWJ in the middle
    const result = detectGrammarFeatures(text);
    expect(typeof result.hasVoseo).toBe("boolean");
  });

  it("handles right-to-left markers without crashing", () => {
    const text = "\u202BVos querés\u202C";
    const result = detectGrammarFeatures(text);
    expect(typeof result.hasVoseo).toBe("boolean");
  });

  it("handles extreme repetition of the same feature", () => {
    const text = "vos querés ".repeat(1000);
    const start = performance.now();
    const result = detectGrammarFeatures(text);
    const elapsed = performance.now() - start;
    expect(result.hasVoseo).toBe(true);
    expect(elapsed).toBeLessThan(200);
  });

  it("handles leísmo trigger at the very start of text", () => {
    const result = detectGrammarFeatures("le vi");
    expect(result.hasLeismo).toBe(true);
  });

  it("handles leísmo trigger at the very end of text", () => {
    const result = detectGrammarFeatures("siempre le quiero");
    expect(result.hasLeismo).toBe(true);
  });

  it("does not false-positive leísmo when 'le' is part of larger word at boundary", () => {
    // "lele" contains "le" but word boundary regex should not match
    const result = detectGrammarFeatures("lele quiere agua");
    expect(result.hasLeismo).toBe(false);
  });

  it("handles laísmo with 'las' before verb at start", () => {
    const result = detectGrammarFeatures("las di todo");
    expect(result.hasLaismo).toBe(true);
  });

  it("handles loísmo with 'los' before verb at start", () => {
    const result = detectGrammarFeatures("los di todo");
    expect(result.hasLoismo).toBe(true);
  });

  it("does not false-positive laísmo on 'la directora' substring", () => {
    const result = detectGrammarFeatures("La directora habló con la diferencia");
    expect(result.hasLaismo).toBe(false);
  });

  it("does not false-positive loísmo on 'lo dice' substring", () => {
    const result = detectGrammarFeatures("Lo dice todo el dios");
    expect(result.hasLoismo).toBe(false);
  });

  it("does not false-positive laísmo on 'la dignidad' substring", () => {
    const result = detectGrammarFeatures("La dignidad es importante");
    expect(result.hasLaismo).toBe(false);
  });

  it("does not false-positive loísmo on 'lo dieron' when not adjacent", () => {
    // "lo" and "dieron" are far apart — should not trigger
    const result = detectGrammarFeatures("Lo que dijeron ayer no importa");
    expect(result.hasLoismo).toBe(false);
  });

  it("handles concurrent calls without state bleed", () => {
    const texts = [
      "Vos querés",
      "Vosotros tenéis",
      "Ustedes tienen",
      "Le vi",
      "La di",
      "Lo di",
    ];
    const results = texts.map((t) => detectGrammarFeatures(t));
    expect(results[0].hasVoseo).toBe(true);
    expect(results[1].hasVosotros).toBe(true);
    expect(results[2].hasUstedes).toBe(true);
    expect(results[3].hasLeismo).toBe(true);
    expect(results[4].hasLaismo).toBe(true);
    expect(results[5].hasLoismo).toBe(true);
  });

  it("handles ustedes at exact word boundary with punctuation", () => {
    const result = detectGrammarFeatures("¡Ustedes! ¿Ustedes? (ustedes)");
    expect(result.hasUstedes).toBe(true);
  });

  it("does not false-positive ustedes on 'ustedeses' or similar", () => {
    const result = detectGrammarFeatures("ustedeses");
    expect(result.hasUstedes).toBe(false);
  });
});
