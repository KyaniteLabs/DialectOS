import { describe, it, expect } from "vitest";
import { applyVoseo } from "../voseo-adapter.js";

describe("applyVoseo", () => {
  it("swaps tú present forms to vos forms for es-AR", () => {
    const result = applyVoseo("Tú tienes que venir rápido.", "es-AR", "informal");
    expect(result).toContain("tenés");
    expect(result).not.toContain("tienes");
  });

  it("swaps multiple tú forms in one sentence for es-AR", () => {
    const result = applyVoseo("Tú puedes hacerlo si haces eso y vienes temprano.", "es-AR", "informal");
    expect(result).toContain("podés");
    expect(result).toContain("hacés");
    expect(result).toContain("venís");
    expect(result).not.toContain("puedes");
    expect(result).not.toContain("haces");
    expect(result).not.toContain("vienes");
  });

  it("does not swap for tú-only dialects like es-ES", () => {
    const result = applyVoseo("Tú tienes que venir rápido.", "es-ES", "informal");
    expect(result).toContain("tienes");
    expect(result).not.toContain("tenés");
  });

  it("does not swap for tú-only dialects like es-MX", () => {
    const result = applyVoseo("Tú tienes que venir rápido.", "es-MX", "informal");
    expect(result).toContain("tienes");
    expect(result).not.toContain("tenés");
  });

  it("does not swap when formality is formal", () => {
    const result = applyVoseo("Tú tienes que venir rápido.", "es-AR", "formal");
    expect(result).toContain("tienes");
    expect(result).not.toContain("tenés");
  });

  it("swaps for es-AR with auto formality", () => {
    const result = applyVoseo("Tú tienes que venir rápido.", "es-AR", "auto");
    expect(result).toContain("tenés");
    expect(result).not.toContain("tienes");
  });

  it("does NOT swap ambiguous imperative forms (e.g. cuenta → contá)", () => {
    // "cuenta" is a noun (account) here, not the imperative of "contar"
    const result = applyVoseo("Vos podés actualizar tu cuenta ahora.", "es-AR", "informal");
    expect(result).toContain("cuenta");
    expect(result).not.toContain("contá");
  });

  it("swaps for other full voseo dialects like es-UY", () => {
    const result = applyVoseo("Tú puedes hacerlo si haces eso.", "es-UY", "informal");
    expect(result).toContain("podés");
    expect(result).toContain("hacés");
  });

  it("only swaps for regional voseo dialects when explicitly informal", () => {
    // es-BO is a regional voseo dialect — only swap when informal
    const informal = applyVoseo("Tú puedes hacerlo si haces eso.", "es-BO", "informal");
    expect(informal).toContain("podés");

    const auto = applyVoseo("Tú puedes hacerlo.", "es-BO", "auto");
    expect(auto).toContain("puedes");
    expect(auto).not.toContain("podés");
  });

  it("returns input unchanged for empty text", () => {
    expect(applyVoseo("", "es-AR", "informal")).toBe("");
  });

  it("returns input unchanged when no dialect", () => {
    const input = "Tú tienes que venir.";
    expect(applyVoseo(input, "" as any, "informal")).toBe(input);
  });
});

describe("applyVoseo pronouns and quotes", () => {
  it("moves the pronoun with the verb instead of leaving 'tú tenés'", () => {
    expect(applyVoseo("Tú tienes razón y lo sabes.", "es-AR", "informal")).toBe("Vos tenés razón y lo sabés.");
  });

  it("swaps prepositional ti and contigo, but not the acronym TI or possessive tu", () => {
    expect(applyVoseo("Esto es para ti y voy contigo.", "es-AR", "informal")).toBe("Esto es para vos y voy con vos.");
    expect(applyVoseo("Habla con el equipo de TI sobre tu cuenta.", "es-AR", "informal")).toBe(
      "Habla con el equipo de TI sobre tu cuenta."
    );
  });

  it("leaves quoted speech exactly as written", () => {
    expect(applyVoseo('Dijo "tú tienes razón" y tienes que creerle.', "es-AR", "informal")).toBe(
      'Dijo "tú tienes razón" y tenés que creerle.'
    );
    expect(applyVoseo("Leí «tú puedes» en la pared.", "es-AR", "informal")).toBe("Leí «tú puedes» en la pared.");
  });

  it("stays linear on long runs of unmatched opening quotes", () => {
    for (const opener of ["“", "«"]) {
      const text = opener.repeat(50_000) + " tienes";
      const start = performance.now();
      expect(applyVoseo(text, "es-AR", "informal")).toBe(opener.repeat(50_000) + " tenés");
      expect(performance.now() - start).toBeLessThan(1000);
    }
  });
});
