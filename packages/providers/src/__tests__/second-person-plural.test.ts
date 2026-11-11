import { describe, it, expect } from "vitest";
import { adaptSecondPersonPlural } from "../second-person-plural.js";

describe("adaptSecondPersonPlural", () => {
  it("swaps vosotros/vosotras and possessives outside Spain", () => {
    expect(adaptSecondPersonPlural("Vosotros y vuestra familia, vosotras y vuestros hijos.", "es-MX")).toBe(
      "Ustedes y su familia, ustedes y sus hijos.",
    );
  });

  it("leaves Spanish from Spain unchanged", () => {
    expect(adaptSecondPersonPlural("Vosotros y vuestra casa.", "es-ES")).toBe("Vosotros y vuestra casa.");
  });

  it("does not touch words that only contain the forms", () => {
    expect(adaptSecondPersonPlural("nosotros", "es-AR")).toBe("nosotros");
  });
});
