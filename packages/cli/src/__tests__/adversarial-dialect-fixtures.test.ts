import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { ALL_SPANISH_DIALECTS, type FormalityLevel, type SpanishDialect } from "@espanol/types";

interface AdversarialDialectSample {
  id: string;
  category: string;
  severity: "critical" | "high" | "medium" | "low";
  tags: string[];
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

const fixtureDir = join(import.meta.dirname, "fixtures", "dialect-adversarial");
const categories = new Set([
  "dialect-collision",
  "false-friend",
  "intent-ambiguity",
  "morphology-trap",
  "negative-control",
  "over-localization",
  "register-trap",
  "structure-preservation",
  "taboo-copy",
  "under-localization",
]);

function loadFixture(file: string): { dialect: SpanishDialect; samples: AdversarialDialectSample[] } {
  const dialect = file.replace(/\.json$/, "") as SpanishDialect;
  const samples = JSON.parse(readFileSync(join(fixtureDir, file), "utf-8")) as AdversarialDialectSample[];
  return { dialect, samples };
}

describe("adversarial dialect fixtures", () => {
  const fixtures = readdirSync(fixtureDir).filter((file) => file.endsWith(".json"));

  it("covers every supported dialect", () => {
    expect(fixtures.sort()).toEqual(ALL_SPANISH_DIALECTS.map((dialect) => `${dialect}.json`).sort());
  });

  it("has enough adversarial breadth for certification", () => {
    const samples = fixtures.flatMap((file) => loadFixture(file).samples);
    expect(samples.length).toBeGreaterThanOrEqual(100);
    expect(new Set(samples.map((sample) => sample.category))).toEqual(categories);
    expect(samples.filter((sample) => sample.severity === "critical").length).toBeGreaterThanOrEqual(40);
  });

  for (const file of fixtures) {
    const { dialect, samples } = loadFixture(file);

    it(`${dialect} adversarial samples are well-formed`, () => {
      expect(samples.length).toBeGreaterThanOrEqual(4);
      const ids = new Set<string>();
      for (const sample of samples) {
        expect(ids.has(sample.id), `${sample.id} is duplicated`).toBe(false);
        ids.add(sample.id);
        expect(categories.has(sample.category), `${sample.id} invalid category`).toBe(true);
        expect(sample.tags.length).toBeGreaterThan(0);
        expect(sample.source.length).toBeGreaterThan(5);
        expect(sample.requiredContext.length).toBeGreaterThan(0);
        expect(sample.forbiddenOutputTerms.length).toBeGreaterThan(0);
        expect(sample.requiredOutputAny || sample.preferredOutputAny).toBeDefined();
        expect(sample.notes.length).toBeGreaterThan(10);
      }
    });
  }
});
