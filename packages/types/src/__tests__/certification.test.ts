import { describe, expect, it } from "vitest";
import {
  ALL_SPANISH_DIALECTS,
  CERTIFICATION_LEVEL_DESCRIPTIONS,
  DIALECT_VALIDATION_METADATA,
  getDialectValidationMetadata,
  type MQMIssue,
} from "../index";

describe("certification metadata", () => {
  it("defines validation metadata for every supported dialect", () => {
    expect(DIALECT_VALIDATION_METADATA.map((entry) => entry.dialect).sort()).toEqual([...ALL_SPANISH_DIALECTS].sort());
  });

  it("marks Panama and Puerto Rico as native-reviewed", () => {
    expect(getDialectValidationMetadata("es-PA")?.status).toBe("native-reviewed");
    expect(getDialectValidationMetadata("es-PR")?.certificationLevel).toBe("silver");
  });

  it("supports MQM-aligned issue records", () => {
    const issue: MQMIssue = {
      category: "locale-convention",
      severity: "critical",
      dialect: "es-PR",
      fixture: "pr-transit-neutral",
      source: "Take the bus to the office.",
      output: "Tome el autobús a la oficina.",
      message: "Missing Puerto Rican transit term: guagua",
    };
    expect(issue.category).toBe("locale-convention");
    expect(issue.severity).toBe("critical");
    expect(CERTIFICATION_LEVEL_DESCRIPTIONS.gold).toContain("customer");
  });
});
