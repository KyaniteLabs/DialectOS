#!/usr/bin/env node
/**
 * Floor benchmark — "tiny dumb model + DialectOS ≈ frontier alone".
 *
 * CEO reframe (2026-09-19): DialectOS's value is measured on the TINIEST,
 * DUMBEST, OLDEST LLMs, not on frontier models. This benchmark runs the
 * repo's dialect-eval fixtures through each floor seat twice:
 *
 *   arm A ("solo")    : same LLMProvider, same prompts, same response
 *                       extraction — but a DialectOutputPipeline with ZERO
 *                       steps (no deterministic post-processing).
 *   arm B ("dialectos"): the stock provider with the default pipeline
 *                       (sentinel extraction, lexical substitution, voseo,
 *                       agreement, punctuation, accentuation, capitalization,
 *                       typography, sentinel restore).
 *
 * The ONLY difference between arms is the deterministic post-processing —
 * prompts, model, endpoint, extraction are identical. Winner metrics come
 * from the repo's own eval harness (evaluateSample) plus agreement-warning
 * counts from validateAgreement on the raw outputs.
 *
 * Usage:
 *   node scripts/bench-floor.mjs [--seat=cpm2b] [--seat=crack] ...
 * Seats are defined in SEATS below (floor endpoints via local tunnels).
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { performance } from "node:perf_hooks";

const repoRoot = new URL("..", import.meta.url).pathname;
const providers = await import(join(repoRoot, "packages/providers/dist/index.js"));
const cliHarness = await import(join(repoRoot, "packages/cli/dist/lib/eval-harness.js"));
const semanticContext = await import(join(repoRoot, "packages/cli/dist/lib/semantic-context.js"));

const { LLMProvider, DialectOutputPipeline } = providers;
const { loadFixtures, evaluateSample, buildSummary } = cliHarness;
const { buildSemanticTranslationContext } = semanticContext;

// ── Floor seats (names are the exact service identities; see bench report) ──
const SEATS = {
  cpm2b:  { label: "MiniCPM5-2B (floor-t1-minicpm5)",        port: 16498, model: "floor-t1-minicpm5",        compact: "1", tier: "tiny"  },
  vl3b:   { label: "LFM2.5-VL-3B (floor-t0-vl3b)",           port: 16497, model: "floor-t0-vl3b",           compact: "1", tier: "tiny"  },
  crack:  { label: "35B MoE local (CRACK-Ornith, seat moe35u)", port: 16399, model: "CRACK-Ornith-Uncensored", compact: "0", tier: "medium" },
  prod27: { label: "Qwen3.8-27B (prod27 champion)",          port: 16377, model: "Qwen3.8-27B",             compact: "0", tier: "upper-local" },
};

const requested = process.argv.filter((a) => a.startsWith("--seat=")).map((a) => a.slice(7));
const seatNames = requested.length > 0 ? requested : ["cpm2b", "vl3b", "crack", "prod27"];

const fixtureDir = join(repoRoot, "packages/cli/src/__tests__/fixtures/dialect-eval");
const outDir = join(repoRoot, "audits", `bench-floor-${new Date().toISOString().slice(0, 10)}`);
mkdirSync(outDir, { recursive: true });

function makeProvider(seat, withPipeline) {
  return new LLMProvider({
    endpoint: `http://127.0.0.1:${seat.port}/v1/chat/completions`,
    model: seat.model,
    allowLocal: true,
    apiFormat: "openai",
    pipeline: withPipeline ? DialectOutputPipeline.createDefault() : new DialectOutputPipeline([]),
  });
}

function agreementWarnings(text) {
  try {
    const r = providers.validateAgreement(text);
    return r.warnings.length;
  } catch {
    return 0;
  }
}

const allRuns = [];

for (const seatName of seatNames) {
  const seat = SEATS[seatName];
  if (!seat) throw new Error(`unknown seat ${seatName}`);

  // Prompt tier is decided per seat via the same env the provider reads.
  process.env.LLM_COMPACT_PROMPT = seat.compact;

  for (const arm of ["solo", "dialectos"]) {
    const provider = makeProvider(seat, arm === "dialectos");

    const latencies = [];
    const outputs = [];
    const results = [];
    const fixtureData = loadFixtures(fixtureDir, new Set());
    for (const { dialect, samples } of fixtureData) {
      for (const sample of samples) {
        const evalTranslate = async (s, d) => {
          const t0 = performance.now();
          const result = await provider.translate(s.source, "auto", "es", {
            dialect: d,
            formality: s.register,
            context: buildSemanticTranslationContext({
              text: s.source,
              dialect: d,
              formality: s.register,
              documentKind: s.documentKind,
            }),
          });
          latencies.push(Math.round(performance.now() - t0));
          return result.translatedText;
        };
        const result = await evaluateSample(sample, dialect, evalTranslate, {
          providerName: `${seatName}/${arm}`,
          live: true,
          judgeEnabled: false,
          warnOnMissingMetadata: true,
        });
        results.push(result);
        outputs.push({
          id: sample.id,
          dialect,
          text: result.output,
          agreementWarnings: agreementWarnings(result.output),
        });
      }
    }

    const summary = buildSummary(results, { fixtureDir, providerName: `${seatName}/${arm}`, live: true });
    const agreeTotal = outputs.reduce((a, o) => a + o.agreementWarnings, 0);
    const run = {
      seat: seatName,
      seatLabel: seat.label,
      model: seat.model,
      arm,
      harness: { total: summary.total, passed: summary.passed, failed: summary.failed, warnings: summary.warnings },
      agreementWarningsTotal: agreeTotal,
      latency: {
        meanMs: Math.round(latencies.reduce((a, b) => a + b, 0) / Math.max(1, latencies.length)),
        p95Ms: Math.round(latencies.slice().sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)] ?? 0),
      },
      outputs,
    };
    allRuns.push(run);
    console.log(`[${seatName}/${arm}] passed ${summary.passed}/${summary.total} failed ${summary.failed} warn ${summary.warnings} agree-warn ${agreeTotal} mean ${run.latency.meanMs}ms`);
    if (summary.failed === summary.total && summary.total > 0) {
      const firstFailure = results.find((r) => r.failures?.length > 0);
      console.error(`  ALL FAILED — first failure: ${firstFailure?.failures?.[0] ?? "unknown"}`);
    }
    writeFileSync(join(outDir, `${seatName}-${arm}.json`), JSON.stringify(run, null, 2) + "\n");
  }
}

writeFileSync(join(outDir, "all-runs.json"), JSON.stringify(allRuns, null, 2) + "\n");

// Markdown table
const rows = allRuns.map((r) =>
  `| ${r.seatLabel} | ${r.arm === "solo" ? "solo" : "**+ DialectOS**"} | ${r.harness.passed}/${r.harness.total} | ${r.harness.failed} | ${r.agreementWarningsTotal} | ${r.latency.meanMs} ms |`
);
const md = `# Floor benchmark — tiny models + DialectOS (${new Date().toISOString().slice(0, 10)})

Arms differ ONLY in the deterministic post-processing pipeline (same model, prompts, extraction).

| Seat | Arm | Harness passed | Harness failed | Agreement warnings (total) | Mean latency |
|---|---|---|---|---|---|
${rows.join("\n")}
`;
writeFileSync(join(outDir, "TABLE.md"), md);
console.log(`\nWrote ${join(outDir, "TABLE.md")}`);
