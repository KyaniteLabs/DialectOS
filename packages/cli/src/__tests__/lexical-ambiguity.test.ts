import { describe, expect, it } from "vitest";
import { ALL_SPANISH_DIALECTS } from "@espanol/types";
import {
  buildLexicalAmbiguityExpectations,
  buildLexicalAmbiguityGuidance
} from "../lib/lexical-ambiguity.js";
import { buildSemanticTranslationContext } from "../lib/semantic-context.js";

describe("lexical ambiguity constraints", () => {
  it("distinguishes file pickup from download/coger in Mexican Spanish", () => {
    const guidance = buildLexicalAmbiguityGuidance(
      "Pick up the file before deployment.",
      "es-MX"
    );

    expect(guidance).toContain("[pickup-file]");
    expect(guidance).toContain("recoger/recoge, recuperar/recupera");
    expect(guidance).toContain("Avoid coger in taboo-risk dialects");
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
    expect(spain).toContain("[pickup-package]");
  });

  it("separates photo, medicine, and physical grab senses", () => {
    expect(buildLexicalAmbiguityGuidance("Take a screenshot.", "es-MX")).toContain("[take-photo]");
    expect(buildLexicalAmbiguityGuidance("Take the medicine after lunch.", "es-MX")).toContain("[take-medicine]");
    expect(buildLexicalAmbiguityGuidance("Grab your backpack before leaving.", "es-MX")).toContain("[grab-bag]");
  });

  it("models Puerto Rican recoger el cuarto as tidying the room", () => {
    const guidance = buildLexicalAmbiguityGuidance("Pick up the room before guests arrive.", "es-PR");
    const expectations = buildLexicalAmbiguityExpectations("Pick up the room before guests arrive.", "es-PR");

    expect(guidance).toContain("[tidy-room]");
    expect(guidance).toContain("In Puerto Rican Spanish, recoger el cuarto is natural");
    expect(expectations.requiredOutputGroups).toEqual(expect.arrayContaining([
      expect.arrayContaining(["cuarto", "habitación"]),
      expect.arrayContaining(["recoge", "recoger", "ordena", "ordenar", "arregla", "arreglar"]),
    ]));
    expect(expectations.forbiddenOutputTerms).toEqual(expect.arrayContaining(["coge", "coger", "levanta", "levantar"]));
  });

  it("builds category expectations for every dialect instead of one-off examples", () => {
    for (const dialect of ALL_SPANISH_DIALECTS) {
      expect(buildLexicalAmbiguityExpectations("Pick up the file before deployment.", dialect).matchedRuleIds).toContain("pickup-file");
      expect(buildLexicalAmbiguityExpectations("Pick up the package from reception.", dialect).matchedRuleIds).toContain("pickup-package");
      expect(buildLexicalAmbiguityExpectations("Take the bus to the office.", dialect).matchedRuleIds).toContain("take-bus");
      expect(buildLexicalAmbiguityExpectations("Take a screenshot.", dialect).matchedRuleIds).toContain("take-photo");
      expect(buildLexicalAmbiguityExpectations("Take the medicine after lunch.", dialect).matchedRuleIds).toContain("take-medicine");
      expect(buildLexicalAmbiguityExpectations("Pick up the room before guests arrive.", dialect).matchedRuleIds).toContain("tidy-room");
    }
  });

  it("models Puerto Rican china as orange in the juice semantic field", () => {
    const guidance = buildLexicalAmbiguityGuidance("Orange juice is ready.", "es-PR");
    const pr = buildLexicalAmbiguityExpectations("Orange juice is ready.", "es-PR");
    const mx = buildLexicalAmbiguityExpectations("Jugo de china is on the menu.", "es-MX");

    expect(guidance).toContain("[citrus-orange-juice]");
    expect(guidance).toContain("jugo de china");
    expect(pr.requiredOutputGroups).toEqual(expect.arrayContaining([
      expect.arrayContaining(["jugo", "zumo"]),
      expect.arrayContaining(["china", "naranja"]),
    ]));
    expect(mx.requiredOutputGroups).toEqual(expect.arrayContaining([
      expect.arrayContaining(["naranja"]),
    ]));
    expect(mx.forbiddenOutputTerms).toEqual(expect.arrayContaining(["china"]));
  });

  it("models guagua as bus in Puerto Rico but baby in Chilean/Andean contexts", () => {
    const prBaby = buildLexicalAmbiguityExpectations("The baby is sleeping.", "es-PR");
    const clBaby = buildLexicalAmbiguityExpectations("The baby is sleeping.", "es-CL");

    expect(prBaby.matchedRuleIds).toContain("baby-guagua");
    expect(prBaby.requiredOutputGroups).toEqual(expect.arrayContaining([
      expect.arrayContaining(["bebé", "bebe", "niño", "niña", "infante"]),
    ]));
    expect(prBaby.forbiddenOutputTerms).toEqual(expect.arrayContaining(["guagua"]));
    expect(clBaby.requiredOutputGroups).toEqual(expect.arrayContaining([
      expect.arrayContaining(["guagua", "bebé", "bebe", "niño", "niña", "infante"]),
    ]));
  });

});
