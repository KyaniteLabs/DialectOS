#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const args = new Map();
for (const arg of process.argv.slice(2)) {
  if (arg === "--") continue;
  const [key, value = ""] = arg.replace(/^--/, "").split("=");
  args.set(key, value || "true");
}

const repeat = parsePositiveInt(args.get("repeat"), 1);
const outDir = resolve(args.get("out") || `audits/dialect-adversarial-${new Date().toISOString().slice(0, 10)}`);
const fixtureDir = args.get("fixtures") || "packages/cli/src/__tests__/fixtures/dialect-adversarial";
const strictOutputStability = args.get("strict-output-stability") === "true";

function parsePositiveInt(value, fallback) {
  const parsed = parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function passThroughArgs(runOutDir) {
  const forwarded = [
    "scripts/dialect-certify.mjs",
    `--fixtures=${fixtureDir}`,
    `--out=${runOutDir}`,
  ];
  for (const key of ["provider", "dialects", "sample-timeout-ms", "sample-retries"]) {
    if (args.has(key)) forwarded.push(`--${key}=${args.get(key)}`);
  }
  if (args.get("live") === "true") forwarded.push("--live");
  return forwarded;
}

function summarizeRuns(runSummaries) {
  const flattened = [];
  const bySample = new Map();
  for (const run of runSummaries) {
    for (const result of run.results) {
      const key = `${result.dialect}/${result.fixture}`;
      const enriched = { ...result, run: run.run };
      flattened.push(enriched);
      if (!bySample.has(key)) bySample.set(key, []);
      bySample.get(key).push(enriched);
    }
  }

  const unstable = [];
  const outputVariance = [];
  for (const [key, results] of bySample) {
    const passStates = new Set(results.map((result) => result.passes));
    const warningCounts = new Set(results.map((result) => result.warnings.length + result.qualityWarnings.length));
    const failureCounts = new Set(results.map((result) => result.failures.length));
    const outputs = new Set(results.map((result) => result.output));
    if (passStates.size > 1 || warningCounts.size > 1 || failureCounts.size > 1 || (strictOutputStability && outputs.size > 1)) {
      unstable.push({ key, passStates: [...passStates], outputs: [...outputs], results });
    } else if (outputs.size > 1) {
      outputVariance.push({ key, outputs: [...outputs] });
    }
  }

  return {
    generatedAt: new Date().toISOString(),
    fixtureDir,
    repeat,
    totalRuns: runSummaries.length,
    totalSamples: flattened.length,
    passed: flattened.filter((result) => result.passes).length,
    failed: flattened.filter((result) => !result.passes).length,
    warnings: flattened.reduce((count, result) => count + result.qualityWarnings.length + result.warnings.length, 0),
    unstableCount: unstable.length,
    outputVarianceCount: outputVariance.length,
    unstable,
    outputVariance,
    results: flattened,
  };
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function writeFailureMatrix(summary) {
  const lines = [
    "# Adversarial Dialect Certification Matrix",
    "",
    `Generated: ${summary.generatedAt}`,
    `Fixture dir: ${summary.fixtureDir}`,
    `Repeats: ${summary.repeat}`,
    `Total sample-runs: ${summary.totalSamples}`,
    `Passed: ${summary.passed}`,
    `Failed: ${summary.failed}`,
    `Warnings: ${summary.warnings}`,
    `Unstable samples: ${summary.unstableCount}`,
    `Output variance samples: ${summary.outputVarianceCount}`,
    "",
    "| Run | Dialect | Fixture | Category | Severity | Pass | Warnings | Failures | Output |",
    "| --- | --- | --- | --- | --- | --- | ---: | --- | --- |",
  ];
  for (const result of summary.results) {
    lines.push(`| ${result.run} | ${result.dialect} | ${result.fixture} | ${result.category || ""} | ${result.severity || ""} | ${result.passes ? "yes" : "no"} | ${(result.warnings.length + result.qualityWarnings.length)} | ${[...result.failures, ...result.qualityWarnings].join("; ").replace(/\|/g, "\\|")} | ${(result.output || "").replace(/\|/g, "\\|")} |`);
  }
  if (summary.unstable.length > 0) {
    lines.push("", "## Unstable samples", "");
    for (const item of summary.unstable) {
      lines.push(`- ${item.key}: ${item.outputs.map((output) => JSON.stringify(output)).join(" vs ")}`);
    }
  }
  if (summary.outputVariance.length > 0) {
    lines.push("", "## Output variance (passing)", "");
    for (const item of summary.outputVariance) {
      lines.push(`- ${item.key}: ${item.outputs.map((output) => JSON.stringify(output)).join(" vs ")}`);
    }
  }
  writeFileSync(join(outDir, "failure-matrix.md"), `${lines.join("\n")}\n`);
}

mkdirSync(outDir, { recursive: true });
const runSummaries = [];
for (let run = 1; run <= repeat; run++) {
  const runOutDir = join(outDir, `run-${run}`);
  const child = spawnSync(process.execPath, passThroughArgs(runOutDir), {
    cwd: process.cwd(),
    env: process.env,
    encoding: "utf-8",
    maxBuffer: 20 * 1024 * 1024,
    timeout: 300000,
    killSignal: "SIGKILL",
  });
  process.stdout.write(child.stdout || "");
  process.stderr.write(child.stderr || "");
  const resultsPath = join(runOutDir, "results.json");
  const summary = JSON.parse(readFileSync(resultsPath, "utf-8"));
  runSummaries.push({ ...summary, run });
}

const summary = summarizeRuns(runSummaries);
writeJson(join(outDir, "results.json"), summary);
writeFailureMatrix(summary);
console.log(JSON.stringify({ outDir, totalSamples: summary.totalSamples, passed: summary.passed, failed: summary.failed, warnings: summary.warnings, unstable: summary.unstableCount, outputVariance: summary.outputVarianceCount }, null, 2));

if (summary.failed > 0 || summary.unstableCount > 0) {
  process.exit(1);
}
