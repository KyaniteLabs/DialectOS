import { describe, it, expect } from "vitest";
import { detectGrammarSignals } from "../tools/grammar-detector.js";

describe("detectGrammarSignals false positives (roast item 10)", () => {
  it("does not read 'Le dije la verdad' as leísmo or vosotros", () => {
    const signals = detectGrammarSignals("Le dije la verdad.");
    expect(signals.leismo).toBe(0);
    expect(signals.vosotros).toBe(0);
  });

  it("does not read -dad/-tad nouns or words like pared and usted as vosotros imperatives", () => {
    const signals = detectGrammarSignals("La verdad es que usted tiene sed y la pared necesita libertad.");
    expect(signals.vosotros).toBe(0);
  });

  it("still counts accented tú", () => {
    expect(detectGrammarSignals("¿Tú vienes mañana?").tuPronoun).toBeGreaterThan(0);
  });
});
