import { describe, expect, it } from "vitest";
import {
  analyzeSemanticContext,
  buildSemanticTranslationContext,
} from "../lib/semantic-context.js";

describe("semantic translation context", () => {
  it("classifies technical/security intent beyond literal terms", () => {
    const signals = analyzeSemanticContext(
      "If the API token is invalid, the endpoint returns a permission denied error."
    );

    expect(signals.domain).toBe("security");
    expect(signals.intent).toBe("error-message");
    expect(signals.matchedSignals.length).toBeGreaterThan(1);
  });

  it("builds dialect-aware context that rejects word-by-word translation", () => {
    const context = buildSemanticTranslationContext({
      text: "Configure the endpoint and review the authentication token before deployment.",
      dialect: "es-MX",
      documentKind: "api-docs",
      sectionType: "paragraph",
    });

    expect(context).toContain("do not translate literally word-by-word");
    expect(context).toContain("Mexican Spanish");
    expect(context).toContain("Document domain: security");
    expect(context).toContain("Document kind: api-docs");
    expect(context).toContain("Preserve product names");
  });
});
