#!/usr/bin/env node
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

const args = new Map();
for (const arg of process.argv.slice(2)) {
  const [key, value = ""] = arg.replace(/^--/, "").split("=");
  args.set(key, value || "true");
}

const fixtureDir = args.get("fixtures") || "packages/cli/src/__tests__/fixtures/dialect-eval";
const outDir = args.get("out") || `audits/dialect-eval-${new Date().toISOString().slice(0, 10)}`;
const provider = args.get("provider") || "mock-semantic";
const dialectFilter = new Set((args.get("dialects") || "").split(",").map((d) => d.trim()).filter(Boolean));

function mockTranslate(source, dialect) {
  const safe = source
    .replace(/\bTake\b/i, dialect === "es-PR" ? "Toma" : "Toma")
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
  return safe;
}

function evaluate(sample, dialect) {
  const output = mockTranslate(sample.source, dialect);
  const failures = [];
  const warnings = [];

  for (const term of sample.forbiddenOutputTerms || []) {
    const re = new RegExp(`\\b${term.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}\\b`, "i");
    if (re.test(output)) {
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
    provider,
    source: sample.source,
    output,
    passes: failures.length === 0,
    failures,
    warnings,
  };
}

const results = [];
for (const file of readdirSync(fixtureDir).filter((name) => name.endsWith(".json")).sort()) {
  const dialect = basename(file, ".json");
  if (dialectFilter.size > 0 && !dialectFilter.has(dialect)) continue;
  const samples = JSON.parse(readFileSync(join(fixtureDir, file), "utf-8"));
  for (const sample of samples) {
    results.push(evaluate(sample, dialect));
  }
}

const summary = {
  generatedAt: new Date().toISOString(),
  provider,
  fixtureDir,
  total: results.length,
  passed: results.filter((r) => r.passes).length,
  failed: results.filter((r) => !r.passes).length,
  results,
};

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "results.json"), `${JSON.stringify(summary, null, 2)}\n`);
console.log(JSON.stringify({ outDir, total: summary.total, passed: summary.passed, failed: summary.failed }, null, 2));

if (summary.failed > 0) {
  process.exit(1);
}
