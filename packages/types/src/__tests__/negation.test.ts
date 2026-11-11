import { describe, it, expect } from "vitest";
import { countNegators, negationDropped } from "../negation.js";

describe("negationDropped", () => {
  it("catches an inverted instruction", () => {
    expect(negationDropped("You must not delete the file.", "Debes eliminar el archivo.")).toBe(true);
  });

  it("expands contractions, including curly apostrophes", () => {
    expect(negationDropped("Don't delete the file.", "Elimina el archivo.")).toBe(true);
    expect(negationDropped("Don’t delete the file.", "Elimina el archivo.")).toBe(true);
  });

  it("accepts any Spanish negator", () => {
    expect(negationDropped("You must not delete the file.", "No debes eliminar el archivo.")).toBe(false);
    expect(negationDropped("Never share your password.", "Nunca compartas tu contraseña.")).toBe(false);
    expect(negationDropped("No results", "Sin resultados")).toBe(false);
  });

  it("ignores verbs that merely mean stopping or avoiding", () => {
    expect(countNegators("Stop the server and avoid restarts.", "en")).toBe(0);
  });

  it("passes when the source has no negation", () => {
    expect(negationDropped("Save the file.", "Guarda el archivo.")).toBe(false);
  });
});
