import { describe, it, expect } from "vitest";
import { ALL_SPANISH_DIALECTS } from "../index.js";
import type { SpanishDialect } from "../index.js";
import {
  DIALECT_REGIONS,
  ALL_AMERICAN_DIALECTS,
  FULL_VOSEO_DIALECTS,
  REGIONAL_VOSEO_DIALECTS,
  TÚ_ONLY_DIALECTS,
  COGER_TABOO_DIALECTS,
  CONTACT_PHENOMENA_DIALECTS,
  PARQUEAR_DIALECTS,
  getDialectsForRegions,
  isDialectInRegion,
  isDialectInList,
} from "../dialect-regions.js";

// ============================================================================
// Region definitions
// ============================================================================

describe("DIALECT_REGIONS", () => {
  it("has 11 regions", () => {
    expect(Object.keys(DIALECT_REGIONS).length).toBe(11);
  });

  it("every region has required fields", () => {
    for (const region of Object.values(DIALECT_REGIONS)) {
      expect(region.id).toBeTruthy();
      expect(region.name).toBeTruthy();
      expect(region.dialects.length).toBeGreaterThan(0);
      expect(region.basis).toBeTruthy();
    }
  });

  it("every dialect in every region is a valid SpanishDialect", () => {
    const valid = new Set(ALL_SPANISH_DIALECTS);
    for (const region of Object.values(DIALECT_REGIONS)) {
      for (const d of region.dialects) {
        expect(valid.has(d), `Invalid dialect ${d} in region ${region.id}`).toBe(true);
      }
    }
  });

  it("no dialect appears in more than one primary region", () => {
    const seen = new Map<SpanishDialect, string>();
    for (const region of Object.values(DIALECT_REGIONS)) {
      for (const d of region.dialects) {
        const prev = seen.get(d);
        expect(prev, `Dialect ${d} in both ${prev} and ${region.id}`).toBeUndefined();
        seen.set(d, region.id);
      }
    }
  });

  it("all 25 dialects are covered by exactly one region", () => {
    const covered = new Set<SpanishDialect>();
    for (const region of Object.values(DIALECT_REGIONS)) {
      for (const d of region.dialects) covered.add(d);
    }
    expect(covered.size).toBe(ALL_SPANISH_DIALECTS.length);
    for (const d of ALL_SPANISH_DIALECTS) {
      expect(covered.has(d), `Dialect ${d} not in any region`).toBe(true);
    }
  });

  it("no duplicate dialects within a single region", () => {
    for (const region of Object.values(DIALECT_REGIONS)) {
      const unique = new Set(region.dialects);
      expect(unique.size, `Duplicates in ${region.id}`).toBe(region.dialects.length);
    }
  });
});

// ============================================================================
// ALL_AMERICAN_DIALECTS
// ============================================================================

describe("ALL_AMERICAN_DIALECTS", () => {
  it("includes all dialects except es-ES and es-AD", () => {
    const set = new Set(ALL_AMERICAN_DIALECTS);
    expect(set.has("es-ES")).toBe(false);
    expect(set.has("es-AD")).toBe(false);
    for (const d of ALL_SPANISH_DIALECTS) {
      if (d !== "es-ES" && d !== "es-AD") {
        expect(set.has(d), `${d} missing from ALL_AMERICAN_DIALECTS`).toBe(true);
      }
    }
  });

  it("has exactly 23 dialects (25 minus 2 Peninsular)", () => {
    expect(ALL_AMERICAN_DIALECTS.length).toBe(23);
  });
});

// ============================================================================
// Voseo partition (full + regional + tú = all 25, no overlap)
// ============================================================================

describe("Voseo partition", () => {
  it("full + regional + tú covers all 25 dialects", () => {
    const combined = new Set([
      ...FULL_VOSEO_DIALECTS,
      ...REGIONAL_VOSEO_DIALECTS,
      ...TÚ_ONLY_DIALECTS,
    ]);
    expect(combined.size).toBe(ALL_SPANISH_DIALECTS.length);
    for (const d of ALL_SPANISH_DIALECTS) {
      expect(combined.has(d), `${d} not in any voseo category`).toBe(true);
    }
  });

  it("full and regional voseo are disjoint", () => {
    const fullSet = new Set(FULL_VOSEO_DIALECTS);
    for (const d of REGIONAL_VOSEO_DIALECTS) {
      expect(fullSet.has(d), `${d} in both full and regional voseo`).toBe(false);
    }
  });

  it("full and tú-only are disjoint", () => {
    const fullSet = new Set(FULL_VOSEO_DIALECTS);
    for (const d of TÚ_ONLY_DIALECTS) {
      expect(fullSet.has(d), `${d} in both full voseo and tú-only`).toBe(false);
    }
  });

  it("regional and tú-only are disjoint", () => {
    const regSet = new Set(REGIONAL_VOSEO_DIALECTS);
    for (const d of TÚ_ONLY_DIALECTS) {
      expect(regSet.has(d), `${d} in both regional voseo and tú-only`).toBe(false);
    }
  });

  it("es-AR is in full voseo", () => {
    expect(FULL_VOSEO_DIALECTS).toContain("es-AR");
  });

  it("es-CO is in regional voseo", () => {
    expect(REGIONAL_VOSEO_DIALECTS).toContain("es-CO");
  });

  it("es-MX is in tú-only", () => {
    expect(TÚ_ONLY_DIALECTS).toContain("es-MX");
  });

  it("es-ES is in tú-only", () => {
    expect(TÚ_ONLY_DIALECTS).toContain("es-ES");
  });
});

// ============================================================================
// COGER_TABOO_DIALECTS
// ============================================================================

describe("COGER_TABOO_DIALECTS", () => {
  it("excludes es-GQ, es-PH, and es-BZ", () => {
    expect(COGER_TABOO_DIALECTS).not.toContain("es-GQ");
    expect(COGER_TABOO_DIALECTS).not.toContain("es-PH");
    expect(COGER_TABOO_DIALECTS).not.toContain("es-BZ");
  });

  it("excludes es-ES and es-AD", () => {
    expect(COGER_TABOO_DIALECTS).not.toContain("es-ES");
    expect(COGER_TABOO_DIALECTS).not.toContain("es-AD");
  });

  it("includes all other American dialects", () => {
    for (const d of ALL_AMERICAN_DIALECTS) {
      if (d !== "es-GQ" && d !== "es-PH" && d !== "es-BZ") {
        expect(COGER_TABOO_DIALECTS, `${d} missing from COGER_TABOO`).toContain(d);
      }
    }
  });

  it("has exactly 20 dialects (23 American minus GQ, PH, and BZ)", () => {
    expect(COGER_TABOO_DIALECTS.length).toBe(20);
  });
});

// ============================================================================
// CONTACT_PHENOMENA_DIALECTS
// ============================================================================

describe("CONTACT_PHENOMENA_DIALECTS", () => {
  it("includes DO, PR, VE, PA, US, and BZ", () => {
    expect(CONTACT_PHENOMENA_DIALECTS).toContain("es-DO");
    expect(CONTACT_PHENOMENA_DIALECTS).toContain("es-PR");
    expect(CONTACT_PHENOMENA_DIALECTS).toContain("es-VE");
    expect(CONTACT_PHENOMENA_DIALECTS).toContain("es-PA");
    expect(CONTACT_PHENOMENA_DIALECTS).toContain("es-US");
    expect(CONTACT_PHENOMENA_DIALECTS).toContain("es-BZ");
  });

  it("does not include es-ES, es-MX, or es-CU", () => {
    expect(CONTACT_PHENOMENA_DIALECTS).not.toContain("es-ES");
    expect(CONTACT_PHENOMENA_DIALECTS).not.toContain("es-MX");
    expect(CONTACT_PHENOMENA_DIALECTS).not.toContain("es-CU");
  });
});

// ============================================================================
// PARQUEAR_DIALECTS
// ============================================================================

describe("PARQUEAR_DIALECTS", () => {
  it("includes Caribbean, CR, PA, VE, US, and BZ", () => {
    expect(PARQUEAR_DIALECTS).toContain("es-CU");
    expect(PARQUEAR_DIALECTS).toContain("es-DO");
    expect(PARQUEAR_DIALECTS).toContain("es-PR");
    expect(PARQUEAR_DIALECTS).toContain("es-CR");
    expect(PARQUEAR_DIALECTS).toContain("es-PA");
    expect(PARQUEAR_DIALECTS).toContain("es-VE");
    expect(PARQUEAR_DIALECTS).toContain("es-US");
    expect(PARQUEAR_DIALECTS).toContain("es-BZ");
  });

  it("does not include es-ES or es-AR", () => {
    expect(PARQUEAR_DIALECTS).not.toContain("es-ES");
    expect(PARQUEAR_DIALECTS).not.toContain("es-AR");
  });
});

// ============================================================================
// Helper functions
// ============================================================================

describe("isDialectInRegion", () => {
  it("es-ES is in peninsular", () => {
    expect(isDialectInRegion("es-ES", "peninsular")).toBe(true);
  });

  it("es-PR is in caribbean", () => {
    expect(isDialectInRegion("es-PR", "caribbean")).toBe(true);
  });

  it("es-MX is not in caribbean", () => {
    expect(isDialectInRegion("es-MX", "caribbean")).toBe(false);
  });

  it("es-AR is in rioplatense", () => {
    expect(isDialectInRegion("es-AR", "rioplatense")).toBe(true);
  });

  it("es-BZ is in heritage", () => {
    expect(isDialectInRegion("es-BZ", "heritage")).toBe(true);
  });
});

describe("getDialectsForRegions", () => {
  it("returns dialects for a single region", () => {
    const result = getDialectsForRegions(["caribbean"]);
    expect(result).toEqual(expect.arrayContaining(["es-CU", "es-DO", "es-PR"]));
    expect(result.length).toBe(3);
  });

  it("returns dialects for multiple regions", () => {
    const result = getDialectsForRegions(["caribbean", "rioplatense"]);
    expect(result).toEqual(expect.arrayContaining(["es-CU", "es-AR", "es-UY"]));
    expect(result.length).toBe(6);
  });
});

describe("isDialectInList", () => {
  it("works for FULL_VOSEO_DIALECTS", () => {
    expect(isDialectInList("es-AR", FULL_VOSEO_DIALECTS)).toBe(true);
    expect(isDialectInList("es-ES", FULL_VOSEO_DIALECTS)).toBe(false);
  });
});
