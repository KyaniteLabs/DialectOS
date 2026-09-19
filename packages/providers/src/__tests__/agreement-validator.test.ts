import { describe, expect, it } from "vitest";
import { validateAgreement, applyAgreementFixes } from "../agreement-validator.js";

describe("validateAgreement", () => {
  it("passes for correct text", () => {
    const result = validateAgreement("El carro está en la casa.");
    expect(result.passed).toBe(true);
    expect(result.warnings).toHaveLength(0);
  });

  it("detects el computadora as gender mismatch", () => {
    const result = validateAgreement("El computadora está rota.");
    expect(result.passed).toBe(false);
    expect(result.warnings.length).toBeGreaterThanOrEqual(1);
    const w = result.warnings[0];
    expect(w.type).toBe("gender");
    expect(w.found).toContain("computadora");
    expect(w.suggestion).toContain("la computadora");
  });

  it("detects la carro as gender mismatch", () => {
    const result = validateAgreement("La carro es rojo.");
    expect(result.passed).toBe(false);
    expect(result.warnings.some((w) => w.found.includes("carro"))).toBe(true);
  });

  it("detects el guagua mismatch", () => {
    const result = validateAgreement("Fui al guagua al centro.");
    expect(result.passed).toBe(false);
    const guaguaWarning = result.warnings.find((w) => w.found.includes("guagua"));
    expect(guaguaWarning).toBeDefined();
    expect(guaguaWarning?.suggestion).toContain("la guagua");
  });

  it("passes for la guagua", () => {
    const result = validateAgreement("Fui en la guagua al centro.");
    expect(result.warnings.filter((w) => w.found.includes("guagua"))).toHaveLength(0);
  });

  it("handles multiple mismatches in one sentence", () => {
    const result = validateAgreement("El computadora está en el casa.");
    expect(result.warnings.length).toBeGreaterThanOrEqual(2);
  });

  it("does not flag non-noun words", () => {
    const result = validateAgreement("La verdad es que el libro es bueno.");
    expect(result.passed).toBe(true);
  });

  it("handles text without articles", () => {
    const result = validateAgreement("Necesito manejar mi carro a trabajo.");
    expect(result.passed).toBe(true);
  });

  it("detects plural article with singular noun (number mismatch)", () => {
    const result = validateAgreement("Los carro son rojos.");
    const numberWarnings = result.warnings.filter((w) => w.type === "number");
    expect(numberWarnings.length).toBeGreaterThanOrEqual(1);
  });

  it("passes for correct plural agreement", () => {
    const result = validateAgreement("Los carros son rojos.");
    const numberWarnings = result.warnings.filter((w) => w.type === "number");
    expect(numberWarnings).toHaveLength(0);
  });

  it("detects gender mismatch in plural (los computadoras)", () => {
    const result = validateAgreement("Los computadoras son nuevas.");
    const genderWarnings = result.warnings.filter((w) => w.type === "gender");
    expect(genderWarnings.length).toBeGreaterThanOrEqual(1);
  });
});

describe("ambiguous homographs (CEO rule 2026-09-19)", () => {
  it("preserves el papa (the Pope): no warning, note emitted, still passes", () => {
    const result = validateAgreement("El papa llegó a Roma.");
    expect(result.warnings.filter((w) => w.found.toLowerCase().includes("papa"))).toHaveLength(0);
    expect(result.passed).toBe(true);
    const note = result.notes.find((n) => n.noun === "papa");
    expect(note).toBeDefined();
    expect(note?.type).toBe("ambiguous-gender");
    expect(note?.found.toLowerCase()).toBe("el papa");
  });

  it("preserves la papa (the potato): no warning, note emitted", () => {
    const result = validateAgreement("La papa está sabrosa.");
    expect(result.warnings).toHaveLength(0);
    expect(result.notes.some((n) => n.noun === "papa")).toBe(true);
  });

  it("preserves el papá (the dad): agrees as masculine, no ambiguity note", () => {
    const result = validateAgreement("El papá llegó tarde.");
    expect(result.warnings).toHaveLength(0);
    expect(result.notes.some((n) => n.noun === "papá")).toBe(false);
  });

  it("still fixes genuine mismatches like el computadora", () => {
    const result = validateAgreement("El computadora está rota.");
    expect(result.warnings.some((w) => w.type === "gender" && w.found.toLowerCase().includes("computadora"))).toBe(true);
    expect(result.notes).toHaveLength(0);
  });

  it("applyAgreementFixes never rewrites ambiguous articles", () => {
    expect(applyAgreementFixes("El papa llegó a Roma.")).toBe("El papa llegó a Roma.");
    expect(applyAgreementFixes("La papa está sabrosa.")).toBe("La papa está sabrosa.");
    expect(applyAgreementFixes("El papá llegó tarde.")).toBe("El papá llegó tarde.");
  });

  it("applyAgreementFixes still fixes el computadora to la computadora", () => {
    expect(applyAgreementFixes("El computadora está rota.")).toContain("la computadora");
  });

  it("color and calor remain masculine (wave-1 regression kept)", () => {
    expect(applyAgreementFixes("El color y el calor del verano.")).toBe("El color y el calor del verano.");
    const fixed = applyAgreementFixes("la color y la calor");
    expect(fixed).toContain("el color");
    expect(fixed).toContain("el calor");
  });
});

describe("applyAgreementFixes", () => {
  it("fixes el computadora to la computadora", () => {
    const fixed = applyAgreementFixes("El computadora está rota.");
    expect(fixed).toContain("la computadora");
    expect(fixed).not.toContain("El computadora");
  });

  it("fixes el guagua to la guagua", () => {
    const fixed = applyAgreementFixes("Fui al guagua al centro.");
    expect(fixed).toContain("la guagua");
  });

  it("returns unchanged text when no fixes needed", () => {
    const original = "El carro está en la casa.";
    expect(applyAgreementFixes(original)).toBe(original);
  });
});
