import { describe, it, expect } from "vitest";
import { applyLexicalSubstitution } from "../lexical-substitution.js";

describe("applyLexicalSubstitution", () => {
  it("swaps wrong-dialect words to correct dialect terms", () => {
    const result = applyLexicalSubstitution("Necesito conducir mi coche al trabajo.", "es-MX");
    expect(result).toContain("carro");
    expect(result).not.toContain("coche");
  });

  it("fixes article gender when noun swap changes gender (f → m)", () => {
    const result = applyLexicalSubstitution("Encendí la computadora para abrir el archivo.", "es-ES");
    expect(result).toContain("el ordenador");
    expect(result).not.toContain("la computadora");
  });

  it("fixes article gender when noun swap changes gender (m → f)", () => {
    const result = applyLexicalSubstitution("El pastel está en el horno.", "es-ES");
    expect(result).toContain("La tarta");
    expect(result).not.toContain("El pastel");
  });

  it("preserves capitalization", () => {
    const result = applyLexicalSubstitution("Coche rojo", "es-MX");
    expect(result).toContain("Carro");
    expect(result).not.toContain("Coche");
  });

  it("does not swap words that are already correct for the dialect", () => {
    const result = applyLexicalSubstitution("Necesito manejar mi carro al trabajo.", "es-MX");
    expect(result).toContain("carro");
    expect(result).toContain("manejar");
  });

  it("handles multiple swaps in one sentence", () => {
    const result = applyLexicalSubstitution(
      "El coche y la computadora están en el aparcamiento.",
      "es-MX"
    );
    expect(result).toContain("carro");
    expect(result).toContain("computadora");
    // aparcamiento → estacionamiento for es-MX
    expect(result).toContain("estacionamiento");
    expect(result).not.toContain("coche");
    expect(result).not.toContain("aparcamiento");
  });

  it("does not swap substrings (word-boundary matching)", () => {
    // "coche" is a wrong term for es-MX, but "cochete" is not in the dictionary
    // so it should remain unchanged — proving substring matching doesn't happen
    const result = applyLexicalSubstitution("Mi cochete es rojo.", "es-MX");
    expect(result).toContain("cochete");
    expect(result).not.toContain("carrote");
  });

  it("returns input unchanged for unknown dialect", () => {
    const input = "El coche está aquí.";
    const result = applyLexicalSubstitution(input, "" as any);
    expect(result).toBe(input);
  });

  it("returns input unchanged for empty text", () => {
    expect(applyLexicalSubstitution("", "es-MX")).toBe("");
  });

  it("swaps bus terms correctly for Caribbean dialects", () => {
    const result = applyLexicalSubstitution("Tomé el autobús al centro.", "es-CU");
    expect(result).toContain("guagua");
    expect(result).not.toContain("autobús");
  });

  it("swaps juice terms correctly for Spain", () => {
    const result = applyLexicalSubstitution("Bebí un vaso de jugo.", "es-ES");
    expect(result).toContain("zumo");
    expect(result).not.toContain("jugo");
  });

  it("does not swap ambiguous slang terms with common non-slang meanings", () => {
    // "botón" = button (UI) but also es-UY slang for "cop". Must NOT swap to "tomba".
    expect(applyLexicalSubstitution("Haga clic en el botón para continuar.", "es-CO"))
      .toContain("botón");

    // "agente" = agent (generic) but also es-EC variant for "cop". Must NOT swap.
    expect(applyLexicalSubstitution("El agente secreto fue descubierto.", "es-CO"))
      .toContain("agente");

    // "cuero" = leather but also es-DO slang for "money" and "cop". Must NOT swap.
    expect(applyLexicalSubstitution("El cuero del zapato está dañado.", "es-CO"))
      .toContain("cuero");
  });

  it("still swaps unambiguous slang terms correctly", () => {
    // "paco" (es-CL cop slang) is unambiguous — should still swap
    const result = applyLexicalSubstitution("El paco está en la esquina.", "es-CO");
    expect(result).toContain("tomba");
    expect(result).not.toContain("paco");
  });
});

describe("applyLexicalSubstitution: meaning guards", () => {
  it("does not turn 'padre' into the potato word", () => {
    const result = applyLexicalSubstitution("El padre de Juan llegó.", "es-MX");
    expect(result).not.toMatch(/\bpapa\b/i);
    expect(result).not.toContain("La papa");
  });

  it("does not swap toward informal-only terms ('hermano' stays a brother)", () => {
    const result = applyLexicalSubstitution("Tengo un hermano.", "es-VE");
    expect(result).toBe("Tengo un hermano.");
  });

  it("skips a word whose senses map to different terms in the dialect", () => {
    const result = applyLexicalSubstitution("Tomamos la guagua.", "es-MX");
    expect(result).toBe("Tomamos la guagua.");
  });
});

describe("applyLexicalSubstitution: predicate adjective agreement", () => {
  it("flips the adjective after a linking verb when the noun changes gender", () => {
    expect(applyLexicalSubstitution("El ordenador está listo.", "es-MX")).toBe("La computadora está lista.");
    expect(applyLexicalSubstitution("La computadora está lista.", "es-ES")).toBe("El ordenador está listo.");
  });

  it("handles plurals, negation and a degree word", () => {
    expect(applyLexicalSubstitution("Los ordenadores no son muy caros.", "es-MX")).toBe(
      "Las computadoras no son muy caras.",
    );
  });

  it("leaves non-agreeing words and invariant adjectives alone", () => {
    expect(applyLexicalSubstitution("El ordenador es como nuevo.", "es-MX")).toBe("La computadora es como nuevo.");
    expect(applyLexicalSubstitution("El ordenador es rosa.", "es-MX")).toBe("La computadora es rosa.");
  });

  it("does not touch a verb right after the noun", () => {
    expect(applyLexicalSubstitution("La computadora trabaja bien.", "es-ES")).toBe("El ordenador trabaja bien.");
  });
});

describe("applyLexicalSubstitution: invariant -ista adjectives", () => {
  it("keeps an -ista adjective unchanged", () => {
    expect(applyLexicalSubstitution("El ordenador es minimalista.", "es-MX")).toBe("La computadora es minimalista.");
  });
});
