#!/usr/bin/env node
import { mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const args = new Map();
for (const arg of process.argv.slice(2)) {
  if (arg === "--") continue;
  const [key, value = ""] = arg.replace(/^--/, "").split("=");
  args.set(key, value || "true");
}

const fixtures = args.get("fixtures") || "packages/cli/src/__tests__/fixtures/document-adversarial";
const outDir = resolve(args.get("out") || `audits/document-certify-${new Date().toISOString().slice(0, 10)}`);
const provider = args.get("provider") || "mock-doc";
const live = args.get("live") === "true";
const dialects = (args.get("dialects") || "es-MX,es-PA,es-PR,es-AR,es-ES,es-CL,es-BO").split(",").map((x) => x.trim()).filter(Boolean);
const sampleTimeoutMs = parseInt(args.get("sample-timeout-ms") || "300000", 10);

function mockDocTranslate(text, dialect) {
  return text
    .replace(/Catch|Ride|Get on|Take/g, "Toma")
    .replace(/bus/g, ["es-PR", "es-CU", "es-DO"].includes(dialect) ? "guagua" : "bus")
    .replace(/office/g, "oficina")
    .replace(/support/g, "soporte")
    .replace(/payment fails/g, "pago falla")
    .replace(/Please update your password before continuing/g, "Por favor, actualice su contraseña antes de continuar")
    .replace(/You can update your account now/g, ["es-AR", "es-UY", "es-PY", "es-GT", "es-HN", "es-SV", "es-NI"].includes(dialect) ? "Podés actualizar tu cuenta ahora" : ["es-ES", "es-AD"].includes(dialect) ? "Podéis actualizar vuestra cuenta ahora" : "Puedes actualizar tu cuenta ahora")
    .replace(/Buy avocado/g, dialect === "es-CL" ? "Compra palta" : "Compra aguacate")
    .replace(/Buy hot sauce/g, dialect === "es-BO" ? "Compra llajwa" : "Compra salsa picante")
    .replace(/Use yam/g, dialect === "es-GQ" ? "Usa ñame" : "Usa yam")
    .replace(/Pick up/g, "Recoge")
    .replace(/file/g, "archivo")
    .replace(/files/g, "archivos")
    .replace(/package/g, "paquete")
    .replace(/reception/g, "recepción")
    .replace(/Do not use slang in this customer support message/g, "No use jerga en este mensaje de soporte al cliente")
    .replace(/Open the app/g, "Abra la app")
    .replace(/Hi /g, "Hola ");
}

function runCommand(command, env) {
  const child = spawnSync(command[0], command.slice(1), {
    cwd: process.cwd(),
    env,
    encoding: "utf-8",
    timeout: sampleTimeoutMs,
    maxBuffer: 20 * 1024 * 1024,
  });
  return child;
}

function assertContainsAny(text, needles, label, failures) {
  if (!needles.some((needle) => text.includes(needle))) {
    failures.push(`Missing ${label}: ${needles.join(" | ")}`);
  }
}
function assertContains(text, needle, label, failures) {
  assertContainsAny(text, [needle], label, failures);
}
function assertNotContains(text, needle, label, failures) {
  if (text.includes(needle)) failures.push(`Forbidden ${label}: ${needle}`);
}
function commonAssertions(text, failures) {
  assertContainsAny(text, ["{userName}", "userName"], "placeholder", failures);
  assertContains(text, "%{count}", "ICU token", failures);
  assertContains(text, "https://example.com/app", "URL", failures);
  assertNotContains(text, "<script", "script tag", failures);
  assertNotContains(text, "chombo", "Panama taboo", failures);
  assertNotContains(text, "cabrón", "PR taboo", failures);
}
function dialectAssertions(text, dialect, failures, fileKind) {
  if (dialect === "es-PR") assertContains(text, "guagua", "Puerto Rican guagua", failures);
  if (dialect === "es-PA") assertContains(text, "bus", "Panamanian bus", failures);
  if (fileKind === "readme" && dialect === "es-AR") assertContainsAny(text, ["Podés", "podés"], "Argentine voseo", failures);
  if (fileKind === "readme" && dialect === "es-ES") assertContainsAny(text, ["Pod", "pod", "vuestra", "vuestras", "vosotros"], "Spain plural/vosotros signal", failures);
  if (dialect === "es-CL" && /avocado|aguacate|palta|food\.avocado/.test(text)) assertContains(text, "palta", "Chilean palta", failures);
  if (dialect === "es-BO" && /hot sauce|salsa picante|llaj/.test(text)) assertContains(text, "llaj", "Bolivian llajwa/llajua", failures);
  if (dialect === "es-MX") assertNotContains(text, "coger", "Mexican coger", failures);
}

function writeJson(path, value) {
  writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`);
}

mkdirSync(outDir, { recursive: true });
const results = [];
for (const dialect of dialects) {
  const dialectDir = join(outDir, dialect);
  rmSync(dialectDir, { recursive: true, force: true });
  mkdirSync(dialectDir, { recursive: true });
  const env = { ...process.env };
  if (!live) env.DIALECT_DOC_MOCK = "1";

  const readmeIn = resolve(fixtures, "README.md");
  const apiIn = resolve(fixtures, "API.md");
  const localeIn = resolve(fixtures, "en.json");
  const readmeOut = join(dialectDir, "README.out.md");
  const apiOut = join(dialectDir, "API.out.md");
  const localeOut = join(dialectDir, "locale.out.json");

  const failures = [];
  if (live) {
    const readme = runCommand(["node", "packages/cli/dist/index.js", "translate-readme", readmeIn, "--dialect", dialect, "--provider", provider, "--output", readmeOut, "--policy", "permissive", "--structure-mode", "warn"], env);
    if (readme.status !== 0) failures.push(`README command failed: ${readme.stderr}`);
    const api = runCommand(["node", "packages/cli/dist/index.js", "translate-api-docs", apiIn, "--dialect", dialect, "--provider", provider, "--output", apiOut, "--policy", "permissive", "--structure-mode", "warn"], env);
    if (api.status !== 0) failures.push(`API command failed: ${api.stderr}`);
  } else {
    writeFileSync(readmeOut, mockDocTranslate(readFileSync(readmeIn, "utf-8"), dialect));
    writeFileSync(apiOut, mockDocTranslate(readFileSync(apiIn, "utf-8"), dialect));
  }
  const localeSource = JSON.parse(readFileSync(localeIn, "utf-8"));
  const localeTranslated = Object.fromEntries(Object.entries(localeSource).map(([key, value]) => [key, mockDocTranslate(String(value), dialect)]));
  writeJson(localeOut, localeTranslated);

  const readmeText = readFileSync(readmeOut, "utf-8");
  const apiText = readFileSync(apiOut, "utf-8");
  const localeText = readFileSync(localeOut, "utf-8");
  for (const text of [readmeText, apiText, localeText]) commonAssertions(text, failures);
  dialectAssertions(readmeText, dialect, failures, "readme");
  dialectAssertions(apiText, dialect, failures, "api");
  dialectAssertions(localeText, dialect, failures, "locale");

  results.push({ dialect, passes: failures.length === 0, failures, files: { readmeOut, apiOut, localeOut } });
}
const summary = { generatedAt: new Date().toISOString(), live, provider: live ? provider : "mock-doc", total: results.length, passed: results.filter((x) => x.passes).length, failed: results.filter((x) => !x.passes).length, results };
writeJson(join(outDir, "results.json"), summary);
console.log(JSON.stringify({ outDir, total: summary.total, passed: summary.passed, failed: summary.failed, live }, null, 2));
if (summary.failed > 0) process.exit(1);
