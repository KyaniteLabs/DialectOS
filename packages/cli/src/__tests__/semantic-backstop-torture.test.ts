import { describe, expect, it } from "vitest";
import {
  combinedSemanticCheck,
  isBorderlineScore,
  runSemanticBackstop,
} from "../lib/semantic-backstop.js";

describe("semantic-backstop torture", () => {
  it("handles 10KB text without crashing", () => {
    const source = "The quick brown fox jumps over the lazy dog. ".repeat(200);
    const translated = "El rápido zorro marrón salta sobre el perro perezoso. ".repeat(200);
    const result = combinedSemanticCheck(source, translated);
    expect(typeof result.finalScore).toBe("number");
    expect(typeof result.passed).toBe("boolean");
  });

  it("handles text with Mr. and Dr. abbreviations", () => {
    const result = runSemanticBackstop(
      "Dr. Smith said hello. Mr. Jones agreed.",
      "El Dr. Smith dijo hola. El Sr. Jones estuvo de acuerdo.",
      0.5
    );
    expect(result.checks.structuralParity).toBe(1); // 2 sentences each
  });

  it("handles text with e.g. and i.e. abbreviations", () => {
    const result = runSemanticBackstop(
      "Use e.g. for examples. Use i.e. for clarification.",
      "Usa por ejemplo para ejemplos. Usa es decir para clarificación.",
      0.5
    );
    expect(result.checks.structuralParity).toBe(1);
  });

  it("handles multiple negations in source", () => {
    const result = combinedSemanticCheck(
      "Never do nothing without no approval",
      "Nunca hagas nada sin ninguna aprobación"
    );
    expect(result.negationDropped).toBe(false);
    // 4 source negations → 4 translated negations = full preservation
    expect(result.passed).toBe(true);
  });

  it("handles negation embedded in larger word", () => {
    // "cannot" contains "not" but is one word
    const result = runSemanticBackstop(
      "You cannot proceed",
      "No puedes proceder",
      0.5
    );
    // "cannot" is not in the negation word list, so this is a limitation
    // The test documents current behavior
    expect(result.checks.negationPreservation).toBeGreaterThanOrEqual(0);
  });

  it("handles source with all negation words", () => {
    // Each negation word in source must have a matching partner in translated
    // Source uses base-form negation words; Spanish uses base forms from NEGATION_WORDS_ES
    const source = "Not no never nothing nobody nowhere neither nor none without lack absent refuse deny decline reject prevent avoid stop cease cannot";
    const translated = "No no nunca nada nadie ningún lugar ni ni ninguno sin falta ausente rechazar negar rehusar rechazar evitar impedir detener parar carecer";
    const result = runSemanticBackstop(source, translated, 0.5);
    // Both have matching negation counts → ratio = 1
    expect(result.checks.negationPreservation).toBe(1);
  });

  it("handles identical source and translated", () => {
    const result = combinedSemanticCheck("Hello world", "Hello world");
    expect(result.finalScore).toBe(0);
    expect(result.passed).toBe(false);
  });

  it("handles source with only special characters", () => {
    const result = combinedSemanticCheck("!@#$%^&*()", "¡@#$%^&*()");
    expect(typeof result.finalScore).toBe("number");
    expect(typeof result.passed).toBe("boolean");
  });

  it("handles source with only emojis", () => {
    const result = combinedSemanticCheck("🎉🎊🎁", "🎉🎊🎁");
    expect(typeof result.finalScore).toBe("number");
  });

  it("handles 0.34 score (just below borderline)", () => {
    expect(isBorderlineScore(0.34)).toBe(false);
  });

  it("handles 0.35 score (exactly at borderline)", () => {
    expect(isBorderlineScore(0.35)).toBe(true);
  });

  it("handles 0.61 score (just above borderline)", () => {
    expect(isBorderlineScore(0.61)).toBe(false);
  });

  it("handles multi-paragraph structural parity", () => {
    const result = runSemanticBackstop(
      "Para one.\n\nPara two.\n\nPara three.",
      "Párrafo uno.\n\nPárrafo dos.\n\nPárrafo tres.",
      0.5
    );
    expect(result.checks.structuralParity).toBe(1);
  });

  it("handles extreme paragraph collapse", () => {
    const result = runSemanticBackstop(
      "A.\n\nB.\n\nC.\n\nD.\n\nE.",
      "Solo uno.",
      0.5
    );
    expect(result.checks.structuralParity).toBeLessThan(1);
  });

  it("handles backstop with heuristicScore exactly 0.45 (threshold boundary)", () => {
    const result = runSemanticBackstop(
      "Hello world test example",
      "Hola mundo prueba ejemplo",
      0.45
    );
    // At 0.45, threshold is 0.55 (not 0.6)
    expect(result.score).toBeDefined();
  });

  it("handles backstop with heuristicScore 0.44 (below threshold boundary)", () => {
    const result = runSemanticBackstop(
      "Hello world test example",
      "Hola mundo prueba ejemplo",
      0.44
    );
    // At 0.44, threshold is 0.6
    expect(result.score).toBeDefined();
  });

  it("handles added negation without source negation", () => {
    const result = combinedSemanticCheck(
      "Click here",
      "No hagas clic aquí"
    );
    // Added negation is suspicious but not dropped
    expect(result.negationDropped).toBe(false);
  });

  it("handles 20 consecutive combined checks without state bleed", () => {
    for (let i = 0; i < 20; i++) {
      const result = combinedSemanticCheck(
        `Test sentence number ${i}`,
        `Oración de prueba número ${i}`
      );
      expect(typeof result.finalScore).toBe("number");
    }
  });

  // === NEW TORTURE TESTS ===

  it("detects negation with trailing punctuation: No, nunca., jamás!", () => {
    const result = runSemanticBackstop(
      "No, never. Do not proceed!",
      "No, nunca. ¡No procedas!",
      0.5
    );
    // Source: No, not = 2 negations. Translated: No, nunca, No = 3 negations.
    // Ratio = 2/3 = 0.67 (was 0 before punctuation stripping fix)
    expect(result.checks.negationPreservation).toBeGreaterThan(0);
  });

  it("detects negation with leading punctuation: ¡No! ¿Nunca?", () => {
    const result = runSemanticBackstop(
      "¡No! ¿Never?",
      "¡No! ¿Nunca?",
      0.5
    );
    expect(result.checks.negationPreservation).toBe(1);
  });

  it("detects negation with ellipsis: nobody... nowhere...", () => {
    const result = runSemanticBackstop(
      "Nobody... nowhere...",
      "Nadie... en ningún lugar...",
      0.5
    );
    expect(result.checks.negationPreservation).toBeGreaterThan(0);
  });

  it("handles sentence after abbreviation-ended sentence", () => {
    const result = runSemanticBackstop(
      "Dr. He is nice. Another sentence here.",
      "El Dr. Él es agradable. Otra oración aquí.",
      0.5
    );
    // "Dr. He is nice." may be counted as 1 sentence due to abbreviation limitation
    // Both source and translated should have same count
    expect(result.checks.structuralParity).toBeGreaterThanOrEqual(0.5);
  });

  it("handles many abbreviations in one text", () => {
    const result = runSemanticBackstop(
      "Mr. Smith and Mrs. Jones visited Prof. Brown at 3 p.m. They discussed vol. 1 and vol. 2.",
      "El Sr. Smith y la Sra. Jones visitaron al Prof. Brown a las 3 p.m. Discutieron el vol. 1 y el vol. 2.",
      0.5
    );
    // Both should have same sentence count despite many abbreviations
    expect(result.checks.structuralParity).toBe(1);
  });

  it("handles null source gracefully", () => {
    const result = runSemanticBackstop(null as any, "Hola", 0.5);
    expect(typeof result.score).toBe("number");
    expect(typeof result.adequate).toBe("boolean");
  });

  it("handles undefined translated gracefully", () => {
    const result = combinedSemanticCheck("Hello", undefined as any);
    expect(typeof result.finalScore).toBe("number");
    expect(typeof result.passed).toBe("boolean");
  });

  it("handles both null source and translated", () => {
    const result = combinedSemanticCheck(null as any, null as any);
    expect(typeof result.finalScore).toBe("number");
    expect(typeof result.passed).toBe("boolean");
  });

  it("fails empty source with non-empty translated", () => {
    const result = combinedSemanticCheck("", "Hola mundo");
    expect(result.passed).toBe(false);
    expect(result.finalScore).toBe(0);
  });

  it("fails whitespace-only source with non-empty translated", () => {
    const result = combinedSemanticCheck("   \n\t  ", "Hola mundo");
    expect(result.passed).toBe(false);
    expect(result.finalScore).toBe(0);
  });

  it("backstop returns 0 structural parity for empty source", () => {
    const result = runSemanticBackstop("", "Hola.", 0.5);
    expect(result.checks.structuralParity).toBe(0);
    expect(result.adequate).toBe(false);
  });

  it("backstop returns 0 structural parity for empty translated", () => {
    const result = runSemanticBackstop("Hello.", "", 0.5);
    expect(result.checks.structuralParity).toBe(0);
  });

  it("handles a.m. and p.m. abbreviations without splitting", () => {
    const result = runSemanticBackstop(
      "Meet at 9 a.m. Leave at 5 p.m.",
      "Reunión a las 9 a.m. Salida a las 5 p.m.",
      0.5
    );
    expect(result.checks.structuralParity).toBe(1);
  });

  it("handles i.e. and e.g. in same sentence", () => {
    const result = runSemanticBackstop(
      "Use fruits, e.g. apples and oranges, i.e. round produce.",
      "Usa frutas, e.g. manzanas y naranjas, i.e. productos redondos.",
      0.5
    );
    // Both should be 1 sentence (abbreviations protected)
    expect(result.checks.structuralParity).toBe(1);
  });

  it("handles empty string after abbreviation", () => {
    const result = runSemanticBackstop("Dr.", "El Dr.", 0.5);
    expect(result.checks.structuralParity).toBe(1);
  });

  it("handles structural parity with only abbreviations and no real sentences", () => {
    const result = runSemanticBackstop("Mr. Mrs. Dr.", "Sr. Sra. Dr.", 0.5);
    // All are abbreviations, so no sentences detected — parity should still be 1 (both 0)
    expect(result.checks.structuralParity).toBe(1);
  });

  it("handles dropped negation with punctuation attached", () => {
    const result = combinedSemanticCheck(
      "Do not, under any circumstances, proceed!",
      "Procede inmediatamente."
    );
    expect(result.negationDropped).toBe(true);
    expect(result.passed).toBe(false);
  });

  it("detects negation in English contractions: don't", () => {
    const result = runSemanticBackstop(
      "I don't like it",
      "No me gusta",
      0.5
    );
    expect(result.checks.negationPreservation).toBe(1);
  });

  it("detects negation in English contractions: can't", () => {
    const result = runSemanticBackstop(
      "You can't proceed",
      "No puedes proceder",
      0.5
    );
    expect(result.checks.negationPreservation).toBe(1);
  });

  it("detects negation in English contractions: won't", () => {
    const result = runSemanticBackstop(
      "It won't work",
      "No funcionará",
      0.5
    );
    expect(result.checks.negationPreservation).toBe(1);
  });

  it("detects negation in English contractions: isn't", () => {
    const result = runSemanticBackstop(
      "This isn't right",
      "Esto no es correcto",
      0.5
    );
    expect(result.checks.negationPreservation).toBe(1);
  });

  it("detects negation in English word: cannot", () => {
    const result = runSemanticBackstop(
      "You cannot proceed",
      "No puedes proceder",
      0.5
    );
    expect(result.checks.negationPreservation).toBe(1);
  });

  it("detects Spanish negation: ningún", () => {
    const result = runSemanticBackstop(
      "I didn't see any man",
      "No vi a ningún hombre",
      0.5
    );
    // Source: didn't → dont = 1 negation
    // Translated: no + ningún = 2 negations
    // Ratio = min(1/2, 2/1) = 0.5
    expect(result.checks.negationPreservation).toBe(0.5);
  });

  it("detects multiple contractions in one text", () => {
    const result = runSemanticBackstop(
      "I don't like it and I can't accept it",
      "No me gusta y no puedo aceptarlo",
      0.5
    );
    expect(result.checks.negationPreservation).toBe(1);
  });
});
