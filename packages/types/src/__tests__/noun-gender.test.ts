import { describe, expect, it } from "vitest";
import { resolveNounGender, articleMatchesNoun, definiteArticle, indefiniteArticle, isAmbiguousNoun } from "../noun-gender.js";

describe("resolveNounGender", () => {
  it("returns m for -o nouns", () => {
    expect(resolveNounGender("carro")).toBe("m");
    expect(resolveNounGender("coche")).toBe("m");
    expect(resolveNounGender("libro")).toBe("m");
  });

  it("returns f for -a nouns", () => {
    expect(resolveNounGender("casa")).toBe("f");
    expect(resolveNounGender("mesa")).toBe("f");
    expect(resolveNounGender("computadora")).toBe("f");
  });

  it("handles masculine -a exceptions", () => {
    expect(resolveNounGender("mapa")).toBe("m");
    expect(resolveNounGender("problema")).toBe("m");
    expect(resolveNounGender("sistema")).toBe("m");
    expect(resolveNounGender("idioma")).toBe("m");
  });

  it("handles feminine exceptions", () => {
    expect(resolveNounGender("mano")).toBe("f");
    expect(resolveNounGender("foto")).toBe("f");
    expect(resolveNounGender("flor")).toBe("f");
  });

  it("handles dialect-specific nouns", () => {
    expect(resolveNounGender("guagua")).toBe("f");
    expect(resolveNounGender("computador")).toBe("m");
    expect(resolveNounGender("ordenador")).toBe("m");
  });

  it("regression: resolves accented nouns against the unaccented override keys", () => {
    // The override map stores plain keys ("autobus"); accented input used to
    // miss them because the accent-stripping replace was a no-op.
    expect(resolveNounGender("autobús")).toBe("m");
    expect(resolveNounGender("camión")).toBe("m");
    expect(resolveNounGender("móvil")).toBe("m");
    expect(resolveNounGender("conexión")).toBe("f");
    expect(resolveNounGender("camiones")).toBe("m"); // accented-free plural via singularize
  });

  it("regression: papa is an ambiguous homograph; color and calor are masculine", () => {
    // CEO rule, 2026-09-19: "el papa" (the Pope) / "la papa" (the potato) /
    // "el papá" (the dad) are three different words, all correct as written.
    // Wave 1 had pinned "papa" to feminine, which made the engine flag and
    // rewrite the also-correct "el papa". Resolving to undefined makes every
    // consumer preserve the source article verbatim.
    expect(resolveNounGender("papa")).toBeUndefined();
    expect(articleMatchesNoun("el", "papa")).toBeUndefined();
    expect(articleMatchesNoun("la", "papa")).toBeUndefined();
    expect(isAmbiguousNoun("papa")).toBe(true);
    // Wave-1 fix kept: color/calor resolve masculine via the -or rule and
    // are NOT listed in FEM_EXCEPTIONS.
    expect(resolveNounGender("color")).toBe("m");
    expect(resolveNounGender("calor")).toBe("m");
  });

  it("accent-sensitive keys: papá (dad) is masculine — a different word from papa", () => {
    expect(resolveNounGender("papá")).toBe("m");
    expect(articleMatchesNoun("el", "papá")).toBe(true);
    expect(articleMatchesNoun("la", "papá")).toBe(false);
    expect(isAmbiguousNoun("papá")).toBe(false);
    // Plurals: "los papás" (dads) stays masculine, "las papas" (potatoes)
    // inherits the ambiguity of its singular.
    expect(resolveNounGender("papás")).toBe("m");
    expect(resolveNounGender("papas")).toBeUndefined();
    expect(isAmbiguousNoun("papas")).toBe(true);
  });

  it("other CEO-listed homographs are ambiguous (corpus/behavior-backed)", () => {
    // "cometa" is a real corpus term (concept "kite_toy"); the -a rule used
    // to resolve it as feminine, wrongly flagging "el cometa" (astronomy).
    expect(isAmbiguousNoun("cometa")).toBe(true);
    expect(resolveNounGender("cometa")).toBeUndefined();
    expect(resolveNounGender("cometas")).toBeUndefined();
    // "guía": RAE amb. (el guía the male guide / la guía the guidebook);
    // the -a rule used to flag "el guía".
    expect(isAmbiguousNoun("guía")).toBe(true);
    expect(resolveNounGender("guía")).toBeUndefined();
    expect(resolveNounGender("guías")).toBeUndefined();
    // "frente" (la frente forehead / el frente front) and "orden" (la orden
    // command / el orden order): no reliable rule today; listed so a future
    // rule or override can never pin them to a single gender.
    expect(isAmbiguousNoun("frente")).toBe(true);
    expect(isAmbiguousNoun("orden")).toBe(true);
  });

  it("returns f for -ción nouns", () => {
    expect(resolveNounGender("configuracion")).toBe("f");
    expect(resolveNounGender("aplicacion")).toBe("f");
  });

  it("returns m for -aje nouns", () => {
    expect(resolveNounGender("viaje")).toBe("m");
    expect(resolveNounGender("paisaje")).toBe("m");
  });

  it("handles overrides from the gender map", () => {
    expect(resolveNounGender("tarta")).toBe("f");
    expect(resolveNounGender("pastel")).toBe("m");
    expect(resolveNounGender("zumo")).toBe("m");
    expect(resolveNounGender("jugo")).toBe("m");
  });

  it("is case-insensitive", () => {
    expect(resolveNounGender("Carro")).toBe("m");
    expect(resolveNounGender("CASA")).toBe("f");
  });
});

describe("definiteArticle", () => {
  it("returns la for feminine nouns", () => {
    expect(definiteArticle("casa")).toBe("la");
    expect(definiteArticle("computadora")).toBe("la");
  });

  it("returns el for masculine nouns", () => {
    expect(definiteArticle("carro")).toBe("el");
    expect(definiteArticle("libro")).toBe("el");
  });
});

describe("indefiniteArticle", () => {
  it("returns una for feminine nouns", () => {
    expect(indefiniteArticle("casa")).toBe("una");
  });

  it("returns un for masculine nouns", () => {
    expect(indefiniteArticle("carro")).toBe("un");
  });
});

describe("articleMatchesNoun", () => {
  it("returns true for correct pairs", () => {
    expect(articleMatchesNoun("el", "carro")).toBe(true);
    expect(articleMatchesNoun("la", "casa")).toBe(true);
    expect(articleMatchesNoun("un", "libro")).toBe(true);
    expect(articleMatchesNoun("una", "mesa")).toBe(true);
  });

  it("returns false for mismatched pairs", () => {
    expect(articleMatchesNoun("el", "computadora")).toBe(false);
    expect(articleMatchesNoun("la", "carro")).toBe(false);
    expect(articleMatchesNoun("un", "casa")).toBe(false);
  });

  it("catches el guagua as wrong", () => {
    expect(articleMatchesNoun("el", "guagua")).toBe(false);
  });
});
