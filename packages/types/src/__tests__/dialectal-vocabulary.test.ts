import { describe, it, expect } from "vitest";
import type { SpanishDialect } from "../index.js";
import { ALL_SPANISH_DIALECTS } from "../index.js";
import {
  getVocabularyForDialect,
  getVocabularyByField,
  getForbiddenTerms,
  buildDialectVocabularyPrompt,
  buildConjugationPrompt,
  validateDialectCompliance,
  getSyntacticRules,
  SYNTACTIC_RULES,
} from "../dialectal-vocabulary.js";

describe("getVocabularyForDialect", () => {
  it("returns entries for every dialect", () => {
    for (const dialect of ALL_SPANISH_DIALECTS) {
      const vocab = getVocabularyForDialect(dialect);
      expect(vocab.length, `${dialect} should have vocabulary entries`).toBeGreaterThan(50);
    }
  });

  it("es-AR uses heladera (not refrigerador)", () => {
    const vocab = getVocabularyForDialect("es-AR");
    const fridge = vocab.find(v => v.concept === "refrigerator");
    expect(fridge).toBeDefined();
    expect(fridge!.preferredTerm).toBe("heladera");
    expect(fridge!.avoidTerms).toContain("refrigerador");
  });

  it("es-MX uses manejar (not conducir)", () => {
    const vocab = getVocabularyForDialect("es-MX");
    const drive = vocab.find(v => v.concept === "drive");
    expect(drive).toBeDefined();
    expect(drive!.preferredTerm).toBe("manejar");
  });

  it("entries are sorted by frequency", () => {
    const vocab = getVocabularyForDialect("es-ES");
    for (let i = 1; i < vocab.length; i++) {
      expect(vocab[i].frequency).toBeGreaterThanOrEqual(vocab[i - 1].frequency);
    }
  });
});

describe("getVocabularyByField", () => {
  it("filters by field correctly", () => {
    const food = getVocabularyByField("es-ES", "food");
    expect(food.length).toBeGreaterThan(0);
    for (const entry of food) {
      expect(entry.field).toBe("food");
    }
  });

  it("returns empty for field with no entries", () => {
    const result = getVocabularyByField("es-ES", "technology" as any);
    expect(result.length).toBeGreaterThan(0);
  });
});

describe("getForbiddenTerms", () => {
  it("returns forbidden terms for every dialect", () => {
    for (const dialect of ALL_SPANISH_DIALECTS) {
      const forbidden = getForbiddenTerms(dialect);
      expect(forbidden.length, `${dialect} should have forbidden terms`).toBeGreaterThan(0);
    }
  });

  it("es-AR forbids frigorífico for refrigerator", () => {
    const forbidden = getForbiddenTerms("es-AR");
    const refEntry = forbidden.find(f => f.concept === "refrigerator" && f.term === "frigorífico");
    expect(refEntry).toBeDefined();
  });

  it("es-ES forbids manejar for drive", () => {
    const forbidden = getForbiddenTerms("es-ES");
    const driveEntry = forbidden.find(f => f.concept === "drive" && f.term === "manejar");
    expect(driveEntry).toBeDefined();
  });
});

describe("buildDialectVocabularyPrompt", () => {
  it("returns a non-empty string for every dialect", () => {
    for (const dialect of ALL_SPANISH_DIALECTS) {
      const prompt = buildDialectVocabularyPrompt(dialect);
      expect(prompt.length, `${dialect} prompt should be non-empty`).toBeGreaterThan(0);
      expect(prompt).toContain(`Vocabulary for ${dialect}:`);
    }
  });

  it("includes field headers in brackets", () => {
    const prompt = buildDialectVocabularyPrompt("es-AR");
    expect(prompt).toMatch(/\[food\]/);
    expect(prompt).toMatch(/\[transport\]/);
  });
});

describe("buildConjugationPrompt", () => {
  it("returns voseo info for voseo dialects", () => {
    const prompt = buildConjugationPrompt("es-AR");
    expect(prompt).toContain("Voseo conjugation");
    expect(prompt).toContain("vos sos");
    expect(prompt).toContain("vos tenés");
  });

  it("shows lemma changes for MX", () => {
    const prompt = buildConjugationPrompt("es-MX");
    expect(prompt).toContain("manejar");
    expect(prompt).toContain("conducir");
  });

  it("es-ES has lemma changes for new vocabulary verbs", () => {
    const prompt = buildConjugationPrompt("es-ES");
    expect(prompt).toContain("charlar");
    expect(prompt).toContain("echar de menos");
    expect(prompt).toContain("enfadarse");
  });

  it("shows lemma changes for MX", () => {
    const prompt = buildConjugationPrompt("es-MX");
    expect(prompt).toContain("manejar");
  });
});

describe("validateDialectCompliance", () => {
  it("passes for correct dialect usage", () => {
    const result = validateDialectCompliance(
      "I need to drive to the store",
      "Necesito manejar hasta la tienda",
      "es-MX",
    );
    expect(result.passed).toBe(true);
    expect(result.score).toBeGreaterThan(0);
  });

  it("detects wrong dialect term for car trunk in es-MX", () => {
    const result = validateDialectCompliance(
      "Put the luggage in the rear storage compartment",
      "Pon el equipaje en el maletero del carro",
      "es-MX",
    );
    expect(result.checkedConcepts).toBeGreaterThan(0);
    const trunkViolation = result.violations.find(v => v.concept === "trunk_boot");
    expect(trunkViolation).toBeDefined();
    expect(trunkViolation!.foundTerm).toBe("maletero");
    expect(trunkViolation!.expectedTerm).toBe("cajuela");
  });

  it("passes when correct term is used", () => {
    const result = validateDialectCompliance(
      "Put the luggage in the rear storage compartment",
      "Pon el equipaje en la cajuela del carro",
      "es-MX",
    );
    const trunkViolation = result.violations.find(v => v.concept === "trunk_boot");
    expect(trunkViolation).toBeUndefined();
  });

  it("handles source text with no matching concepts", () => {
    const result = validateDialectCompliance(
      "Sphinx of black quartz, judge my vow",
      "Esfinge de cuarzo negro, juzga mi voto",
      "es-ES",
    );
    expect(result.checkedConcepts).toBe(0);
    expect(result.score).toBe(1);
  });
});

describe("getSyntacticRules", () => {
  it("returns rules for every dialect", () => {
    for (const dialect of ALL_SPANISH_DIALECTS) {
      const rules = getSyntacticRules(dialect);
      expect(rules.length, `${dialect} should have syntactic rules`).toBeGreaterThan(0);
    }
  });

  it("es-ES has vosotros rule", () => {
    const rules = getSyntacticRules("es-ES");
    const vosotros = rules.find(r => r.id === "plural-address-vosotros");
    expect(vosotros).toBeDefined();
  });

  it("es-AR has voseo rule", () => {
    const rules = getSyntacticRules("es-AR");
    const voseo = rules.find(r => r.id === "voseo-AR-UY-PY");
    expect(voseo).toBeDefined();
  });

  it("all dialects get universal rules", () => {
    const universalRules = SYNTACTIC_RULES.filter(r => r.dialects === "all");
    expect(universalRules.length).toBeGreaterThan(0);

    for (const dialect of ALL_SPANISH_DIALECTS) {
      const rules = getSyntacticRules(dialect);
      for (const ur of universalRules) {
        expect(rules.some(r => r.id === ur.id), `${dialect} missing universal rule ${ur.id}`).toBe(true);
      }
    }
  });
});
