// Regressions from the 2026-11-11 dialect eval: 24 planted errors, 8 clean cases.
import { describe, expect, it } from "vitest";
import { checkAddressForms } from "../lib/address-form-check.js";
import { hasTerm } from "../lib/term-match.js";
import { validateTranslation } from "../lib/validate-translation.js";

const flagged = (source: string, translated: string, dialect: string) => {
  const r = validateTranslation({ source, translated, dialect } as never) as any;
  return (
    r.valid === false ||
    (r.dialectCompliance?.violations?.length ?? 0) > 0 ||
    (r.lexicalCompliance?.violations?.length ?? 0) > 0 ||
    (r.addressForms?.violations?.length ?? 0) > 0
  );
};

describe("address forms", () => {
  it("flags vos with a tú verb in es-AR", () => {
    expect(checkAddressForms("Vos tienes que ver esto.", "es-AR" as never).violations.length).toBeGreaterThan(0);
  });
  it("flags tú and tú verbs in es-AR", () => {
    expect(checkAddressForms("Tú hablas muy rápido.", "es-AR" as never).violations.length).toBeGreaterThan(0);
  });
  it("flags tú imperative with clitic in es-AR", () => {
    expect(checkAddressForms("Escúchame, ven aquí.", "es-AR" as never).violations.length).toBeGreaterThan(0);
  });
  it("accepts voseo in es-AR", () => {
    expect(checkAddressForms("Vos tenés que ver esto, escuchame.", "es-AR" as never).violations).toEqual([]);
  });
  it("flags vosotros outside Spain", () => {
    expect(checkAddressForms("Vosotros deberíais traer vuestras chaquetas.", "es-MX" as never).violations.length).toBeGreaterThan(0);
  });
  it("accepts vosotros in Spain", () => {
    expect(checkAddressForms("Vosotros deberíais traer vuestras chaquetas.", "es-ES" as never).violations).toEqual([]);
  });
  it("does not flag jerséis or the clitic os", () => {
    expect(checkAddressForms("Los jerséis están aquí.", "es-MX" as never).violations).toEqual([]);
  });
});

describe("term matching", () => {
  it("matches accent-insensitively", () => {
    expect(hasTerm("agarrá las frutillas", "agarra")).toBe(true);
  });
  it("matches inflected forms of an infinitive", () => {
    expect(hasTerm("coged un zumo", "coger")).toBe(true);
    expect(hasTerm("cojamos el bus", "coger")).toBe(true);
  });
  it("does not match unrelated words", () => {
    expect(hasTerm("el coche rojo", "coger")).toBe(false);
  });
});

describe("validate on eval cases", () => {
  it("catches heladera for es-MX when the source says fridge", () => {
    expect(flagged("There is milk in the fridge.", "Hay leche en la heladera.", "es-MX")).toBe(true);
  });
  it("accepts Coged un zumo de la nevera in es-ES", () => {
    expect(flagged("Grab a juice from the fridge, guys.", "Coged un zumo de la nevera, chicos.", "es-ES")).toBe(false);
  });
  it("accepts Agarrá in es-AR", () => {
    expect(flagged("Grab your jacket, it's cold.", "Agarrá la campera, hace frío.", "es-AR")).toBe(false);
  });
  it("does not treat 'bus stop' as a dropped negation", () => {
    expect(flagged("Can you pick me up at the bus stop?", "¿Me podés buscar en la parada del colectivo?", "es-AR")).toBe(false);
  });
});
