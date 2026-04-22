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

  it("includes deep per-dialect grammar guidance", () => {
    const argentina = buildSemanticTranslationContext({
      text: "Help users update their account settings.",
      dialect: "es-AR",
      formality: "informal",
      documentKind: "plain",
    });
    expect(argentina).toContain("Use pronominal and verbal voseo");
    expect(argentina).toContain("Use ustedes for plural address");

    const spain = buildSemanticTranslationContext({
      text: "Configure your password and account settings.",
      dialect: "es-ES",
      documentKind: "plain",
    });
    expect(spain).toContain("vosotros/vosotras");
    expect(spain).toContain("coger is neutral in Spain");
  });
  it("includes quality-contract fallback and safety policy", () => {
    const mexico = buildSemanticTranslationContext({
      text: "Translate the onboarding instructions for users.",
      dialect: "es-MX",
      documentKind: "plain",
    });
    expect(mexico).toContain("evidenceTier=corpus-backed");
    expect(mexico).toContain("Localize grammar and common vocabulary confidently");
    expect(mexico).toContain("Avoid literal coger");

    const philippines = buildSemanticTranslationContext({
      text: "Translate account settings for a public website.",
      dialect: "es-PH",
      documentKind: "plain",
    });
    expect(philippines).toContain("marketTier=heritage");
    expect(philippines).toContain("Use conservative neutral Spanish");
    expect(philippines).toContain("do not fake local fluency");
  });


  it("adds hard output constraints for local LLM certification fixtures", () => {
    const bolivia = buildSemanticTranslationContext({
      text: "Buy hot sauce for lunch.",
      dialect: "es-BO",
      documentKind: "plain",
    });
    expect(bolivia).toContain("Output constraints");
    expect(bolivia).toContain("must include one of: llajwa, llajua");

    const panama = buildSemanticTranslationContext({
      text: "Take the bus to the office.",
      dialect: "es-PA",
      documentKind: "plain",
    });
    expect(panama).toContain("must not contain: cueco, chombo, yeyé");

    const mexico = buildSemanticTranslationContext({
      text: "Pick up the file before deployment.",
      dialect: "es-MX",
      documentKind: "plain",
    });
    expect(mexico).toContain("use the exact correct form recoge");
    expect(mexico).toContain("do not use the invalid form recoga");

    const chile = buildSemanticTranslationContext({
      text: "Buy avocado for lunch.",
      dialect: "es-CL",
      documentKind: "plain",
    });
    expect(chile).toContain("must use palta");

    const guatemala = buildSemanticTranslationContext({
      text: "You can update your account now.",
      dialect: "es-GT",
      formality: "informal",
      documentKind: "plain",
    });
    expect(guatemala).toContain("must use Central American voseo");
    expect(guatemala).toContain("do not use tú/puedes");
  });


  it("adds regional semantic-field constraints for Puerto Rican orange juice and guagua", () => {
    const orange = buildSemanticTranslationContext({
      text: "Orange juice is ready.",
      dialect: "es-PR",
      documentKind: "plain",
    });
    const baby = buildSemanticTranslationContext({
      text: "The baby is sleeping.",
      dialect: "es-PR",
      documentKind: "plain",
    });

    expect(orange).toContain("jugo de china");
    expect(orange).toContain("do not use jugo de naranja");
    expect(baby).toContain("do not use guagua");
  });

});
