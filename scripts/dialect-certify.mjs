#!/usr/bin/env node
import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const args = new Map();
for (const arg of process.argv.slice(2)) {
  if (arg === "--") continue;
  const [key, value = ""] = arg.replace(/^--/, "").split("=");
  args.set(key, value || "true");
}

const fixtureDir = args.get("fixtures") || "packages/cli/src/__tests__/fixtures/dialect-eval";
const outDir = args.get("out") || `audits/dialect-certify-${new Date().toISOString().slice(0, 10)}`;
const providerName = args.get("provider") || "mock-semantic";
const live = args.get("live") === "true";
const failOnWarnings = args.get("fail-on-warnings") === "true";
const judgeEnabled = live || args.get("judge") === "true";
const sampleTimeoutMs = parsePositiveInt(args.get("sample-timeout-ms"), 300000);
const sampleRetries = parseNonNegativeInt(args.get("sample-retries"), 1);
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

function parsePositiveInt(value, fallback) {
  const parsed = parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function parseNonNegativeInt(value, fallback) {
  const parsed = parseInt(value || "", 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

function appendJsonl(path, value) {
  appendFileSync(path, `${JSON.stringify(value)}\n`);
}

function hasForbiddenTerm(output, term) {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}\\p{N}_])${escaped}(?=$|[^\\p{L}\\p{N}_])`, "iu").test(output);
}

function mockTranslate(source, dialect, sample = {}) {
  const formalSupport = sample.register === "formal" && /\b(password|support|payment)\b/i.test(source);

  return source
    .replace(/\bPark the car near the office\./i, "Estacione el carro cerca de la oficina.")
    .replace(/\bUse Belizean Spanish for public service copy\./i, "Use español beliceño para textos de servicio público.")
    .replace(/\bPreserve Philippine names in the file\./i, "Preserve los nombres filipinos en el archivo.")
    .replace(/\bDo not use slang in this customer support message\./i, "No use jerga en este mensaje de soporte al cliente.")
    .replace(/\bUse yam in the recipe\./i, dialect === "es-GQ" ? "Use ñame en la receta." : "Use yam en la receta.")
    .replace(/\bBuy hot sauce for lunch\./i, dialect === "es-BO" ? "Compre llajwa para el almuerzo." : "Compre salsa picante para el almuerzo.")
    .replace(/\bBuy avocado for lunch\./i, dialect === "es-CL" ? "Compra palta para el almuerzo." : "Compra aguacate para el almuerzo.")
    .replace(/\bUse the computer to open the file\./i, ["es-CO", "es-EC"].includes(dialect) ? "Usa el computador para abrir el archivo." : "Usa la computadora para abrir el archivo.")
    .replace(/\b(Catch|Ride|Get on)\b/i, "Toma")
    .replace(/\bTake\b/i, "Toma")
    .replace(/\bbus\b/i, GUAGUA_BUS_DIALECTS.has(dialect) ? "guagua" : "bus")
    .replace(/\boffice\b/i, "oficina")
    .replace(/\bpackage\b/i, "paquete")
    .replace(/\breception\b/i, "recepción")
    .replace(/\bpassword\b/i, "contraseña")
    .replace(/\baccount settings\b/i, "configuración de la cuenta")
    .replace(/\bPlease update your contraseña before continuing\./i, formalSupport ? "Por favor, actualice su contraseña antes de continuar." : "Actualiza tu contraseña antes de continuar.")
    .replace(/\bContact support\b/i, formalSupport ? "Comuníquese con soporte" : "Contacta a soporte")
    .replace(/\bpayment fails\b/i, "pago falla")
    .replace(/\bPick up the room before guests arrive\./i, dialect === "es-PR" ? "Recoge el cuarto antes de que lleguen los invitados." : "Ordena la habitación antes de que lleguen los invitados.")
    .replace(/\bPick up\b/i, "Recoge")
    .replace(/\bfiles\b/i, "archivos")
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
    const delayMs = parsePositiveInt(process.env.DIALECT_CERTIFY_TEST_DELAY_MS, 0);
    if (delayMs > 0) {
      await new Promise((resolveDelay) => setTimeout(resolveDelay, delayMs));
    }
    const result = await provider.translate(sample.source, "auto", "es", {
      dialect,
      formality: sample.register,
      context,
    });
    return result.translatedText;
  };
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
    category: sample.category,
    severity: sample.severity,
    tags: sample.tags || [],
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

async function runSampleMode() {
  const payload = JSON.parse(readFileSync(args.get("sample-file"), "utf-8"));
  maybeInjectOneTimeFailure(payload);
  const translate = live
    ? await createLiveTranslate()
    : async (sample, dialect) => mockTranslate(sample.source, dialect, sample);
  const result = await evaluate(payload.sample, payload.dialect, translate);
  process.stdout.write(`${JSON.stringify(result)}\n`);
}

function maybeInjectOneTimeFailure(payload) {
  const failDir = process.env.DIALECT_CERTIFY_TEST_FAIL_ONCE_DIR;
  if (!failDir) return;
  mkdirSync(failDir, { recursive: true });
  const marker = join(failDir, `${payload.dialect}-${payload.sample.id}.failed-once`);
  if (!existsSync(marker)) {
    writeFileSync(marker, "failed\n");
    throw new Error("Injected one-time certify failure");
  }
}

function summarize(results, startedAt) {
  return {
    generatedAt: new Date().toISOString(),
    startedAt,
    provider: live ? providerName : "mock-semantic",
    live,
    fixtureDir,
    total: results.length,
    passed: results.filter((r) => r.passes).length,
    failed: results.filter((r) => !r.passes).length,
    warnings: results.reduce((count, result) => count + result.qualityWarnings.length + result.warnings.length, 0),
    results,
  };
}

function loadSamples() {
  const samples = [];
  for (const file of readdirSync(fixtureDir).filter((name) => name.endsWith(".json")).sort()) {
    const dialect = basename(file, ".json");
    if (dialectFilter.size > 0 && !dialectFilter.has(dialect)) continue;
    const dialectSamples = JSON.parse(readFileSync(join(fixtureDir, file), "utf-8"));
    for (const sample of dialectSamples) {
      samples.push({ dialect, sample });
    }
  }
  return samples;
}

function resultFromChild(payload, child, elapsedMs) {
  if (child.error?.code === "ETIMEDOUT") {
    return {
      dialect: payload.dialect,
      fixture: payload.sample.id,
      provider: live ? providerName : "mock-semantic",
      live,
      source: payload.sample.source,
      output: "",
      passes: false,
      failures: [`Sample timed out after ${sampleTimeoutMs}ms`],
      warnings: [],
      qualityWarnings: [],
      elapsedMs,
    };
  }
  if (child.status !== 0) {
    return {
      dialect: payload.dialect,
      fixture: payload.sample.id,
      provider: live ? providerName : "mock-semantic",
      live,
      source: payload.sample.source,
      output: "",
      passes: false,
      failures: [`Sample process failed with status ${child.status}: ${(child.stderr || "").toString().trim()}`],
      warnings: [],
      qualityWarnings: [],
      elapsedMs,
    };
  }
  try {
    return {
      ...JSON.parse((child.stdout || "").toString().trim().split("\n").at(-1)),
      elapsedMs,
    };
  } catch (error) {
    return {
      dialect: payload.dialect,
      fixture: payload.sample.id,
      provider: live ? providerName : "mock-semantic",
      live,
      source: payload.sample.source,
      output: "",
      passes: false,
      failures: [`Could not parse sample output: ${error instanceof Error ? error.message : String(error)}`],
      warnings: [],
      qualityWarnings: [],
      elapsedMs,
    };
  }
}

function shouldRetry(result) {
  if (result.passes) return false;
  return result.failures.some((failure) =>
    /Provider error|Internal Server Error|timed out|process failed|Could not parse sample output/i.test(failure)
  );
}

async function runParentMode() {
  const startedAt = new Date().toISOString();
  const samples = loadSamples();
  const results = [];
  const absoluteOutDir = resolve(outDir);
  const tmpDir = join(absoluteOutDir, ".tmp");
  const eventsPath = join(absoluteOutDir, "events.jsonl");
  const progressPath = join(absoluteOutDir, "progress.json");
  const resultsPath = join(absoluteOutDir, "results.json");

  rmSync(tmpDir, { recursive: true, force: true });
  mkdirSync(tmpDir, { recursive: true });
  mkdirSync(absoluteOutDir, { recursive: true });
  writeFileSync(eventsPath, "");

  for (const [index, payload] of samples.entries()) {
    let progressBase = {
      generatedAt: new Date().toISOString(),
      startedAt,
      total: samples.length,
      completed: results.length,
      current: { index: index + 1, dialect: payload.dialect, fixture: payload.sample.id },
      provider: live ? providerName : "mock-semantic",
      live,
    };
    writeJson(progressPath, progressBase);

    let result;
    for (let attempt = 1; attempt <= sampleRetries + 1; attempt++) {
      appendJsonl(eventsPath, { event: "sample_started", attempt, maxAttempts: sampleRetries + 1, ...progressBase });

      const sampleFile = join(tmpDir, `${index + 1}-${payload.dialect}-${payload.sample.id}-attempt-${attempt}.json`);
      writeJson(sampleFile, payload);
      const childArgs = [
        new URL(import.meta.url).pathname,
        "--run-sample",
        `--sample-file=${sampleFile}`,
        `--provider=${providerName}`,
        ...(judgeEnabled ? ["--judge=true"] : []),
      ];
      if (live) childArgs.push("--live");
      const started = Date.now();
      const child = spawnSync(process.execPath, childArgs, {
        cwd: process.cwd(),
        env: process.env,
        encoding: "utf-8",
        timeout: sampleTimeoutMs,
        killSignal: "SIGKILL",
        maxBuffer: 10 * 1024 * 1024,
      });
      result = {
        ...resultFromChild(payload, child, Date.now() - started),
        attempts: attempt,
      };
      if (!shouldRetry(result) || attempt > sampleRetries) break;
      appendJsonl(eventsPath, {
        event: "sample_retrying",
        generatedAt: new Date().toISOString(),
        index: index + 1,
        total: samples.length,
        attempt,
        maxAttempts: sampleRetries + 1,
        result,
      });
    }

    results.push(result);
    const summary = summarize(results, startedAt);
    writeJson(resultsPath, summary);
    writeJson(progressPath, {
      ...progressBase,
      generatedAt: new Date().toISOString(),
      completed: results.length,
      passed: summary.passed,
      failed: summary.failed,
      warnings: summary.warnings,
      lastResult: result,
    });
    appendJsonl(eventsPath, {
      event: "sample_completed",
      generatedAt: new Date().toISOString(),
      index: index + 1,
      total: samples.length,
      result,
      passed: summary.passed,
      failed: summary.failed,
      warnings: summary.warnings,
    });
    console.log(JSON.stringify({
      completed: index + 1,
      total: samples.length,
      dialect: result.dialect,
      fixture: result.fixture,
      passes: result.passes,
      elapsedMs: result.elapsedMs,
    }));
  }

  const finalSummary = summarize(results, startedAt);
  console.log(JSON.stringify({ outDir: absoluteOutDir, total: finalSummary.total, passed: finalSummary.passed, failed: finalSummary.failed, warnings: finalSummary.warnings, live }, null, 2));
  if (finalSummary.failed > 0 || (failOnWarnings && finalSummary.warnings > 0)) {
    process.exit(1);
  }
}

if (args.has("run-sample")) {
  await runSampleMode();
} else {
  await runParentMode();
}
