import { describe, it, expect } from "vitest";
import { VERB_CONJUGATIONS } from "../verb-conjugations.js";
import { FULL_VOSEO_DIALECTS, REGIONAL_VOSEO_DIALECTS, TÚ_ONLY_DIALECTS } from "../dialect-regions.js";
import type { SpanishDialect } from "../index.js";

const VOSEO_DIALECTS = [...FULL_VOSEO_DIALECTS, ...REGIONAL_VOSEO_DIALECTS] as SpanishDialect[];

describe("VERB_CONJUGATIONS", () => {
  it("has at least 35 verb entries", () => {
    expect(VERB_CONJUGATIONS.length).toBeGreaterThanOrEqual(35);
  });

  it("every entry has required fields", () => {
    for (const verb of VERB_CONJUGATIONS) {
      expect(verb.infinitive).toBeTruthy();
      expect(verb.meaning).toBeTruthy();
      expect(["lemma-change", "conjugation-pattern"]).toContain(verb.category);
    }
  });

  it("category counts are correct", () => {
    const lemma = VERB_CONJUGATIONS.filter(v => v.category === "lemma-change");
    const conjugation = VERB_CONJUGATIONS.filter(v => v.category === "conjugation-pattern");
    expect(lemma.length).toBeGreaterThanOrEqual(5);
    expect(conjugation.length).toBeGreaterThanOrEqual(25);
  });
});

describe("lemma-change verbs", () => {
  const lemmaVerbs = VERB_CONJUGATIONS.filter(v => v.category === "lemma-change");

  it("conducir has manejar for most dialects", () => {
    const conducir = lemmaVerbs.find(v => v.infinitive === "conducir");
    expect(conducir).toBeDefined();
    expect(conducir!.regionalInfinitive?.["es-MX"]).toBe("manejar");
    expect(conducir!.regionalInfinitive?.["es-AR"]).toBe("manejar");
    expect(conducir!.regionalInfinitive?.["es-CO"]).toBe("manejar");
  });

  it("aparcar has estacionar and parquear variants", () => {
    const aparcar = lemmaVerbs.find(v => v.infinitive === "aparcar");
    expect(aparcar).toBeDefined();
    expect(aparcar!.regionalInfinitive?.["es-MX"]).toBe("estacionar");
    expect(aparcar!.regionalInfinitive?.["es-CU"]).toBe("parquear");
    expect(aparcar!.regionalInfinitive?.["es-PR"]).toBe("parquear");
  });

  it("encender has prender for LatAm dialects", () => {
    const encender = lemmaVerbs.find(v => v.infinitive === "encender");
    expect(encender).toBeDefined();
    expect(encender!.regionalInfinitive?.["es-MX"]).toBe("prender");
    expect(encender!.regionalInfinitive?.["es-CO"]).toBe("prender");
  });
});

describe("conjugation-pattern verbs (voseo)", () => {
  const conjVerbs = VERB_CONJUGATIONS.filter(v => v.category === "conjugation-pattern");

  it("every conjugation verb has forms for all 25 dialects", () => {
    for (const verb of conjVerbs) {
      const dialects = Object.keys(verb.forms);
      expect(dialects.length, `${verb.infinitive} missing dialect forms`).toBe(25);
    }
  });

  it("ser has correct tú and vos forms", () => {
    const ser = conjVerbs.find(v => v.infinitive === "ser");
    expect(ser).toBeDefined();
    expect(ser!.forms["es-ES"]?.present_2s).toBe("eres");
    expect(ser!.forms["es-AR"]?.present_2s).toBe("sos");
    expect(ser!.forms["es-UY"]?.present_2s).toBe("sos");
  });

  it("tener has correct voseo conjugation", () => {
    const tener = conjVerbs.find(v => v.infinitive === "tener");
    expect(tener).toBeDefined();
    expect(tener!.forms["es-ES"]?.present_2s).toBe("tienes");
    expect(tener!.forms["es-AR"]?.present_2s).toBe("tenés");
    expect(tener!.forms["es-ES"]?.imperative_2s).toBe("ten");
    expect(tener!.forms["es-AR"]?.imperative_2s).toBe("tené");
  });

  it("ir has different imperative for tú vs vos", () => {
    const ir = conjVerbs.find(v => v.infinitive === "ir");
    expect(ir).toBeDefined();
    expect(ir!.forms["es-ES"]?.imperative_2s).toBe("ve");
    expect(ir!.forms["es-AR"]?.imperative_2s).toBe("andá");
  });

  it("dar has same forms for tú and vos", () => {
    const dar = conjVerbs.find(v => v.infinitive === "dar");
    expect(dar).toBeDefined();
    expect(dar!.forms["es-ES"]?.present_2s).toBe("das");
    expect(dar!.forms["es-AR"]?.present_2s).toBe("das");
  });

  it("voseo dialects get vos forms, tú dialects get tú forms", () => {
    const hablar = conjVerbs.find(v => v.infinitive === "hablar");
    expect(hablar).toBeDefined();

    for (const d of VOSEO_DIALECTS) {
      const form = hablar!.forms[d];
      expect(form?.present_2s, `${d} should have voseo form for hablar`).toBe("hablás");
    }

    for (const d of TÚ_ONLY_DIALECTS) {
      const form = hablar!.forms[d];
      expect(form?.present_2s, `${d} should have tú form for hablar`).toBe("hablas");
    }
  });

  it("stem-changing verbs maintain correct tú vs vos patterns", () => {
    const pensar = conjVerbs.find(v => v.infinitive === "pensar");
    expect(pensar).toBeDefined();
    expect(pensar!.forms["es-ES"]?.present_2s).toBe("piensas");
    expect(pensar!.forms["es-AR"]?.present_2s).toBe("pensás");
  });
});
