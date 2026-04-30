#!/usr/bin/env node
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { pathToFileURL } from "node:url";

const args = new Map();
for (const arg of process.argv.slice(2)) {
  if (arg === "--") continue;
  const [key, value = ""] = arg.replace(/^--/, "").split("=");
  args.set(key, value || "true");
}

const fixtureDir = args.get("fixtures") || "packages/cli/src/__tests__/fixtures/dialect-eval";
const outDir = args.get("out") || `audits/dialect-eval-${new Date().toISOString().slice(0, 10)}`;
const providerName = args.get("provider") || "mock-semantic";
const live = args.get("live") === "true";
const failOnWarnings = args.get("fail-on-warnings") === "true";
const judgeEnabled = live || args.get("judge") === "true";
const dialectFilter = new Set((args.get("dialects") || "").split(",").map((d) => d.trim()).filter(Boolean));

const {
  mockTranslate,
  createLiveTranslate,
  hasForbiddenTerm,
  evaluateSample,
  loadFixtures,
  buildSummary,
} = await import(pathToFileURL(`${process.cwd()}/packages/cli/dist/lib/eval-harness.js`).href);

const translate = live
  ? await createLiveTranslate(providerName)
  : async (sample, dialect) => mockTranslate(sample.source, dialect, sample);

const results = [];
for (const { dialect, samples } of loadFixtures(fixtureDir, dialectFilter)) {
  for (const sample of samples) {
    results.push(await evaluateSample(sample, dialect, translate, {
      providerName,
      live,
      judgeEnabled,
      warnOnMissingMetadata: true,
    }));
  }
}

const summary = buildSummary(results, { fixtureDir, providerName, live });

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "results.json"), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify({ outDir, total: summary.total, passed: summary.passed, failed: summary.failed, warnings: summary.warnings, live }, null, 2));

if (summary.failed > 0 || (failOnWarnings && summary.warnings > 0)) {
  process.exit(1);
}
