#!/usr/bin/env node
/**
 * Real benchmark: tests the actual DialectOS provider pipeline end-to-end.
 * Unlike the old raw-API benchmark, this uses the full provider with all
 * post-processors (lexical substitution, voseo adapter, article gender fix, etc.)
 */

import { ensurePackageBuilt } from "./lib/ensure-built.mjs";
ensurePackageBuilt("providers");

const { LLMProvider } = await import(
  new URL("../packages/providers/dist/index.js", import.meta.url).href
);

const API_URL = process.env.LLM_API_URL || "http://100.66.225.85:1234/v1/chat/completions";

// Representative models per tier
const MODEL_TIERS = {
  tiny: [
    "google_gemma-3-270m-it",
    "smollm2-360m-instruct",
    "lfm2-350m",
    "lfm2.5-350m",
  ],
  small: [
    "qwen3-0.6b",
    "qwen3.5-0.8b",
    "lfm2.5-1.2b-instruct",
    "gemma-4-e2b-it",
  ],
  medium: [
    "qwen3.5-2b",
    "qwen3.5-4b",
    "lfm2-8b-a1b",
  ],
  large: [
    "qwen3.5-9b",
    "qwen3.6-27b",
    "qwen3-coder-next-reap-40b-a3b-i1",
  ],
};

const TESTS = [
  // ── Core vocabulary: car ──
  { text: "I parked the car near the office.", dialect: "es-MX", checks: ["estacioné", "carro"], desc: "parking + car (MX)" },
  { text: "I parked the car near the office.", dialect: "es-AR", checks: ["estacioné", "auto"], desc: "parking + car (AR)" },
  { text: "I parked the car near the office.", dialect: "es-ES", checks: ["estacioné", "coche"], desc: "parking + car (ES)" },

  // ── Core vocabulary: bus ──
  { text: "I need a bus ticket.", dialect: "es-CU", checks: ["guagua"], desc: "bus (CU)" },
  { text: "I need a bus ticket.", dialect: "es-MX", checks: ["camión"], desc: "bus (MX)" },
  { text: "I need a bus ticket.", dialect: "es-AR", checks: ["colectivo"], desc: "bus (AR)" },
  { text: "I need a bus ticket.", dialect: "es-ES", checks: ["autobús"], desc: "bus (ES)" },
  { text: "I need a bus ticket.", dialect: "es-CL", checks: ["micro"], desc: "bus (CL)" },
  { text: "The kids took the bus to school.", dialect: "es-CU", checks: ["guagua"], desc: "bus complex (CU)" },
  { text: "The kids took the bus to school.", dialect: "es-MX", checks: ["camión"], desc: "bus complex (MX)" },

  // ── Core vocabulary: baby ──
  { text: "The baby is sleeping.", dialect: "es-CU", checks: ["bebé"], desc: "baby (CU)" },
  { text: "The baby is sleeping.", dialect: "es-AR", checks: ["bebé", "niño"], desc: "baby (AR)" },
  { text: "The baby is sleeping.", dialect: "es-MX", checks: ["bebé", "niño"], desc: "baby (MX)" },

  // ── Core vocabulary: elevator ──
  { text: "I took the elevator to the 5th floor.", dialect: "es-MX", checks: ["elevador"], desc: "elevator (MX)" },
  { text: "I took the elevator to the 5th floor.", dialect: "es-ES", checks: ["ascensor"], desc: "elevator (ES)" },
  { text: "I took the elevator to the 5th floor.", dialect: "es-AR", checks: ["ascensor"], desc: "elevator (AR)" },
  { text: "I took the elevator to the 5th floor.", dialect: "es-CU", checks: ["elevador"], desc: "elevator (CU)" },

  // ── Core vocabulary: pickup truck ──
  { text: "The pickup truck is broken.", dialect: "es-MX", checks: ["camioneta"], desc: "pickup (MX)" },
  { text: "The pickup truck is broken.", dialect: "es-AR", checks: ["camioneta"], desc: "pickup (AR)" },
  { text: "The pickup truck is broken.", dialect: "es-ES", checks: ["camioneta", "furgoneta"], desc: "pickup (ES)" },

  // ── Core vocabulary: strawberry ──
  { text: "The strawberry is red.", dialect: "es-AR", checks: ["frutilla"], desc: "strawberry (AR)" },
  { text: "The strawberry is red.", dialect: "es-MX", checks: ["fresa"], desc: "strawberry (MX)" },
  { text: "The strawberry is red.", dialect: "es-ES", checks: ["fresa"], desc: "strawberry (ES)" },
  { text: "A strawberry is sweet.", dialect: "es-AR", checks: ["frutilla"], desc: "strawberry article (AR)" },
  { text: "A strawberry is sweet.", dialect: "es-MX", checks: ["fresa"], desc: "strawberry article (MX)" },
  { text: "I love eating fresh strawberries.", dialect: "es-AR", checks: ["frutillas"], desc: "strawberries plural (AR)" },
  { text: "I love eating fresh strawberries.", dialect: "es-MX", checks: ["fresas"], desc: "strawberries plural (MX)" },

  // ── Core vocabulary: parking ──
  { text: "Can you tell me where the parking lot is?", dialect: "es-MX", checks: ["estacionamiento"], desc: "parking lot (MX)" },
  { text: "Can you tell me where the parking lot is?", dialect: "es-AR", checks: ["estacionamiento"], desc: "parking lot (AR)" },
  { text: "Can you tell me where the parking lot is?", dialect: "es-ES", checks: ["aparcamiento"], desc: "parking lot (ES)" },

  // ── Voseo (tú → vos) ──
  { text: "Do you want to eat?", dialect: "es-AR", checks: ["querés"], desc: "voseo eat (AR)" },
  { text: "Do you want to eat?", dialect: "es-UY", checks: ["querés"], desc: "voseo eat (UY)" },
  { text: "Do you want to eat?", dialect: "es-CU", checks: ["quieres"], desc: "tú eat (CU)" },
  { text: "Do you want to eat?", dialect: "es-MX", checks: ["quieres"], desc: "tú eat (MX)" },
  { text: "You do it well.", dialect: "es-AR", checks: ["hacés"], desc: "voseo do (AR)" },
  { text: "You do it well.", dialect: "es-UY", checks: ["hacés"], desc: "voseo do (UY)" },
  { text: "You do it well.", dialect: "es-CU", checks: ["haces"], desc: "tú do (CU)" },
  { text: "You have a nice house.", dialect: "es-AR", checks: ["tenés"], desc: "voseo have (AR)" },
  { text: "You have a nice house.", dialect: "es-MX", checks: ["tienes"], desc: "tú have (MX)" },
];

function isCompactModel(model) {
  if (process.env.LLM_COMPACT_PROMPT === "1") return true;
  if (process.env.LLM_COMPACT_PROMPT === "0") return false;
  const lower = model.toLowerCase();
  if (lower.includes("minimax")) return true;
  const effMatch = lower.match(/e(\d*\.?\d+)b/);
  if (effMatch && parseFloat(effMatch[1]) <= 8) return true;
  const paramMatch = lower.match(/(\d*\.?\d+)b/);
  if (paramMatch && parseFloat(paramMatch[1]) <= 8) return true;
  if (/\d+m\b/.test(lower)) return true;
  return false;
}

async function testModel(modelName) {
  const provider = new LLMProvider({
    endpoint: API_URL,
    model: modelName,
  });

  const results = [];
  let passed = 0;
  let failed = 0;
  let errors = 0;

  for (const test of TESTS) {
    try {
      const result = await provider.translate(test.text, "en", "es", {
        dialect: test.dialect,
        timeoutMs: 15000,
      });
      const output = result.translatedText.toLowerCase();
      const hit = test.checks.some(c => output.includes(c.toLowerCase()));
      if (hit) passed++; else failed++;
      results.push({ test, output: result.translatedText, hit });
    } catch (e) {
      errors++;
      results.push({ test, error: e.message, hit: false });
    }
  }

  return { model: modelName, compact: isCompactModel(modelName), passed, failed, errors, total: TESTS.length, results };
}

async function main() {
  // Allow filtering by model name via CLI arg: node real-benchmark.mjs --model=gemma-4-e2b-it
  const filterArg = process.argv.find(a => a.startsWith("--model="));
  const modelFilter = filterArg ? filterArg.slice(8) : null;

  let models = Object.values(MODEL_TIERS).flat();
  if (modelFilter) {
    models = models.filter(m => m.includes(modelFilter));
    if (models.length === 0) {
      console.log(`No models match filter: ${modelFilter}`);
      console.log(`Available: ${Object.values(MODEL_TIERS).flat().join(", ")}`);
      process.exit(1);
    }
  }
  console.log(`Benchmarking ${models.length} model(s) × ${TESTS.length} tests each`);
  console.log(`API: ${API_URL}`);
  console.log("");

  const allResults = [];
  for (const model of models) {
    process.stdout.write(`${model} ... `);
    const start = Date.now();
    try {
      const result = await testModel(model);
      const elapsed = ((Date.now() - start) / 1000).toFixed(1);
      const pct = ((result.passed / result.total) * 100).toFixed(0);
      console.log(`${result.passed}/${result.total} (${pct}%) compact=${result.compact} ${elapsed}s`);
      allResults.push(result);
    } catch (e) {
      console.log(`CRASH: ${e.message}`);
      allResults.push({ model, crash: e.message, passed: 0, failed: 0, errors: TESTS.length, total: TESTS.length });
    }
  }

  console.log("\n=== SUMMARY ===");
  for (const tier in MODEL_TIERS) {
    console.log(`\n${tier.toUpperCase()}:`);
    for (const model of MODEL_TIERS[tier]) {
      const r = allResults.find(x => x.model === model);
      if (!r) continue;
      const pct = ((r.passed / r.total) * 100).toFixed(0);
      console.log(`  ${model.padEnd(35)} ${String(r.passed).padStart(2)}/${r.total} (${pct}%)`);
    }
  }

  // Write detailed results
  const outPath = `benchmark_runs/${new Date().toISOString().slice(0, 10).replace(/-/g, "")}-real-benchmark.json`;
  await import("fs").then(fs => fs.promises.mkdir("benchmark_runs", { recursive: true }));
  await import("fs").then(fs => fs.promises.writeFile(outPath, JSON.stringify(allResults, null, 2)));
  console.log(`\nDetailed results: ${outPath}`);
}

main().catch(console.error);
