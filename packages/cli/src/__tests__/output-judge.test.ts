import { describe, expect, it } from "vitest";
import { judgeTranslationOutput } from "../lib/output-judge.js";

describe("output judge", () => {
  it("blocks prompt leakage and explanations", () => {
    const result = judgeTranslationOutput(
      { source: "Pick up the file.", forbiddenOutputTerms: [] },
      "es-MX",
      "Translation: Dialect quality contract says recoge el archivo."
    );

    expect(result.blockingIssues.map((issue) => issue.category)).toEqual(expect.arrayContaining([
      "prompt-leak",
      "provider-protocol",
    ]));
  });

  it("blocks missing placeholders and URLs", () => {
    const result = judgeTranslationOutput(
      { source: "Hi {userName}, go to https://example.com/app.", forbiddenOutputTerms: [] },
      "es-PR",
      "Hola usuario, ve a la app."
    );

    expect(result.blockingIssues).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: "markup-placeholder", message: expect.stringContaining("{userName}") }),
      expect.objectContaining({ category: "markup-placeholder", message: expect.stringContaining("https://example.com/app") }),
    ]));
  });

  it("blocks unchanged English outputs", () => {
    const result = judgeTranslationOutput(
      { source: "Pick up the package from reception.", forbiddenOutputTerms: [] },
      "es-PA",
      "Pick up the package from reception."
    );

    expect(result.blockingIssues).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: "accuracy", message: expect.stringContaining("unchanged") }),
    ]));
  });

  it("turns required output groups into blocking semantic-trait issues", () => {
    const result = judgeTranslationOutput(
      {
        source: "Pick up the package from reception.",
        forbiddenOutputTerms: ["coger"],
        requiredOutputGroups: [["paquete"], ["recoge", "recoger", "retira", "retirar"]],
      },
      "es-MX",
      "Recoge en recepción."
    );

    expect(result.blockingIssues).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: "accuracy", message: expect.stringContaining("paquete") }),
    ]));
  });

  it("keeps preferred traits non-blocking", () => {
    const result = judgeTranslationOutput(
      {
        source: "Catch the bus to the office.",
        forbiddenOutputTerms: [],
        requiredOutputGroups: [["autobús", "bus"], ["toma", "tomar"]],
        preferredOutputAny: ["camión"],
      },
      "es-MX",
      "Toma el autobús a la oficina."
    );

    expect(result.blockingIssues).toEqual([]);
    expect(result.issues).toEqual(expect.arrayContaining([
      expect.objectContaining({ category: "dialect", severity: "minor" }),
    ]));
  });
});

