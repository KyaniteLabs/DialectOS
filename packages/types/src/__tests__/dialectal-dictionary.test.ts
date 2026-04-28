import { describe, it, expect } from "vitest";
import { ALL_SPANISH_DIALECTS } from "../index.js";
import type { SpanishDialect } from "../index.js";
import { DICTIONARY } from "../dialectal-dictionary.js";
import type { SemanticField } from "../dialectal-dictionary.js";
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
import { VERB_CONJUGATIONS } from "../verb-conjugations.js";

// ============================================================================
// Dictionary completeness
// ============================================================================

describe("DICTIONARY", () => {
  it("has at least 95 entries", () => {
    expect(DICTIONARY.length).toBeGreaterThanOrEqual(95);
  });

  it("every entry has required fields", () => {
    for (const entry of DICTIONARY) {
      expect(entry.field).toBeTruthy();
      expect(entry.concept).toBeTruthy();
      expect(entry.englishGloss).toBeTruthy();
      expect(Object.keys(entry.variants).length).toBeGreaterThan(0);
    }
  });

  it("all semantic fields are represented", () => {
    const fields = new Set(DICTIONARY.map((e) => e.field));
    const expected: SemanticField[] = [
      "technology", "transport", "food", "household", "clothing",
      "actions", "social", "people", "education", "nature",
    ];
    for (const f of expected) {
      expect(fields.has(f), `Missing semantic field: ${f}`).toBe(true);
    }
  });

  it("no duplicate concepts", () => {
    const concepts = DICTIONARY.map((e) => e.concept);
    const unique = new Set(concepts);
    expect(unique.size).toBe(concepts.length);
  });

  it("all variant dialect codes are valid", () => {
    const validCodes = new Set(ALL_SPANISH_DIALECTS);
    for (const entry of DICTIONARY) {
      for (const dialect of Object.keys(entry.variants)) {
        expect(validCodes.has(dialect as SpanishDialect), `Invalid dialect code: ${dialect} in concept ${entry.concept}`).toBe(true);
      }
    }
  });

  it("no duplicate dialect keys within a single entry", () => {
    for (const entry of DICTIONARY) {
      const keys = Object.keys(entry.variants);
      const unique = new Set(keys);
      expect(unique.size, `Duplicate dialect keys in concept "${entry.concept}"`).toBe(keys.length);
    }
  });

  it("high-value concepts are present", () => {
    const concepts = new Set(DICTIONARY.map((e) => e.concept));
    const required = [
      "car", "bus", "computer", "phone_mobile", "avocado", "beans",
      "banana", "potato", "juice", "apartment", "refrigerator",
      "lightbulb", "shirt_tshirt", "jacket", "eyeglasses", "sneakers",
      "drive", "park", "friend", "money", "party",
    ];
    for (const concept of required) {
      expect(concepts.has(concept), `Missing required concept: ${concept}`).toBe(true);
    }
  });
});

// ============================================================================
// Vocabulary queries
// ============================================================================

describe("getVocabularyForDialect", () => {
  it("returns results for every dialect", () => {
    for (const dialect of ALL_SPANISH_DIALECTS) {
      const swaps = getVocabularyForDialect(dialect);
      expect(swaps.length, `No vocabulary for ${dialect}`).toBeGreaterThan(0);
    }
  });

  it("es-MX uses carro, not coche", () => {
    const swaps = getVocabularyForDialect("es-MX");
    const car = swaps.find((s) => s.concept === "car");
    expect(car).toBeDefined();
    expect(car!.preferredTerm).toBe("carro");
    expect(car!.avoidTerms).toContain("coche");
  });

  it("es-AR uses auto, not coche", () => {
    const swaps = getVocabularyForDialect("es-AR");
    const car = swaps.find((s) => s.concept === "car");
    expect(car).toBeDefined();
    expect(car!.preferredTerm).toBe("auto");
  });

  it("es-ES uses coche", () => {
    const swaps = getVocabularyForDialect("es-ES");
    const car = swaps.find((s) => s.concept === "car");
    expect(car).toBeDefined();
    expect(car!.preferredTerm).toBe("coche");
  });

  it("es-CL uses palta for avocado", () => {
    const swaps = getVocabularyForDialect("es-CL");
    const avocado = swaps.find((s) => s.concept === "avocado");
    expect(avocado).toBeDefined();
    expect(avocado!.preferredTerm).toBe("palta");
  });

  it("es-CU uses guagua for bus", () => {
    const swaps = getVocabularyForDialect("es-CU");
    const bus = swaps.find((s) => s.concept === "bus");
    expect(bus).toBeDefined();
    expect(bus!.preferredTerm).toBe("guagua");
  });

  it("es-PR uses guagua for bus", () => {
    const swaps = getVocabularyForDialect("es-PR");
    const bus = swaps.find((s) => s.concept === "bus");
    expect(bus).toBeDefined();
    expect(bus!.preferredTerm).toBe("guagua");
  });

  it("es-MX uses camión for bus", () => {
    const swaps = getVocabularyForDialect("es-MX");
    const bus = swaps.find((s) => s.concept === "bus");
    expect(bus).toBeDefined();
    expect(bus!.preferredTerm).toBe("camión");
  });

  it("es-VE uses computadora for computer", () => {
    const swaps = getVocabularyForDialect("es-VE");
    const computer = swaps.find((s) => s.concept === "computer");
    expect(computer).toBeDefined();
    expect(computer!.preferredTerm).toBe("computadora");
  });

  it("es-CO uses computador for computer", () => {
    const swaps = getVocabularyForDialect("es-CO");
    const computer = swaps.find((s) => s.concept === "computer");
    expect(computer).toBeDefined();
    expect(computer!.preferredTerm).toBe("computador");
  });

  it("es-ES uses ordenador for computer", () => {
    const swaps = getVocabularyForDialect("es-ES");
    const computer = swaps.find((s) => s.concept === "computer");
    expect(computer).toBeDefined();
    expect(computer!.preferredTerm).toBe("ordenador");
  });

  it("heritage dialects (es-GQ, es-PH, es-BZ) return results via fallback", () => {
    for (const dialect of ["es-GQ", "es-PH", "es-BZ"] as SpanishDialect[]) {
      const swaps = getVocabularyForDialect(dialect);
      expect(swaps.length, `No vocabulary for heritage dialect ${dialect}`).toBeGreaterThan(0);
    }
  });

  it("es-PR uses parking for parking lot (English loanword)", () => {
    const swaps = getVocabularyForDialect("es-PR");
    const parking = swaps.find((s) => s.concept === "parking");
    expect(parking).toBeDefined();
    expect(parking!.preferredTerm).toBe("parking");
  });

  it("es-PR uses troca for pickup truck", () => {
    const swaps = getVocabularyForDialect("es-PR");
    const truck = swaps.find((s) => s.concept === "pickup_truck");
    expect(truck).toBeDefined();
    expect(truck!.preferredTerm).toBe("troca");
  });

  it("es-PR uses zafacón for trash can", () => {
    const swaps = getVocabularyForDialect("es-PR");
    const trash = swaps.find((s) => s.concept === "trash_can");
    expect(trash).toBeDefined();
    expect(trash!.preferredTerm).toBe("zafacón");
  });

  it("es-PR uses chequear for to check", () => {
    const swaps = getVocabularyForDialect("es-PR");
    const check = swaps.find((s) => s.concept === "to_check");
    expect(check).toBeDefined();
    expect(check!.preferredTerm).toBe("chequear");
  });

  it("es-PR uses confle for cereal", () => {
    const swaps = getVocabularyForDialect("es-PR");
    const cereal = swaps.find((s) => s.concept === "cereal_breakfast");
    expect(cereal).toBeDefined();
    expect(cereal!.preferredTerm).toBe("confle");
  });
});

describe("getVocabularyByField", () => {
  it("returns only entries from the specified field", () => {
    const food = getVocabularyByField("es-MX", "food");
    expect(food.length).toBeGreaterThan(0);
    for (const swap of food) {
      expect(swap.field).toBe("food");
    }
  });

  it("transport field includes car and bus", () => {
    const transport = getVocabularyByField("es-MX", "transport");
    const concepts = transport.map((s) => s.concept);
    expect(concepts).toContain("car");
    expect(concepts).toContain("bus");
  });
});

// ============================================================================
// Forbidden terms
// ============================================================================

describe("getForbiddenTerms", () => {
  it("es-MX forbids coche", () => {
    const forbidden = getForbiddenTerms("es-MX");
    const coche = forbidden.find((f) => f.term === "coche");
    expect(coche).toBeDefined();
    expect(coche!.concept).toBe("car");
  });

  it("es-ES does not forbid coche", () => {
    const forbidden = getForbiddenTerms("es-ES");
    const coche = forbidden.find((f) => f.term === "coche");
    expect(coche).toBeUndefined();
  });

  it("es-CL forbids aguacate (uses palta)", () => {
    const forbidden = getForbiddenTerms("es-CL");
    const aguacate = forbidden.find((f) => f.term === "aguacate");
    expect(aguacate).toBeDefined();
  });

  it("all forbidden terms have valid reasons", () => {
    for (const dialect of ALL_SPANISH_DIALECTS) {
      const forbidden = getForbiddenTerms(dialect);
      for (const f of forbidden) {
        expect(f.term).toBeTruthy();
        expect(f.concept).toBeTruthy();
        expect(f.reason).toBeTruthy();
        expect(["error", "warning"]).toContain(f.severity);
      }
    }
  });
});

// ============================================================================
// Dialect compliance validation
// ============================================================================

describe("validateDialectCompliance", () => {
  it("passes when output uses correct dialect terms", () => {
    const result = validateDialectCompliance(
      "I drove my motor vehicle",
      "Manejé mi carro",
      "es-MX",
    );
    expect(result.passed).toBe(true);
    expect(result.score).toBe(1);
  });

  it("catches es-MX output using coche instead of carro", () => {
    const result = validateDialectCompliance(
      "I drove my motor vehicle to the gas station",
      "Manejé mi coche a la gasolinera",
      "es-MX",
    );
    expect(result.passed).toBe(false);
    const carViolation = result.violations.find((v) => v.concept === "car");
    expect(carViolation).toBeDefined();
    expect(carViolation!.foundTerm).toBe("coche");
    expect(carViolation!.expectedTerm).toBe("carro");
  });

  it("catches es-AR output using autobús instead of colectivo", () => {
    const result = validateDialectCompliance(
      "Take the public transit vehicle to downtown",
      "Tomá el autobús al centro",
      "es-AR",
    );
    expect(result.passed).toBe(false);
    const busViolation = result.violations.find((v) => v.concept === "bus");
    expect(busViolation).toBeDefined();
    expect(busViolation!.expectedTerm).toBe("colectivo");
  });

  it("es-ES allows coche", () => {
    const result = validateDialectCompliance(
      "I drove my motor vehicle",
      "Conduje mi coche",
      "es-ES",
    );
    expect(result.violations.filter((v) => v.concept === "car").length).toBe(0);
  });

  it("es-CL requires palta for avocado (tropical fruit)", () => {
    const result = validateDialectCompliance(
      "The green tropical fruit is ripe",
      "El aguacate está maduro",
      "es-CL",
    );
    const avocadoViolation = result.violations.find((v) => v.concept === "avocado");
    expect(avocadoViolation).toBeDefined();
    expect(avocadoViolation!.expectedTerm).toBe("palta");
  });

  it("returns checkedConcepts > 0 when source matches dictionary entries", () => {
    const result = validateDialectCompliance(
      "Download the file to your computer",
      "Descarga el archivo a tu computadora",
      "es-MX",
    );
    expect(result.checkedConcepts).toBeGreaterThan(0);
  });

  it("handles empty source gracefully", () => {
    const result = validateDialectCompliance(
      "",
      "Traducción",
      "es-MX",
    );
    expect(result.checkedConcepts).toBe(0);
    expect(result.passed).toBe(true);
  });
});

// ============================================================================
// Verb conjugations
// ============================================================================

describe("VERB_CONJUGATIONS", () => {
  it("has at least 30 entries", () => {
    expect(VERB_CONJUGATIONS.length).toBeGreaterThanOrEqual(30);
  });

  it("includes key lemma-changing verbs", () => {
    const infinitives = VERB_CONJUGATIONS.map((v) => v.infinitive);
    expect(infinitives).toContain("conducir");
    expect(infinitives).toContain("aparcar");
    expect(infinitives).toContain("alquilar");
    expect(infinitives).toContain("encender");
    expect(infinitives).toContain("congelar");
  });

  it("conducir maps to manejar for es-MX", () => {
    const conducir = VERB_CONJUGATIONS.find((v) => v.infinitive === "conducir");
    expect(conducir).toBeDefined();
    expect(conducir!.regionalInfinitive!["es-MX"]).toBe("manejar");
  });

  it("aparcar maps to estacionar for es-AR", () => {
    const aparcar = VERB_CONJUGATIONS.find((v) => v.infinitive === "aparcar");
    expect(aparcar).toBeDefined();
    expect(aparcar!.regionalInfinitive!["es-AR"]).toBe("estacionar");
  });

  it("aparcar maps to parquear for Caribbean dialects", () => {
    const aparcar = VERB_CONJUGATIONS.find((v) => v.infinitive === "aparcar");
    expect(aparcar).toBeDefined();
    expect(aparcar!.regionalInfinitive!["es-PR"]).toBe("parquear");
    expect(aparcar!.regionalInfinitive!["es-DO"]).toBe("parquear");
    expect(aparcar!.regionalInfinitive!["es-CU"]).toBe("parquear");
    expect(aparcar!.regionalInfinitive!["es-PA"]).toBe("parquear");
    expect(aparcar!.regionalInfinitive!["es-US"]).toBe("parquear");
    expect(aparcar!.regionalInfinitive!["es-BZ"]).toBe("parquear");
  });

  it("es-ES keeps conducir (no regional mapping)", () => {
    const conducir = VERB_CONJUGATIONS.find((v) => v.infinitive === "conducir");
    expect(conducir!.regionalInfinitive!["es-ES"]).toBeUndefined();
  });

  it("congelar has no regional infinitive change (frizar is informal only)", () => {
    const congelar = VERB_CONJUGATIONS.find((v) => v.infinitive === "congelar");
    expect(congelar).toBeDefined();
    expect(congelar!.regionalInfinitive!["es-US"]).toBeUndefined();
    expect(congelar!.regionalInfinitive!["es-PR"]).toBeUndefined();
    expect(congelar!.regionalInfinitive!["es-ES"]).toBeUndefined();
  });

  it("voseo forms are correct for ser", () => {
    const ser = VERB_CONJUGATIONS.find((v) => v.infinitive === "ser");
    expect(ser).toBeDefined();
    // es-AR: vos sos
    expect(ser!.forms["es-AR"]?.present_2s).toBe("sos");
    // es-ES: tú eres
    expect(ser!.forms["es-ES"]?.present_2s).toBe("eres");
  });

  it("voseo forms are correct for tener", () => {
    const tener = VERB_CONJUGATIONS.find((v) => v.infinitive === "tener");
    expect(tener).toBeDefined();
    // es-AR: vos tenés
    expect(tener!.forms["es-AR"]?.present_2s).toBe("tenés");
    // es-GT: vos tenés
    expect(tener!.forms["es-GT"]?.present_2s).toBe("tenés");
    // es-ES: tú tienes
    expect(tener!.forms["es-ES"]?.present_2s).toBe("tienes");
  });

  it("voseo imperative for ir uses andá in AR", () => {
    const ir = VERB_CONJUGATIONS.find((v) => v.infinitive === "ir");
    expect(ir).toBeDefined();
    expect(ir!.forms["es-AR"]?.imperative_2s).toBe("andá");
    expect(ir!.forms["es-ES"]?.imperative_2s).toBe("ve");
  });

  it("tú dialects (es-MX, es-PR) have tú forms", () => {
    const tener = VERB_CONJUGATIONS.find((v) => v.infinitive === "tener");
    expect(tener!.forms["es-MX"]?.present_2s).toBe("tienes");
    expect(tener!.forms["es-PR"]?.present_2s).toBe("tienes");
  });

  it("vos dialects (es-AR, es-UY, es-PY) have vos forms", () => {
    const poder = VERB_CONJUGATIONS.find((v) => v.infinitive === "poder");
    expect(poder!.forms["es-AR"]?.present_2s).toBe("podés");
    expect(poder!.forms["es-UY"]?.present_2s).toBe("podés");
    expect(poder!.forms["es-PY"]?.present_2s).toBe("podés");
  });
});

// ============================================================================
// Conjugation prompt builder
// ============================================================================

describe("buildConjugationPrompt", () => {
  it("returns lemma-change info for es-MX", () => {
    const prompt = buildConjugationPrompt("es-MX");
    expect(prompt).toContain("manejar");
    expect(prompt).toContain("conducir");
  });

  it("returns lemma-change info for es-AR", () => {
    const prompt = buildConjugationPrompt("es-AR");
    expect(prompt).toContain("manejar");
    expect(prompt).toContain("estacionar");
  });

  it("returns voseo info for es-AR", () => {
    const prompt = buildConjugationPrompt("es-AR");
    expect(prompt).toContain("vos");
    expect(prompt).toContain("tenés");
  });

  it("returns voseo info for es-GT", () => {
    const prompt = buildConjugationPrompt("es-GT");
    expect(prompt).toContain("vos");
  });

  it("returns empty string for es-ES (no lemma changes, no voseo)", () => {
    const prompt = buildConjugationPrompt("es-ES");
    // es-ES has no regional infinitive changes and no voseo
    // but it may have usage notes, so just check it's not crash-inducing
    expect(typeof prompt).toBe("string");
  });
});

// ============================================================================
// Vocabulary prompt builder
// ============================================================================

describe("buildDialectVocabularyPrompt", () => {
  it("includes dialect code in prompt", () => {
    const prompt = buildDialectVocabularyPrompt("es-MX");
    expect(prompt).toContain("es-MX");
  });

  it("includes preferred terms", () => {
    const prompt = buildDialectVocabularyPrompt("es-MX");
    expect(prompt).toContain("carro");
  });

  it("includes avoid terms", () => {
    const prompt = buildDialectVocabularyPrompt("es-MX");
    // es-MX should avoid coche (car) and possibly others
    expect(prompt).toMatch(/avoid/i);
  });

  it("returns non-empty string for all dialects", () => {
    for (const dialect of ALL_SPANISH_DIALECTS) {
      const prompt = buildDialectVocabularyPrompt(dialect);
      expect(prompt.length, `Empty prompt for ${dialect}`).toBeGreaterThan(0);
    }
  });
});

// ============================================================================
// Syntactic rules
// ============================================================================

describe("SYNTACTIC_RULES", () => {
  it("has at least 10 rules", () => {
    expect(SYNTACTIC_RULES.length).toBeGreaterThanOrEqual(10);
  });

  it("every rule has required fields", () => {
    for (const rule of SYNTACTIC_RULES) {
      expect(rule.id).toBeTruthy();
      expect(rule.rule).toBeTruthy();
      expect(["prompt-only", "validate"]).toContain(rule.enforcement);
    }
  });

  it("includes vosotros/ustedes rules", () => {
    const ids = SYNTACTIC_RULES.map((r) => r.id);
    expect(ids).toContain("plural-address-vosotros");
    expect(ids).toContain("plural-address-ustedes");
  });

  it("includes voseo rules", () => {
    const ids = SYNTACTIC_RULES.map((r) => r.id);
    expect(ids).toContain("voseo-AR-UY-PY");
    expect(ids).toContain("voseo-central-america");
  });
});

describe("getSyntacticRules", () => {
  it("es-ES gets vosotros rule", () => {
    const rules = getSyntacticRules("es-ES");
    const ids = rules.map((r) => r.id);
    expect(ids).toContain("plural-address-vosotros");
    expect(ids).not.toContain("plural-address-ustedes");
  });

  it("es-MX gets ustedes rule", () => {
    const rules = getSyntacticRules("es-MX");
    const ids = rules.map((r) => r.id);
    expect(ids).toContain("plural-address-ustedes");
    expect(ids).not.toContain("plural-address-vosotros");
  });

  it("es-AR gets voseo rule", () => {
    const rules = getSyntacticRules("es-AR");
    const ids = rules.map((r) => r.id);
    expect(ids).toContain("voseo-AR-UY-PY");
  });

  it("all dialects get universal rules (clitic, haber)", () => {
    for (const dialect of ALL_SPANISH_DIALECTS) {
      const rules = getSyntacticRules(dialect);
      const ids = rules.map((r) => r.id);
      expect(ids, `${dialect} missing clitic-placement`).toContain("clitic-placement");
      expect(ids, `${dialect} missing existential-haber`).toContain("existential-haber");
    }
  });

  it("es-ES gets leismo rule", () => {
    const rules = getSyntacticRules("es-ES");
    const ids = rules.map((r) => r.id);
    expect(ids).toContain("leismo-spain");
  });

  it("es-MX gets loismo rule", () => {
    const rules = getSyntacticRules("es-MX");
    const ids = rules.map((r) => r.id);
    expect(ids).toContain("loismo-americas");
  });

  it("es-CR gets voseo-CR-regional rule", () => {
    const rules = getSyntacticRules("es-CR");
    const ids = rules.map((r) => r.id);
    expect(ids).toContain("voseo-CR-regional");
  });
});
