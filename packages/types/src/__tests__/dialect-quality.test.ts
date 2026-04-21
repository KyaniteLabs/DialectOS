import { describe, expect, it } from "vitest";
import { ALL_SPANISH_DIALECTS } from "../index.js";
import {
  DIALECT_QUALITY_CONTRACTS,
  getDialectQualityContract,
  buildDialectQualityPrompt,
} from "../dialect-quality.js";

describe("dialect quality contracts", () => {
  it("covers every supported dialect with release safety rules", () => {
    expect(DIALECT_QUALITY_CONTRACTS).toHaveLength(ALL_SPANISH_DIALECTS.length);
    const codes = new Set(DIALECT_QUALITY_CONTRACTS.map((contract) => contract.code));

    for (const code of ALL_SPANISH_DIALECTS) {
      expect(codes.has(code)).toBe(true);
      const contract = getDialectQualityContract(code)!;
      expect(contract.marketTier).toBeDefined();
      expect(contract.evidenceTier).toBeDefined();
      expect(contract.riskLevel).toBeDefined();
      expect(contract.grammarConfidence).toBeDefined();
      expect(contract.lexicalConfidence).toBeDefined();
      expect(contract.slangPolicy).toBe("avoid-by-default");
      expect(contract.tabooPolicy).toBe("never-unless-requested");
      expect(contract.ambiguityPolicy).toBe("prefer-neutral-alternative");
      expect(contract.fallbackBehavior.length).toBeGreaterThanOrEqual(2);
      expect(contract.safetyRules.length).toBeGreaterThanOrEqual(3);
      expect(contract.releaseGateNotes.length).toBeGreaterThanOrEqual(2);
    }
  });

  it("uses stronger localization only for high-confidence dialects", () => {
    expect(getDialectQualityContract("es-MX")?.evidenceTier).toBe("corpus-backed");
    expect(getDialectQualityContract("es-MX")?.fallbackBehavior.join(" ")).toMatch(/localize/i);
    expect(getDialectQualityContract("es-AR")?.grammarConfidence).toBe("high");
  });

  it("keeps heritage and low-evidence dialects conservative", () => {
    for (const code of ["es-PH", "es-GQ", "es-BZ", "es-AD"] as const) {
      const contract = getDialectQualityContract(code)!;
      expect(["heritage", "regional"]).toContain(contract.marketTier);
      expect(contract.riskLevel).toBe("high");
      expect(contract.fallbackBehavior.join(" ")).toMatch(/neutral|conservative/i);
    }
  });

  it("builds prompt guidance that prevents fake-local slang", () => {
    const prompt = buildDialectQualityPrompt("es-PR");
    expect(prompt).toContain("avoid-by-default");
    expect(prompt).toContain("never-unless-requested");
    expect(prompt).toContain("prefer-neutral-alternative");
    expect(prompt).toMatch(/cabrón|bicho|puñeta/i);
  });
});
