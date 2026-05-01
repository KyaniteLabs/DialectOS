#!/usr/bin/env node
/**
 * Benchmark runner for dialect detection accuracy.
 *
 * Usage:
 *   node scripts/benchmark-detection.mjs [--corpus=path] [--out=dir]
 */

import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Import MCP DIALECT_METADATA (keyword source of truth)
const { DIALECT_METADATA } = await import(
  join(__dirname, "../packages/mcp/dist/tools/translator-data.js")
);

const args = new Map();
for (const arg of process.argv.slice(2)) {
  if (arg === "--") continue;
  const [key, value = ""] = arg.replace(/^--/, "").split("=");
  args.set(key, value || "true");
}

const corpusPath =
  args.get("corpus") ||
  join(__dirname, "../packages/benchmarks/dialect-detection-corpus/samples.json");
const outDir =
  args.get("out") ||
  join(__dirname, "../packages/benchmarks/dialect-detection-corpus/results");

const corpus = JSON.parse(readFileSync(corpusPath, "utf-8"));

/**
 * Replicate the MCP keyword-matching detection algorithm.
 * See packages/mcp/src/tools/translator-handlers.ts handleDetectDialect
 */
function detectDialectMcp(text) {
  const lowerText = text.toLowerCase();
  const scores = [];

  for (const dialect of DIALECT_METADATA) {
    let score = 0;
    const matchedKeywords = [];

    for (const keyword of dialect.keywords) {
      if (lowerText.includes(keyword.toLowerCase())) {
        score++;
        matchedKeywords.push(keyword);
      }
    }

    if (score > 0) {
      scores.push({
        dialect: dialect.code,
        score,
        matchedKeywords,
      });
    }
  }

  scores.sort((a, b) => b.score - a.score);

  // Tie handling: if top two are tied, ambiguous
  if (scores.length >= 2 && scores[0].score === scores[1].score) {
    return {
      top1: { dialect: "es-ES", confidence: 0, matchedKeywords: [] },
      top3: scores.slice(0, 3).map((s) => ({
        dialect: s.dialect,
        confidence: Math.min(s.score / 3, 1),
        matchedKeywords: s.matchedKeywords,
      })),
      ambiguity: `Tied: ${scores[0].dialect} vs ${scores[1].dialect}`,
    };
  }

  const best = scores[0];
  const CONFIDENCE_NORMALIZER = 3;
  const confidence = best ? Math.min(best.score / CONFIDENCE_NORMALIZER, 1) : 0;
  const detectedDialect = best ? best.dialect : "es-ES";
  const matchedKeywords = best ? best.matchedKeywords : [];

  return {
    top1: { dialect: detectedDialect, confidence, matchedKeywords },
    top3: scores.slice(0, 3).map((s) => ({
      dialect: s.dialect,
      confidence: Math.min(s.score / CONFIDENCE_NORMALIZER, 1),
      matchedKeywords: s.matchedKeywords,
    })),
    ambiguity: null,
  };
}

// Run benchmark
const results = [];
let totalConfidence = 0;
let confidenceCount = 0;

for (const sample of corpus) {
  const detection = detectDialectMcp(sample.text);
  const top1Correct = detection.top1.dialect === sample.expectedDialect;
  const top3Correct = detection.top3.some(
    (t) => t.dialect === sample.expectedDialect
  );

  totalConfidence += detection.top1.confidence;
  confidenceCount++;

  results.push({
    text: sample.text,
    expectedDialect: sample.expectedDialect,
    predictedDialect: detection.top1.dialect,
    confidence: detection.top1.confidence,
    matchedKeywords: detection.top1.matchedKeywords,
    ambiguity: detection.ambiguity,
    top1Correct,
    top3Correct,
    difficulty: sample.difficulty,
    tags: sample.tags,
  });
}

// Aggregate metrics
const total = results.length;
const top1Correct = results.filter((r) => r.top1Correct).length;
const top3Correct = results.filter((r) => r.top3Correct).length;
const top1Accuracy = total > 0 ? top1Correct / total : 0;
const top3Accuracy = total > 0 ? top3Correct / total : 0;
const avgConfidence = confidenceCount > 0 ? totalConfidence / confidenceCount : 0;

// Per-dialect breakdown
const byDialect = {};
for (const r of results) {
  const d = r.expectedDialect;
  if (!byDialect[d]) {
    byDialect[d] = { total: 0, top1Correct: 0, top3Correct: 0 };
  }
  byDialect[d].total++;
  if (r.top1Correct) byDialect[d].top1Correct++;
  if (r.top3Correct) byDialect[d].top3Correct++;
}

for (const d of Object.keys(byDialect)) {
  const b = byDialect[d];
  b.top1Accuracy = b.total > 0 ? b.top1Correct / b.total : 0;
  b.top3Accuracy = b.total > 0 ? b.top3Correct / b.total : 0;
}

// Per-difficulty breakdown
const byDifficulty = {};
for (const r of results) {
  const diff = r.difficulty;
  if (!byDifficulty[diff]) {
    byDifficulty[diff] = { total: 0, top1Correct: 0, top3Correct: 0 };
  }
  byDifficulty[diff].total++;
  if (r.top1Correct) byDifficulty[diff].top1Correct++;
  if (r.top3Correct) byDifficulty[diff].top3Correct++;
}

for (const diff of Object.keys(byDifficulty)) {
  const b = byDifficulty[diff];
  b.top1Accuracy = b.total > 0 ? b.top1Correct / b.total : 0;
  b.top3Accuracy = b.total > 0 ? b.top3Correct / b.total : 0;
}

// Confusion matrix: expected → predicted counts
const confusionMatrix = {};
for (const r of results) {
  const expected = r.expectedDialect;
  const predicted = r.predictedDialect;
  if (!confusionMatrix[expected]) confusionMatrix[expected] = {};
  confusionMatrix[expected][predicted] =
    (confusionMatrix[expected][predicted] || 0) + 1;
}

// Hardest dialects (lowest top-1 accuracy)
const hardestDialects = Object.entries(byDialect)
  .sort((a, b) => a[1].top1Accuracy - b[1].top1Accuracy)
  .slice(0, 5)
  .map(([code, stats]) => ({ code, ...stats }));

const report = {
  generatedAt: new Date().toISOString(),
  corpusPath,
  total,
  top1Correct,
  top3Correct,
  top1Accuracy,
  top3Accuracy,
  avgConfidence,
  byDialect,
  byDifficulty,
  confusionMatrix,
  hardestDialects,
  results,
};

mkdirSync(outDir, { recursive: true });
const jsonPath = join(outDir, "report.json");
writeFileSync(jsonPath, `${JSON.stringify(report, null, 2)}\n`);

// Markdown summary
const mdLines = [
  `# Dialect Detection Benchmark Report`,
  ``,
  `- **Date**: ${report.generatedAt}`,
  `- **Corpus**: ${corpusPath}`,
  `- **Total samples**: ${total}`,
  `- **Top-1 correct**: ${top1Correct}`,
  `- **Top-3 correct**: ${top3Correct}`,
  `- **Top-1 accuracy**: ${(top1Accuracy * 100).toFixed(1)}%`,
  `- **Top-3 accuracy**: ${(top3Accuracy * 100).toFixed(1)}%`,
  `- **Avg confidence**: ${(avgConfidence * 100).toFixed(1)}%`,
  ``,
  `## By Difficulty`,
  ``,
  `| Difficulty | Top-1 Acc | Top-3 Acc | Total |`,
  `|------------|-----------|-----------|-------|`,
];
for (const [diff, data] of Object.entries(byDifficulty)) {
  mdLines.push(
    `| ${diff} | ${(data.top1Accuracy * 100).toFixed(1)}% | ${(data.top3Accuracy * 100).toFixed(1)}% | ${data.total} |`
  );
}

mdLines.push(
  ``,
  `## By Dialect`,
  ``,
  `| Dialect | Top-1 Acc | Top-3 Acc | Total |`,
  `|---------|-----------|-----------|-------|`
);
for (const [d, data] of Object.entries(byDialect).sort()) {
  mdLines.push(
    `| ${d} | ${(data.top1Accuracy * 100).toFixed(1)}% | ${(data.top3Accuracy * 100).toFixed(1)}% | ${data.total} |`
  );
}

mdLines.push(
  ``,
  `## Hardest Dialects`,
  ``,
  `| Dialect | Top-1 Acc | Total |`,
  `|---------|-----------|-------|`
);
for (const d of hardestDialects) {
  mdLines.push(
    `| ${d.code} | ${(d.top1Accuracy * 100).toFixed(1)}% | ${d.total} |`
  );
}

mdLines.push(
  ``,
  `## Confusion Matrix (expected → predicted)`,
  ``
);

const allDialects = Object.keys(byDialect).sort();
mdLines.push(`| Expected \\ Predicted | ${allDialects.join(" | ")} |`);
mdLines.push(`|${allDialects.map(() => "------").join("|")}|------|`);
for (const expected of allDialects) {
  const row = allDialects.map((predicted) => {
    const count = confusionMatrix[expected]?.[predicted] || 0;
    return count > 0 ? `**${count}**` : "0";
  });
  mdLines.push(`| ${expected} | ${row.join(" | ")} |`);
}

mdLines.push(``, `## Misclassifications`, ``);
for (const r of results.filter((r) => !r.top1Correct)) {
  mdLines.push(`- **${r.expectedDialect}** → **${r.predictedDialect}** (${r.difficulty})`);
  mdLines.push(`  - Text: "${r.text}"`);
  if (r.ambiguity) {
    mdLines.push(`  - Ambiguity: ${r.ambiguity}`);
  }
  mdLines.push(`  - Matched: ${r.matchedKeywords.join(", ") || "none"}`);
  mdLines.push("");
}

const mdPath = join(outDir, "report.md");
writeFileSync(mdPath, mdLines.join("\n") + "\n");

console.log(
  JSON.stringify(
    {
      outDir,
      jsonPath,
      mdPath,
      total,
      top1Correct,
      top3Correct,
      top1Accuracy: `${(top1Accuracy * 100).toFixed(1)}%`,
      top3Accuracy: `${(top3Accuracy * 100).toFixed(1)}%`,
      avgConfidence: `${(avgConfidence * 100).toFixed(1)}%`,
      hardestDialects: hardestDialects.map((d) => d.code),
    },
    null,
    2
  )
);

if (top1Accuracy < 0.5) {
  console.error(`\nERROR: Top-1 accuracy ${(top1Accuracy * 100).toFixed(1)}% is below 50% threshold.`);
  process.exit(1);
}
