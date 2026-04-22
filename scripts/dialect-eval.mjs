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

const VOSEO_DIALECTS = new Set(["es-AR", "es-UY", "es-PY", "es-GT", "es-HN", "es-SV", "es-NI"]);
const VOSOTROS_DIALECTS = new Set(["es-ES", "es-AD"]);
const GUAGUA_BUS_DIALECTS = new Set(["es-CU", "es-DO", "es-PR"]);

const { buildLexicalAmbiguityExpectations } = await import(
  pathToFileURL(`${process.cwd()}/packages/cli/dist/lib/lexical-ambiguity.js`).href
);
const { judgeTranslationOutput } = await import(
  pathToFileURL(`${process.cwd()}/packages/cli/dist/lib/output-judge.js`).href
);

function mockTranslate(source, dialect, sample = {}) {
  const formalSupport = sample.register === "formal" && /\b(password|support|payment)\b/i.test(source);

  return source
    .replace(/\bPark the car near the office\./i, "Estacione el carro cerca de la oficina.")
    .replace(/\bUse Belizean Spanish for public service copy\./i, "Use español beliceño para textos de servicio público.")
    .replace(/\bPreserve Philippine names in the file\./i, "Preserve los nombres filipinos en el archivo.")
    .replace(/\bUse yam in the recipe\./i, dialect === "es-GQ" ? "Use ñame en la receta." : "Use yam en la receta.")
    .replace(/\bBuy hot sauce for lunch\./i, dialect === "es-BO" ? "Compre llajwa para el almuerzo." : "Compre salsa picante para el almuerzo.")
    .replace(/\bBuy avocado for lunch\./i, dialect === "es-CL" ? "Compra palta para el almuerzo." : "Compra aguacate para el almuerzo.")
    .replace(/\bOrange juice is ready\./i, ["es-PR", "es-DO"].includes(dialect) ? "El jugo de china está listo." : "El jugo de naranja está listo.")
    .replace(/\bJugo de china is on the Puerto Rican menu\./i, dialect === "es-MX" ? "El jugo de naranja está en el menú puertorriqueño." : "El jugo de china está en el menú puertorriqueño.")
    .replace(/\bThe baby is sleeping\./i, dialect === "es-CL" ? "La guagua está durmiendo." : "El bebé está durmiendo.")
    .replace(/\bUse the computer to open the file\./i, ["es-CO", "es-EC"].includes(dialect) ? "Usa el computador para abrir el archivo." : "Usa la computadora para abrir el archivo.")
    .replace(/\b(Catch|Ride|Get on)\b/i, "Toma")
    .replace(/\bTake\b/i, "Toma")
    .replace(/\bbus\b/i, GUAGUA_BUS_DIALECTS.has(dialect) ? "guagua" : "bus")
    .replace(/\boffice\b/i, "oficina")
    .replace(/\bpassword\b/i, "contraseña")
    .replace(/\baccount settings\b/i, "configuración de la cuenta")
    .replace(/\bPlease update your contraseña before continuing\./i, formalSupport ? "Por favor, actualice su contraseña antes de continuar." : "Actualiza tu contraseña antes de continuar.")
    .replace(/\bContact support\b/i, formalSupport ? "Comuníquese con soporte" : "Contacta a soporte")
    .replace(/\bpayment fails\b/i, "pago falla")
    .replace(/\bPick up the room before guests arrive\./i, dialect === "es-PR" ? "Recoge el cuarto antes de que lleguen los invitados." : "Ordena la habitación antes de que lleguen los invitados.")
    .replace(/\bPick up\b/i, "Recoge")
    .replace(/\bpackage\b/i, "paquete")
    .replace(/\breception\b/i, "recepción")
    .replace(/\bfile\b/i, "archivo")
    .replace(/\bdeployment\b/i, "despliegue")
    .replace(/\bYou can update\b/i, VOSEO_DIALECTS.has(dialect) ? "Vos podés actualizar" : "Puedes actualizar")
    .replace(/\byour account now\b/i, "tu cuenta ahora")
    .replace(/\bYou can all update\b/i, VOSOTROS_DIALECTS.has(dialect) ? "Vosotros podéis actualizar" : "Ustedes pueden actualizar")
    .replace(/\byour passwords now\b/i, "vuestras contraseñas ahora");
}

async function createLiveTranslate() {
  const { createProviderRegistry } = await import(pathToFileURL(`${process.cwd()}/packages/cli/dist/lib/provider-factory.js`).href);
  const { buildSemanticTranslationContext } = await import(pathToFileURL(`${process.cwd()}/packages/cli/dist/lib/semantic-context.js`).href);
  const registry = createProviderRegistry();
  const available = registry.listProviders();
  if (available.length === 0) {
    throw new Error("No live providers are configured. Set LLM_API_URL + LLM_MODEL, DEEPL_AUTH_KEY, LIBRETRANSLATE_URL, or ENABLE_MYMEMORY=1.");
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
  return new RegExp(`(^|[^\\p{L}\\p{N}_])${escaped}(?=$|[^\\p{L}\\p{N}_])`, "iu").test(output);
}

async function evaluate(sample, dialect, translate) {
  const failures = [];
  const warnings = [];
  const qualityWarnings = [];
  let output = "";

  try {
    output = await translate(sample, dialect);
  } catch (error) {
    failures.push(`Provider error: ${error instanceof Error ? error.message : String(error)}`);
  }

  const lexicalExpectations = buildLexicalAmbiguityExpectations(sample.source, dialect);

  for (const term of [...(sample.forbiddenOutputTerms || []), ...lexicalExpectations.forbiddenOutputTerms]) {
    if (output && hasForbiddenTerm(output, term)) {
      failures.push(`Forbidden output term present: ${term}`);
    }
  }

  if (output && sample.requiredOutputAny?.length) {
    const matched = sample.requiredOutputAny.some((term) => hasForbiddenTerm(output, term));
    if (!matched) {
      failures.push(`Missing required output trait; expected one of: ${sample.requiredOutputAny.join(", ")}`);
    }
  }

  const requiredOutputGroups = [
    ...(sample.requiredOutputGroups || []),
    ...lexicalExpectations.requiredOutputGroups,
  ];
  if (output && requiredOutputGroups.length) {
    for (const group of requiredOutputGroups) {
      const matched = group.some((term) => hasForbiddenTerm(output, term));
      if (!matched) {
        failures.push(`Missing required output group; expected one of: ${group.join(", ")}`);
      }
    }
  }

  if (output && sample.preferredOutputAny?.length) {
    const matched = sample.preferredOutputAny.some((term) => hasForbiddenTerm(output, term));
    if (!matched) {
      qualityWarnings.push(`Missing preferred dialect trait; expected one of: ${sample.preferredOutputAny.join(", ")}`);
    }
  }

  if (output && judgeEnabled) {
    const judge = judgeTranslationOutput({
      ...sample,
      requiredOutputGroups,
      forbiddenOutputTerms: [
        ...(sample.forbiddenOutputTerms || []),
        ...lexicalExpectations.forbiddenOutputTerms,
      ],
    }, dialect, output);
    for (const issue of judge.blockingIssues) {
      failures.push(`Judge ${issue.category}/${issue.severity}: ${issue.message}`);
    }
    for (const issue of judge.issues.filter((item) => !judge.blockingIssues.includes(item))) {
      qualityWarnings.push(`Judge ${issue.category}/${issue.severity}: ${issue.message}`);
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
    qualityWarnings,
  };
}

const translate = live
  ? await createLiveTranslate()
  : async (sample, dialect) => mockTranslate(sample.source, dialect, sample);

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
  warnings: results.reduce((count, result) => count + result.qualityWarnings.length + result.warnings.length, 0),
  results,
};

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "results.json"), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify({ outDir, total: summary.total, passed: summary.passed, failed: summary.failed, warnings: summary.warnings, live }, null, 2));

if (summary.failed > 0 || (failOnWarnings && summary.warnings > 0)) {
  process.exit(1);
}
