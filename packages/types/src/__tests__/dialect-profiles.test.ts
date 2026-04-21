import { describe, expect, it } from "vitest";
import { ALL_SPANISH_DIALECTS } from "../index.js";
import {
  DIALECT_GRAMMAR_PROFILES,
  getDialectGrammarProfile,
} from "../dialect-profiles.js";

describe("dialect grammar profiles", () => {
  it("covers every supported Spanish dialect with source-backed grammar guidance", () => {
    expect(DIALECT_GRAMMAR_PROFILES).toHaveLength(ALL_SPANISH_DIALECTS.length);
    const profileCodes = new Set(DIALECT_GRAMMAR_PROFILES.map((profile) => profile.code));

    for (const code of ALL_SPANISH_DIALECTS) {
      expect(profileCodes.has(code)).toBe(true);
      const profile = getDialectGrammarProfile(code)!;
      expect(profile.voseo).toBeDefined();
      expect(profile.pluralAddress).toMatch(/ustedes|vosotros/i);
      expect(profile.formalityNorms.length).toBeGreaterThanOrEqual(2);
      expect(profile.tabooAndAmbiguityNotes.length).toBeGreaterThanOrEqual(2);
      expect(profile.semanticPromptGuidance.length).toBeGreaterThanOrEqual(4);
      expect(profile.sourceRefs.length).toBeGreaterThanOrEqual(2);
      expect(profile.sourceRefs.every((source) => source.url.startsWith("https://"))).toBe(true);
    }
  });

  it("distinguishes core grammar systems for high-risk dialects", () => {
    expect(getDialectGrammarProfile("es-ES")?.pluralAddress).toContain("vosotros");
    expect(getDialectGrammarProfile("es-MX")?.voseo.type).toBe("none");
    expect(getDialectGrammarProfile("es-AR")?.voseo.type).toBe("dominant");
    expect(getDialectGrammarProfile("es-UY")?.voseo.type).toBe("dominant");
    expect(getDialectGrammarProfile("es-CL")?.voseo.type).toBe("informal");
    expect(getDialectGrammarProfile("es-CR")?.formalityNorms.join(" ")).toMatch(/usted/i);
  });

  it("includes leismo/laismo/loismo and taboo ambiguity notes", () => {
    expect(getDialectGrammarProfile("es-ES")?.leismoLaismoLoismoNotes.join(" ")).toMatch(/leísmo/i);
    expect(getDialectGrammarProfile("es-MX")?.tabooAndAmbiguityNotes.join(" ")).toMatch(/coger/i);
    expect(getDialectGrammarProfile("es-CO")?.tabooAndAmbiguityNotes.join(" ")).toMatch(/marica/i);
  });
});
