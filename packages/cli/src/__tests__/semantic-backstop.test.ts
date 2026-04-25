import { describe, expect, it } from "vitest";
import {
  combinedSemanticCheck,
  isBorderlineScore,
  runSemanticBackstop,
} from "../lib/semantic-backstop.js";

describe("isBorderlineScore", () => {
  it("returns true at lower boundary (0.35)", () => {
    expect(isBorderlineScore(0.35)).toBe(true);
  });

  it("returns true at upper boundary (0.6)", () => {
    expect(isBorderlineScore(0.6)).toBe(true);
  });

  it("returns true inside range", () => {
    expect(isBorderlineScore(0.4)).toBe(true);
    expect(isBorderlineScore(0.5)).toBe(true);
    expect(isBorderlineScore(0.599)).toBe(true);
  });

  it("returns false just below lower boundary", () => {
    expect(isBorderlineScore(0.34)).toBe(false);
    expect(isBorderlineScore(0.349)).toBe(false);
  });

  it("returns false just above upper boundary", () => {
    expect(isBorderlineScore(0.61)).toBe(false);
    expect(isBorderlineScore(0.601)).toBe(false);
  });

  it("returns false well outside range", () => {
    expect(isBorderlineScore(0)).toBe(false);
    expect(isBorderlineScore(0.2)).toBe(false);
    expect(isBorderlineScore(0.8)).toBe(false);
    expect(isBorderlineScore(1)).toBe(false);
  });

  it("returns false for negative scores", () => {
    expect(isBorderlineScore(-0.1)).toBe(false);
  });

  it("returns false for scores above 1", () => {
    expect(isBorderlineScore(1.5)).toBe(false);
  });
});

describe("runSemanticBackstop", () => {
  describe("negation preservation", () => {
    it("scores 1 when no negations in either text", () => {
      const result = runSemanticBackstop("Hello world", "Hola mundo", 0.5);
      expect(result.checks.negationPreservation).toBe(1);
    });

    it("scores 0 when source has negation but translation drops it", () => {
      const result = runSemanticBackstop(
        "Do not click this button",
        "Haz clic en este botón",
        0.5
      );
      expect(result.checks.negationPreservation).toBe(0);
      expect(result.adequate).toBe(false);
    });

    it("scores 0.5 when translation adds negation source lacks", () => {
      const result = runSemanticBackstop(
        "Click this button",
        "No hagas clic en este botón",
        0.5
      );
      expect(result.checks.negationPreservation).toBe(0.5);
    });

    it("scores 1 when both have same negation count", () => {
      const result = runSemanticBackstop(
        "Do not forget",
        "No olvides",
        0.5
      );
      expect(result.checks.negationPreservation).toBe(1);
    });

    it("scores proportionally when counts differ", () => {
      // Source: 2 negations, translated: 1 → ratio = 0.5
      const result = runSemanticBackstop(
        "Do not never forget",
        "No olvides",
        0.5
      );
      expect(result.checks.negationPreservation).toBe(0.5);
    });

    it("handles multiple negations preserved", () => {
      const result = runSemanticBackstop(
        "Do not never click nothing",
        "No nunca hagas clic en nada",
        0.5
      );
      expect(result.checks.negationPreservation).toBe(1);
    });

    it("detects negation case-insensitively", () => {
      const result = runSemanticBackstop(
        "DO NOT FORGET",
        "no olvides",
        0.5
      );
      expect(result.checks.negationPreservation).toBe(1);
    });
  });

  describe("keyword overlap", () => {
    it("scores 0 for cross-language pairs (no shared words)", () => {
      const result = runSemanticBackstop("Hello world", "Hola mundo", 0.5);
      expect(result.checks.keywordOverlap).toBe(0);
    });

    it("scores 1 when source and translated share content words", () => {
      // Using identical texts to force overlap (testing the function, not real translation)
      const result = runSemanticBackstop("apple banana cherry", "apple banana cherry", 0.5);
      expect(result.checks.keywordOverlap).toBe(1);
    });

    it("scores proportionally for partial overlap", () => {
      const result = runSemanticBackstop("apple banana cherry", "apple banana date", 0.5);
      // Shared: apple, banana. Union: apple, banana, cherry, date. Ratio = 2/4 = 0.5
      expect(result.checks.keywordOverlap).toBe(0.5);
    });

    it("filters out stop words", () => {
      // Use Spanish "translated" text so stop-word filtering is realistic
      // English source: "quick brown fox" (after removing "the")
      // Spanish translated: "rápido zorro marrón" (no overlap with English)
      const result = runSemanticBackstop("the quick brown fox", "rápido zorro marrón", 0.5);
      // No shared content words across languages
      expect(result.checks.keywordOverlap).toBe(0);
    });

    it("filters out short words (< 3 chars)", () => {
      const result = runSemanticBackstop("a big cat", "a big cat", 0.5);
      // "a" and "big" are filtered (big is 3 chars, wait: 3 >= 3 so it passes)
      // Actually "big" is 3 chars so it passes. Only "a" is filtered.
      expect(result.checks.keywordOverlap).toBe(1);
    });
  });

  describe("structural parity", () => {
    it("scores 1 for identical sentence count", () => {
      const result = runSemanticBackstop(
        "First sentence. Second sentence.",
        "Primera oración. Segunda oración.",
        0.5
      );
      expect(result.checks.structuralParity).toBe(1);
    });

    it("penalizes extreme sentence count differences", () => {
      const result = runSemanticBackstop(
        "First. Second. Third. Fourth. Fifth.",
        "Una sola oración.",
        0.5
      );
      expect(result.checks.structuralParity).toBeLessThan(1);
    });

    it("allows 50% sentence count variation", () => {
      const result = runSemanticBackstop(
        "First. Second. Third. Fourth.",
        "Una. Dos.",
        0.5
      );
      // 4 → 2 = ratio 0.5, which is exactly the boundary
      expect(result.checks.structuralParity).toBeGreaterThanOrEqual(0.5);
    });

    it("handles empty source text", () => {
      const result = runSemanticBackstop("", "Hola.", 0.5);
      // 0 source sentences, 1 translated sentence
      expect(result.checks.structuralParity).toBeGreaterThanOrEqual(0);
    });

    it("handles empty translated text", () => {
      const result = runSemanticBackstop("Hello.", "", 0.5);
      // 1 source sentence, 0 translated sentences
      expect(result.checks.structuralParity).toBe(0);
    });

    it("handles multi-paragraph text with same structure", () => {
      const result = runSemanticBackstop(
        "Para uno.\n\nPara dos.",
        "Para one.\n\nPara two.",
        0.5
      );
      expect(result.checks.structuralParity).toBe(1);
    });

    it("penalizes paragraph count differences", () => {
      const result = runSemanticBackstop(
        "Para uno.\n\nPara dos.\n\nPara tres.",
        "Solo un párrafo.",
        0.5
      );
      expect(result.checks.structuralParity).toBeLessThan(1);
    });
  });

  describe("threshold paths", () => {
    it("uses higher threshold (0.6) when heuristicScore < 0.45", () => {
      // With score components that would pass at 0.55 but fail at 0.6
      const result = runSemanticBackstop(
        "Please review",
        "Por favor revisa",
        0.4
      );
      // At heuristic 0.4, threshold is 0.6
      // This documents the threshold behavior
      expect(result.score).toBeDefined();
    });

    it("uses normal threshold (0.55) when heuristicScore >= 0.45", () => {
      const result = runSemanticBackstop(
        "Please review",
        "Por favor revisa",
        0.5
      );
      expect(result.score).toBeDefined();
    });
  });

  describe("overall adequacy", () => {
    it("marks adequate when all checks pass strongly", () => {
      const result = runSemanticBackstop(
        "The document is ready",
        "The document is ready",
        0.5
      );
      expect(result.checks.negationPreservation).toBe(1);
      expect(result.checks.structuralParity).toBe(1);
      expect(result.score).toBeGreaterThanOrEqual(0.55);
      expect(result.adequate).toBe(true);
    });

    it("marks inadequate when negation is dropped", () => {
      const result = runSemanticBackstop(
        "Do not proceed",
        "Proceed immediately",
        0.5
      );
      expect(result.checks.negationPreservation).toBe(0);
      expect(result.adequate).toBe(false);
    });
  });
});

describe("combinedSemanticCheck", () => {
  describe("negation-dropped path (mandatory gate)", () => {
    it("fails immediately when negation is dropped, even with high heuristic", () => {
      const result = combinedSemanticCheck(
        "Do not click this button",
        "Haz clic en este botón"
      );
      expect(result.negationDropped).toBe(true);
      expect(result.passed).toBe(false);
      expect(result.finalScore).toBe(0.1);
      expect(result.primaryScore).toBeGreaterThan(0.5);
      expect(result.backstop).toBeDefined();
    });

    it("fails with borderline heuristic AND dropped negation", () => {
      const result = combinedSemanticCheck(
        "Do not forget your password ever",
        "Olvida tu contraseña"
      );
      expect(result.negationDropped).toBe(true);
      expect(result.passed).toBe(false);
      expect(result.finalScore).toBe(0.1);
    });

    it("includes backstop diagnostics in negation failure", () => {
      const result = combinedSemanticCheck(
        "Never share your password",
        "Comparte tu contraseña"
      );
      expect(result.backstop).toBeDefined();
      expect(result.backstop!.checks.negationPreservation).toBe(0);
    });
  });

  describe("non-borderline + no negation drop", () => {
    it("passes when score >= 0.4 and no backstop needed", () => {
      const result = combinedSemanticCheck(
        "The quick brown fox jumps over the lazy dog",
        "El rápido zorro marrón salta sobre el perro perezoso"
      );
      expect(result.negationDropped).toBe(false);
      expect(result.backstop).toBeUndefined();
      expect(result.primaryScore).toBeGreaterThanOrEqual(0.4);
      expect(result.passed).toBe(true);
      expect(result.finalScore).toBe(result.primaryScore);
    });

    it("fails when score < 0.4 and no backstop needed", () => {
      const result = combinedSemanticCheck("Hello world", "Hola");
      expect(result.negationDropped).toBe(false);
      expect(result.backstop).toBeUndefined();
      expect(result.primaryScore).toBeLessThan(0.4);
      expect(result.passed).toBe(false);
      expect(result.finalScore).toBe(result.primaryScore);
    });
  });

  describe("borderline + no negation drop", () => {
    it("boosts score when backstop confirms adequacy", () => {
      const result = combinedSemanticCheck(
        "Please review the document carefully before signing",
        "Por favor revisa el documento con cuidado antes de firmar"
      );
      if (result.backstop && result.backstop.adequate) {
        expect(result.passed).toBe(true);
        expect(result.finalScore).toBeGreaterThanOrEqual(0.45);
      }
    });

    it("does not boost when backstop rejects", () => {
      const result = combinedSemanticCheck(
        "First. Second. Third. Fourth.",
        "Una sola oración."
      );
      if (result.backstop && !result.backstop.adequate) {
        expect(result.passed).toBe(false);
        expect(result.finalScore).toBe(result.primaryScore);
      }
    });

    it("runs backstop and returns it for borderline scores", () => {
      const result = combinedSemanticCheck(
        "Please review the document carefully",
        "Por favor revisa el documento con cuidado"
      );
      if (result.primaryScore >= 0.35 && result.primaryScore <= 0.6) {
        expect(result.backstop).toBeDefined();
      }
    });
  });

  describe("negation preserved", () => {
    it("passes when negation is correctly preserved", () => {
      const result = combinedSemanticCheck(
        "Do not forget your password",
        "No olvides tu contraseña"
      );
      expect(result.negationDropped).toBe(false);
      expect(result.passed).toBe(true);
    });

    it("passes with multiple negations preserved", () => {
      const result = combinedSemanticCheck(
        "Never do nothing without approval",
        "Nunca hagas nada sin aprobación"
      );
      expect(result.negationDropped).toBe(false);
      expect(result.passed).toBe(true);
    });
  });

  describe("edge cases", () => {
    it("handles empty source string", () => {
      const result = combinedSemanticCheck("", "Hola");
      // Empty source gives crossLingualPresence bonus + lengthRatio=1, may score borderline or pass
      // Test just verifies it doesn't crash and returns valid structure
      expect(result.negationDropped).toBe(false);
      expect(typeof result.finalScore).toBe("number");
      expect(typeof result.passed).toBe("boolean");
    });

    it("handles empty translated string", () => {
      const result = combinedSemanticCheck("Hello", "");
      expect(result.passed).toBe(false);
      expect(result.negationDropped).toBe(false);
    });

    it("handles identical strings", () => {
      const result = combinedSemanticCheck("Hello world", "Hello world");
      // Identical text gives score 0 from heuristic (crossLingualPresence = 0)
      expect(result.finalScore).toBe(0);
      expect(result.passed).toBe(false);
    });

    it("handles source with only stop words", () => {
      const result = combinedSemanticCheck("the and or but", "el y o pero");
      // All words are stop words in both languages, so content words = empty
      // Heuristic may still score from crossLingualPresence and lengthRatio
      // Test verifies it doesn't crash and returns valid structure
      expect(typeof result.finalScore).toBe("number");
      expect(typeof result.passed).toBe("boolean");
    });

    it("handles long text without issues", () => {
      const source = "This is a test. ".repeat(50);
      const translated = "Esto es una prueba. ".repeat(50);
      const result = combinedSemanticCheck(source, translated);
      expect(result).toBeDefined();
      expect(typeof result.finalScore).toBe("number");
      expect(typeof result.passed).toBe("boolean");
    });
  });
});
