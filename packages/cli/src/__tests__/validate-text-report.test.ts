import { describe, expect, it } from "vitest";
import { formatTextReport } from "../commands/validate.js";
import { validateTranslation } from "../lib/validate-translation.js";

describe("formatTextReport", () => {
  it("does not print a bare score next to a FAIL", () => {
    const report = validateTranslation({
      source: "Click Save to continue.",
      translated: "Click Save to continue.",
      dialect: "es-MX",
    });
    expect(report.valid).toBe(false);
    const text = formatTextReport(report);
    expect(text).toContain("Validation: FAIL");
    expect(text).toMatch(/Quality score: \d+\/100 \(component average only; failed on \d+ blocking issue\(s\) below\)/);
  });

  it("prints the plain score on a PASS", () => {
    const report = validateTranslation({
      source: "The application failed to process the request.",
      translated: "La aplicación no pudo procesar la solicitud.",
      dialect: "es-MX",
    });
    expect(report.valid).toBe(true);
    expect(formatTextReport(report)).toMatch(/Quality score: \d+\/100\n/);
  });
});
