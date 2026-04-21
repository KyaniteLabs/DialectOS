import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { SpanishDialect, FormalityLevel } from "@espanol/types";
import { buildSemanticTranslationContext } from "../lib/semantic-context.js";

interface DialectEvalSample {
  id: string;
  source: string;
  domain: string;
  register: FormalityLevel;
  documentKind: "plain" | "readme" | "api-docs" | "i18n";
  requiredContext: string[];
  forbiddenContext: string[];
  forbiddenOutputTerms: string[];
  requiredOutputAny?: string[];
  preferredOutputAny?: string[];
  notes: string;
}

const fixtureDir = join(import.meta.dirname, "fixtures", "dialect-eval");

function loadFixture(file: string): { dialect: SpanishDialect; samples: DialectEvalSample[] } {
  const dialect = file.replace(/\.json$/, "") as SpanishDialect;
  const samples = JSON.parse(readFileSync(join(fixtureDir, file), "utf-8")) as DialectEvalSample[];
  return { dialect, samples };
}

describe("dialect evaluation harness", () => {
  const fixtures = readdirSync(fixtureDir).filter((file) => file.endsWith(".json"));

  it("has launch fixtures for the initial high-value dialect set", () => {
    expect(fixtures.sort()).toEqual(["es-AR.json", "es-ES.json", "es-MX.json", "es-PA.json", "es-PR.json"]);
  });

  for (const file of fixtures) {
    const { dialect, samples } = loadFixture(file);

    it(`${dialect} semantic context satisfies eval fixture constraints`, () => {
      expect(samples.length).toBeGreaterThan(0);
      for (const sample of samples) {
        const context = buildSemanticTranslationContext({
          text: sample.source,
          dialect,
          formality: sample.register,
          documentKind: sample.documentKind,
        });

        for (const required of sample.requiredContext) {
          expect(context, `${sample.id} missing ${required}`).toContain(required);
        }
        for (const forbidden of sample.forbiddenContext) {
          expect(context, `${sample.id} should not contain ${forbidden}`).not.toContain(forbidden);
        }
        expect(sample.forbiddenOutputTerms.length).toBeGreaterThan(0);
        expect(sample.requiredOutputAny || sample.preferredOutputAny).toBeDefined();
        expect(sample.notes.length).toBeGreaterThan(10);
      }
    });
  }
});
