import { describe, expect, it } from "vitest";
import { resolveNounGender, articleMatchesNoun, definiteArticle, indefiniteArticle } from "../noun-gender.js";

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

  it("regression: papa is feminine (food), color and calor are masculine", () => {
    // "papa" was wrongly in the masculine -a exception list, which would have
    // turned "la patata" into "el papa" during dialect substitution.
    expect(resolveNounGender("papa")).toBe("f");
    expect(articleMatchesNoun("la", "papa")).toBe(true);
    expect(articleMatchesNoun("el", "papa")).toBe(false);
    expect(resolveNounGender("color")).toBe("m");
    expect(resolveNounGender("calor")).toBe("m");
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
