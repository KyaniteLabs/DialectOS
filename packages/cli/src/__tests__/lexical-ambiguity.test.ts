import { describe, expect, it } from "vitest";
import { buildLexicalAmbiguityGuidance } from "../lib/lexical-ambiguity.js";
import { buildSemanticTranslationContext } from "../lib/semantic-context.js";

describe("lexical ambiguity constraints", () => {
  it("distinguishes file pickup from download/coger in Mexican Spanish", () => {
    const guidance = buildLexicalAmbiguityGuidance(
      "Pick up the file before deployment.",
      "es-MX"
    );

    expect(guidance).toContain("[pickup-file]");
    expect(guidance).toContain("recoger/recoge/recuperar");
    expect(guidance).toContain("Do not use coger");
    expect(guidance).toContain("Do not change the action to descargar/download");
  });

  it("maps transport take/catch to tomar or abordar rather than coger", () => {
    const guidance = buildLexicalAmbiguityGuidance(
      "Take the bus to the office.",
      "es-MX"
    );

    expect(guidance).toContain("[take-bus]");
    expect(guidance).toContain("tomar/toma");
    expect(guidance).toContain("abordar/aborda");
    expect(guidance).toContain("guagua");
  });

  it("keeps Spain allowed to use coger while still disambiguating non-coger senses", () => {
    const spain = buildSemanticTranslationContext({
      text: "Take the bus and pick up the package.",
      dialect: "es-ES",
      documentKind: "plain",
    });

    expect(spain).toContain("coger is neutral in Spain");
    expect(spain).toContain("[take-bus]");
    expect(spain).not.toContain("[pickup-package]");
  });

  it("separates photo, medicine, and physical grab senses", () => {
    expect(buildLexicalAmbiguityGuidance("Take a screenshot.", "es-MX")).toContain("[take-photo]");
    expect(buildLexicalAmbiguityGuidance("Take the medicine after lunch.", "es-MX")).toContain("[take-medicine]");
    expect(buildLexicalAmbiguityGuidance("Grab your backpack before leaving.", "es-MX")).toContain("[grab-bag]");
  });
});

