import { describe, it, expect } from "vitest";
import {
  mockTranslate,
  hasForbiddenTerm,
  loadFixtures,
  buildSummary,
  evaluateSample,
  VOSEO_DIALECTS,
  VOSOTROS_DIALECTS,
  GUAGUA_BUS_DIALECTS,
} from "../lib/eval-harness.js";
import type { SpanishDialect } from "@dialectos/types";

describe("mockTranslate", () => {
  it("uses voseo for Argentine Spanish", () => {
    const result = mockTranslate("You can update your account now.", "es-AR");
    expect(result.toLowerCase()).toContain("vos");
  });

  it("uses vosotros for Peninsular Spanish", () => {
    const result = mockTranslate("You can all update your passwords now.", "es-ES");
    expect(result.toLowerCase()).toContain("vosotros");
  });

  it("replaces password with contraseña", () => {
    const result = mockTranslate("Please update your password before continuing.", "es-MX", { register: "formal" });
    expect(result).toContain("contraseña");
  });

  it("uses formal register when requested", () => {
    const result = mockTranslate("Please update your password before continuing.", "es-CR", { register: "formal" });
    expect(result).toContain("Por favor");
    expect(result).toContain("actualice");
    expect(result).toContain("su");
  });

  it("uses informal register by default", () => {
    const result = mockTranslate("Please update your password before continuing.", "es-MX");
    expect(result).toContain("Actualiza");
    expect(result).toContain("tu");
  });

  it("uses guagua for Cuban Spanish", () => {
    const result = mockTranslate("Get on the bus.", "es-CU");
    expect(result).toContain("guagua");
  });

  it("uses palta for Chilean Spanish", () => {
    const result = mockTranslate("Buy avocado for lunch.", "es-CL");
    expect(result).toContain("palta");
  });

  it("uses china for Puerto Rican orange juice", () => {
    const result = mockTranslate("Orange juice is ready.", "es-PR");
    expect(result).toContain("china");
  });

  it("uses naranja for Mexican orange juice", () => {
    const result = mockTranslate("Orange juice is ready.", "es-MX");
    expect(result).toContain("naranja");
  });
});

describe("hasForbiddenTerm", () => {
  it("matches whole words only", () => {
    expect(hasForbiddenTerm("The bus stopped.", "bus")).toBe(true);
    expect(hasForbiddenTerm("The business stopped.", "bus")).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(hasForbiddenTerm("The BUS stopped.", "bus")).toBe(true);
  });

  it("matches at start of string", () => {
    expect(hasForbiddenTerm("bus stop", "bus")).toBe(true);
  });

  it("matches at end of string", () => {
    expect(hasForbiddenTerm("take the bus", "bus")).toBe(true);
  });

  it("handles unicode word boundaries", () => {
    expect(hasForbiddenTerm("El autobús", "autobús")).toBe(true);
    expect(hasForbiddenTerm("El autobúsito", "autobús")).toBe(false);
  });
});

describe("dialect sets", () => {
  it("VOSEO_DIALECTS has 7 entries", () => {
    expect(VOSEO_DIALECTS.size).toBe(7);
    expect(VOSEO_DIALECTS.has("es-AR")).toBe(true);
    expect(VOSEO_DIALECTS.has("es-ES")).toBe(false);
  });

  it("VOSOTROS_DIALECTS has 2 entries", () => {
    expect(VOSOTROS_DIALECTS.size).toBe(2);
    expect(VOSOTROS_DIALECTS.has("es-ES")).toBe(true);
  });

  it("GUAGUA_BUS_DIALECTS has 3 entries", () => {
    expect(GUAGUA_BUS_DIALECTS.size).toBe(3);
    expect(GUAGUA_BUS_DIALECTS.has("es-CU")).toBe(true);
  });
});

describe("evaluateSample", () => {
  it("passes a well-formed mock translation", async () => {
    const sample = {
      id: "mx-test",
      source: "Please update your password before continuing.",
      domain: "security",
      register: "formal",
      documentKind: "plain",
      requiredContext: ["Mexican Spanish"],
      forbiddenContext: [],
      forbiddenOutputTerms: ["clave"],
      notes: "Test fixture",
    };

    const translate = async (_sample: any, _dialect: string) =>
      mockTranslate(sample.source, "es-MX", { register: "formal" });

    const result = await evaluateSample(sample, "es-MX", translate, {
      judgeEnabled: false,
      validateEnabled: false,
      warnOnMissingMetadata: false,
    });

    expect(result.passes).toBe(true);
    expect(result.failures).toHaveLength(0);
    expect(result.output).toContain("contraseña");
  });

  it("fails when forbidden term is present", async () => {
    const sample = {
      id: "mx-test",
      source: "Please update your password before continuing.",
      domain: "security",
      register: "formal",
      documentKind: "plain",
      requiredContext: ["Mexican Spanish"],
      forbiddenContext: [],
      forbiddenOutputTerms: ["contraseña"],
      notes: "Test fixture",
    };

    const translate = async (_sample: any, _dialect: string) =>
      mockTranslate(sample.source, "es-MX", { register: "formal" });

    const result = await evaluateSample(sample, "es-MX", translate, {
      judgeEnabled: false,
      validateEnabled: false,
      warnOnMissingMetadata: false,
    });

    expect(result.passes).toBe(false);
    expect(result.failures.some((f) => f.includes("Forbidden output term"))).toBe(true);
  });

  it("reports provider errors as failures", async () => {
    const sample = {
      id: "error-test",
      source: "Hello",
      domain: "general",
      register: "auto",
      documentKind: "plain",
      requiredContext: [],
      forbiddenContext: [],
      notes: "Test fixture",
    };

    const translate = async () => {
      throw new Error("Network timeout");
    };

    const result = await evaluateSample(sample, "es-MX", translate, {
      judgeEnabled: false,
      validateEnabled: false,
      warnOnMissingMetadata: false,
    });

    expect(result.passes).toBe(false);
    expect(result.failures.some((f) => f.includes("Network timeout"))).toBe(true);
  });
});

describe("buildSummary", () => {
  it("aggregates passed/failed correctly", () => {
    const results = [
      { passes: true, failures: [], warnings: [], qualityWarnings: [] } as any,
      { passes: true, failures: [], warnings: [], qualityWarnings: [] } as any,
      { passes: false, failures: ["error"], warnings: [], qualityWarnings: [] } as any,
    ];

    const summary = buildSummary(results, {
      fixtureDir: "fixtures",
      providerName: "mock-semantic",
      live: false,
    });

    expect(summary.total).toBe(3);
    expect(summary.passed).toBe(2);
    expect(summary.failed).toBe(1);
    expect(summary.provider).toBe("mock-semantic");
    expect(summary.live).toBe(false);
  });

  it("counts warnings and qualityWarnings together", () => {
    const results = [
      { passes: true, failures: [], warnings: ["a"], qualityWarnings: ["b", "c"] } as any,
    ];

    const summary = buildSummary(results, {
      fixtureDir: "fixtures",
      providerName: "mock-semantic",
      live: false,
    });

    expect(summary.warnings).toBe(3);
  });
});
