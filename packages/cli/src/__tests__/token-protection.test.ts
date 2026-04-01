import { describe, it, expect } from "vitest";
import { restoreProtectedTokens } from "../lib/token-protection.js";

describe("token restoration compatibility", () => {
  it("restores exact placeholder matches", () => {
    const replacements = new Map<string, string>([
      ["__ESPANOL_TOKEN_0__", "Kyanite Labs"],
    ]);
    const out = restoreProtectedTokens("Hello __ESPANOL_TOKEN_0__", replacements);
    expect(out).toContain("Kyanite Labs");
  });

  it("restores normalized placeholder variants from providers", () => {
    const replacements = new Map<string, string>([
      ["__ESPANOL_GLOSS_6__", "Kyanite Labs"],
    ]);
    const out = restoreProtectedTokens("Hola ESPANOL GLOSS 6", replacements);
    expect(out).toContain("Kyanite Labs");
  });
});
