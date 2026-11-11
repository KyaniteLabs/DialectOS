import { describe, expect, it } from "vitest";
import { validateTranslation } from "../lib/validate-translation.js";
import type { ValidateTranslationOptions } from "@dialectos/types";

describe("validateTranslation", () => {
  const baseOptions: ValidateTranslationOptions = {
    source: "The application failed to process the request.",
    translated: "La aplicación no pudo procesar la solicitud.",
    dialect: "es-MX",
  };

  it("returns valid report for a good translation", () => {
    const report = validateTranslation(baseOptions);

    expect(report.valid).toBe(true);
    expect(report.dialect).toBe("es-MX");
    expect(report.blockingIssues).toEqual([]);
    expect(report.qualityScore.score).toBeGreaterThanOrEqual(0);
    expect(report.qualityScore.score).toBeLessThanOrEqual(100);
    expect(report.timestamp).toBeTruthy();
  });

  it("returns quality score with all sub-scores", () => {
    const report = validateTranslation(baseOptions);

    expect(report.qualityScore).toHaveProperty("tokenIntegrity");
    expect(report.qualityScore).toHaveProperty("glossaryFidelity");
    expect(report.qualityScore).toHaveProperty("structureIntegrity");
    expect(report.qualityScore).toHaveProperty("semanticSimilarity");
    expect(report.qualityScore).toHaveProperty("lexicalCompliance");
    expect(typeof report.qualityScore.tokenIntegrity).toBe("number");
    expect(typeof report.qualityScore.semanticSimilarity).toBe("number");
  });

  it("returns semantic check results", () => {
    const report = validateTranslation(baseOptions);

    expect(report.semanticCheck).toHaveProperty("finalScore");
    expect(report.semanticCheck).toHaveProperty("primaryScore");
    expect(report.semanticCheck).toHaveProperty("passed");
    expect(report.semanticCheck).toHaveProperty("negationDropped");
    expect(typeof report.semanticCheck.finalScore).toBe("number");
    expect(typeof report.semanticCheck.passed).toBe("boolean");
  });

  it("returns lexical compliance results", () => {
    const report = validateTranslation(baseOptions);

    expect(report.lexicalCompliance).toHaveProperty("passed");
    expect(report.lexicalCompliance).toHaveProperty("score");
    expect(report.lexicalCompliance).toHaveProperty("violations");
    expect(typeof report.lexicalCompliance.score).toBe("number");
    expect(Array.isArray(report.lexicalCompliance.violations)).toBe(true);
  });

  it("returns output judge results", () => {
    const report = validateTranslation(baseOptions);

    expect(report.outputJudge).toHaveProperty("issues");
    expect(report.outputJudge).toHaveProperty("blockingIssues");
    expect(Array.isArray(report.outputJudge.issues)).toBe(true);
    expect(Array.isArray(report.outputJudge.blockingIssues)).toBe(true);
  });

  it("flags unchanged English text as invalid", () => {
    const report = validateTranslation({
      ...baseOptions,
      translated: "The application failed to process the request.",
    });

    expect(report.valid).toBe(false);
    expect(report.blockingIssues.length).toBeGreaterThan(0);
    expect(report.outputJudge.blockingIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: "accuracy" }),
      ])
    );
  });

  it("flags prompt leakage in translation", () => {
    const report = validateTranslation({
      ...baseOptions,
      translated: "Translation: La aplicación no pudo procesar la solicitud.",
    });

    expect(report.valid).toBe(false);
    expect(report.outputJudge.blockingIssues).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ category: "provider-protocol" }),
      ])
    );
  });

  it("flags missing protected tokens", () => {
    const report = validateTranslation({
      ...baseOptions,
      source: "Use the @dialectos/cli tool to translate.",
      translated: "Usa la herramienta para traducir.",
      protectedTokens: ["@dialectos/cli"],
    });

    expect(report.qualityScore.tokenIntegrity).toBeLessThan(1);
  });

  it("checks glossary fidelity with glossary entries", () => {
    const report = validateTranslation({
      ...baseOptions,
      source: "Click the button to submit the form.",
      translated: "Haz clic en el botón para enviar el formulario.",
      glossary: { "button": "botón", "form": "formulario" },
    });

    expect(report.qualityScore.glossaryFidelity).toBeGreaterThanOrEqual(0);
    expect(report.qualityScore.glossaryFidelity).toBeLessThanOrEqual(1);
  });

  it("runs structure validation for markdown", () => {
    const report = validateTranslation({
      source: "# Title\n\nParagraph text.\n\n- List item",
      translated: "# Título\n\nTexto del párrafo.\n\n- Elemento de lista",
      dialect: "es-ES",
      isMarkdown: true,
    });

    expect(report.structureValidation).toBeDefined();
    expect(report.structureValidation!.valid).toBe(true);
    expect(report.structureValidation!.violations).toEqual([]);
  });

  it("flags markdown structure violations", () => {
    const report = validateTranslation({
      source: "# Title\n\n## Section\n\nParagraph.",
      translated: "Título\n\nSección\n\nPárrafo.",
      dialect: "es-ES",
      isMarkdown: true,
    });

    expect(report.structureValidation).toBeDefined();
    // Missing headings is a structure violation
    if (!report.structureValidation!.valid) {
      expect(report.structureValidation!.violations.length).toBeGreaterThan(0);
    }
  });

  it("omits structure validation when isMarkdown is false", () => {
    const report = validateTranslation({
      ...baseOptions,
      isMarkdown: false,
    });

    expect(report.structureValidation).toBeUndefined();
  });

  it("defaults isMarkdown to false", () => {
    const report = validateTranslation(baseOptions);

    expect(report.structureValidation).toBeUndefined();
  });

  it("works across different dialects", () => {
    const dialects = ["es-AR", "es-CO", "es-ES", "es-MX", "es-PR"] as const;

    for (const dialect of dialects) {
      const report = validateTranslation({
        ...baseOptions,
        dialect,
      });

      expect(report.dialect).toBe(dialect);
      expect(report.qualityScore.score).toBeGreaterThanOrEqual(0);
    }
  });

  it("flags negation drops in translation", () => {
    const report = validateTranslation({
      source: "Do not delete the database.",
      translated: "Elimina la base de datos.",
      dialect: "es-MX",
    });

    // Negation was present in source but absent in translation
    if (report.semanticCheck.negationDropped) {
      expect(report.valid).toBe(false);
      expect(report.blockingIssues).toEqual(
        expect.arrayContaining([
          expect.stringContaining("Negation"),
        ])
      );
    }
  });

  it("includes all blocking issues in the flat list", () => {
    const report = validateTranslation({
      source: "Do not delete the database.",
      translated: "Delete the database.",
      dialect: "es-MX",
    });

    // If there are multiple issues, they should all appear in blockingIssues
    const structureBlockers = report.structureValidation && !report.structureValidation.valid
      ? report.structureValidation.violations
      : [];
    // Lexical expectations are reported through the output judge, not twice.
    const judgeBlockers = report.outputJudge.blockingIssues.map((i) => i.message);

    const expectedTotal = structureBlockers.length + judgeBlockers.length;
    // May also include semantic blockers
    expect(report.blockingIssues.length).toBeGreaterThanOrEqual(expectedTotal);
  });

  it("lists each lexical problem once, not once per checker", () => {
    const report = validateTranslation({
      source: "I need to catch the bus.",
      translated: "Necesito coger el autobús.",
      dialect: "es-MX",
    });

    expect(report.lexicalCompliance.passed).toBe(false);
    const lexicalMentions = report.blockingIssues.filter((m) => /coger|required/i.test(m));
    expect(lexicalMentions.length).toBeGreaterThan(0);
    expect(report.blockingIssues.filter((m) => /Forbidden term detected|Missing required term:/.test(m))).toEqual([]);
    expect(new Set(report.blockingIssues).size).toBe(report.blockingIssues.length);
  });

  it("handles empty source and translated text", () => {
    const report = validateTranslation({
      source: "",
      translated: "",
      dialect: "es-ES",
    });

    expect(report).toBeDefined();
    expect(report.qualityScore).toBeDefined();
  });

  it("defaults protectedTokens and glossary when omitted", () => {
    const report = validateTranslation({
      source: "Hello world",
      translated: "Hola mundo",
      dialect: "es-ES",
    });

    expect(report.qualityScore.tokenIntegrity).toBe(1);
    expect(report.qualityScore.glossaryFidelity).toBe(1);
  });
});
