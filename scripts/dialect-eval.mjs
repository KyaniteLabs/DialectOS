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
const dialectFilter = new Set((args.get("dialects") || "").split(",").map((d) => d.trim()).filter(Boolean));

function mockTranslate(source, dialect) {
  return source
    .replace(/\bTake\b/i, "Toma")
    .replace(/\bbus\b/i, dialect === "es-PR" ? "guagua" : "bus")
    .replace(/\boffice\b/i, "oficina")
    .replace(/\bpassword\b/i, "contraseña")
    .replace(/\baccount settings\b/i, "configuración de la cuenta")
    .replace(/\bContact support\b/i, "Contacta a soporte")
    .replace(/\bpayment fails\b/i, "pago falla")
    .replace(/\bPick up\b/i, "Recoge")
    .replace(/\bfile\b/i, "archivo")
    .replace(/\bdeployment\b/i, "despliegue")
    .replace(/\bYou can update\b/i, dialect === "es-AR" ? "Vos podés actualizar" : "Puedes actualizar")
    .replace(/\byour account now\b/i, "tu cuenta ahora")
    .replace(/\bYou can all update\b/i, dialect === "es-ES" ? "Vosotros podéis actualizar" : "Ustedes pueden actualizar")
    .replace(/\byour passwords now\b/i, "vuestras contraseñas ahora");
}

async function createLiveTranslate() {
  const { createProviderRegistry } = await import(pathToFileURL(`${process.cwd()}/packages/cli/dist/lib/provider-factory.js`).href);
  const { buildSemanticTranslationContext } = await import(pathToFileURL(`${process.cwd()}/packages/cli/dist/lib/semantic-context.js`).href);
  const registry = createProviderRegistry();
  const available = registry.listProviders();
  if (available.length === 0) {
    throw new Error("No live providers are configured. Set DEEPL_AUTH_KEY, LIBRETRANSLATE_URL, or ENABLE_MYMEMORY=1.");
  }

  return async (sample, dialect) => {
    const provider = providerName === "auto" || providerName === "mock-semantic"
      ? registry.getAuto()
      : registry.get(providerName);
    const context = buildSemanticTranslationContext({
      text: sample.source,
      dialect,
      formality: sample.register,
      documentKind: sample.documentKind,
    });
    const result = await provider.translate(sample.source, "auto", "es", {
      dialect,
      formality: sample.register,
      context,
    });
    return result.translatedText;
  };
}

function hasForbiddenTerm(output, term) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`\\b${escaped}\\b`, "i").test(output);
}

async function evaluate(sample, dialect, translate) {
  const failures = [];
  const warnings = [];
  let output = "";

  try {
    output = await translate(sample, dialect);
  } catch (error) {
    failures.push(`Provider error: ${error instanceof Error ? error.message : String(error)}`);
  }

  for (const term of sample.forbiddenOutputTerms || []) {
    if (output && hasForbiddenTerm(output, term)) {
      failures.push(`Forbidden output term present: ${term}`);
    }
  }

  if (!sample.requiredContext?.length) {
    warnings.push("No requiredContext assertions recorded");
  }
  if (!sample.notes || sample.notes.length < 10) {
    warnings.push("Fixture lacks useful notes");
  }

  return {
    dialect,
    fixture: sample.id,
    provider: live ? providerName : "mock-semantic",
    live,
    source: sample.source,
    output,
    passes: failures.length === 0,
    failures,
    warnings,
  };
}

const translate = live
  ? await createLiveTranslate()
  : async (sample, dialect) => mockTranslate(sample.source, dialect);

const results = [];
for (const file of readdirSync(fixtureDir).filter((name) => name.endsWith(".json")).sort()) {
  const dialect = basename(file, ".json");
  if (dialectFilter.size > 0 && !dialectFilter.has(dialect)) continue;
  const samples = JSON.parse(readFileSync(join(fixtureDir, file), "utf-8"));
  for (const sample of samples) {
    results.push(await evaluate(sample, dialect, translate));
  }
}

const summary = {
  generatedAt: new Date().toISOString(),
  provider: live ? providerName : "mock-semantic",
  live,
  fixtureDir,
  total: results.length,
  passed: results.filter((r) => r.passes).length,
  failed: results.filter((r) => !r.passes).length,
  results,
};

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "results.json"), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify({ outDir, total: summary.total, passed: summary.passed, failed: summary.failed, live }, null, 2));

if (summary.failed > 0) {
  process.exit(1);
}
