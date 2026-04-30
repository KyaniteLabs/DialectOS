/**
 * Shared evaluation harness for dialect evaluation scripts.
 *
 * Centralizes mock translation, live provider wiring, term checking,
 * and the core evaluation loop so scripts don't duplicate ~500 lines
 * of identical logic.
 */

import type { SpanishDialect } from "@dialectos/types";
import { readdirSync, readFileSync } from "node:fs";
import { basename, join } from "node:path";
import { buildLexicalAmbiguityExpectations } from "./lexical-ambiguity.js";
import { judgeTranslationOutput } from "./output-judge.js";
import { validateTranslation } from "./validate-translation.js";
import { createProviderRegistry } from "./provider-factory.js";
import { buildSemanticTranslationContext } from "./semantic-context.js";

// Re-export utilities so scripts can import everything from one module
export { buildLexicalAmbiguityExpectations, judgeTranslationOutput, validateTranslation };

// ============================================================================
// Dialect sets
// ============================================================================

export const VOSEO_DIALECTS = new Set<SpanishDialect>([
  "es-AR", "es-UY", "es-PY", "es-GT", "es-HN", "es-SV", "es-NI",
]);
export const VOSOTROS_DIALECTS = new Set<SpanishDialect>(["es-ES", "es-AD"]);
export const GUAGUA_BUS_DIALECTS = new Set<SpanishDialect>(["es-CU", "es-DO", "es-PR"]);

// ============================================================================
// Mock translator — single source of truth for all evaluation scripts
// ============================================================================

export interface MockSample {
  register?: string;
}

export function mockTranslate(source: string, dialect: SpanishDialect, sample: MockSample = {}): string {
  const formalSupport = sample.register === "formal" && /\b(password|support|payment)\b/i.test(source);

  return source
    // Pre-replace words that sentence patterns depend on
    .replace(/\bpassword\b/i, "contraseña")
    .replace(/\baccount settings\b/i, "configuración de la cuenta")
    // Full-sentence replacements (most specific first)
    .replace(/\bDo not delete the database without a backup\./i, "No elimine la base de datos sin una copia de seguridad.")
    .replace(/\bYou can update your configuración de la cuenta in the profile page\./i,
      VOSEO_DIALECTS.has(dialect) ? "Podés actualizar la configuración de tu cuenta en la página de perfil." :
      VOSOTROS_DIALECTS.has(dialect) ? "Podéis actualizar la configuración de vuestra cuenta en la página de perfil." :
      "Puedes actualizar la configuración de tu cuenta en la página de perfil.")
    .replace(/\bThe traditional dish for the holiday celebration includes (.+?)\./i, "El plato tradicional para la celebración festiva incluye $1.")
    .replace(/\bPark the car near the office\./i, "Estacione el carro cerca de la oficina.")
    .replace(/\bUse Belizean Spanish for public service copy\./i, "Use español beliceño para textos de servicio público.")
    .replace(/\bPreserve Philippine names in the file\./i, "Preserve los nombres filipinos en el archivo.")
    .replace(/\bDo not use slang in this customer support message\./i, "No use jerga en este mensaje de soporte al cliente.")
    .replace(/\bUse yam in the recipe\./i, dialect === "es-GQ" ? "Use ñame en la receta." : "Use yam en la receta.")
    .replace(/\bBuy hot sauce for lunch\./i, dialect === "es-BO" ? "Compre llajwa para el almuerzo." : "Compre salsa picante para el almuerzo.")
    .replace(/\bBuy avocado for lunch\./i, dialect === "es-CL" ? "Compra palta para el almuerzo." : "Compra aguacate para el almuerzo.")
    .replace(/\bOrange juice is ready\./i, ["es-PR", "es-DO"].includes(dialect) ? "El jugo de china está listo." : "El jugo de naranja está listo.")
    .replace(/\bJugo de china is on the Puerto Rican menu\./i, dialect === "es-MX" ? "El jugo de naranja está en el menú puertorriqueño." : "El jugo de china está en el menú puertorriqueño.")
    .replace(/\bThe baby is sleeping\./i, dialect === "es-CL" ? "La guagua está durmiendo." : "El bebé está durmiendo.")
    .replace(/\bUse the computer to open the file\./i, ["es-CO", "es-EC"].includes(dialect) ? "Usa el computador para abrir el archivo." : "Usa la computadora para abrir el archivo.")
    .replace(/\bPlease update your contraseña before continuing\./i, formalSupport ? "Por favor, actualice su contraseña antes de continuar." : "Actualiza tu contraseña antes de continuar.")
    .replace(/\bContact support\./i, formalSupport ? "Comuníquese con soporte." : "Contacta a soporte.")
    .replace(/\bpayment fails\./i, "pago falla")
    .replace(/\bPick up the room before guests arrive\./i, dialect === "es-PR" ? "Recoge el cuarto antes de que lleguen los invitados." : "Ordena la habitación antes de que lleguen los invitados.")
    .replace(/\bCatch the bus to the office\./i, "Toma el autobús a la oficina.")
    .replace(/\bPick up the file before deployment\./i, "Recoge el archivo antes del despliegue.")
    .replace(/\bPick up the package from reception\./i, "Recoge el paquete de recepción.")
    .replace(/\bHi \{userName\}, your %\{count\} files are ready at https:\/\/example\.com\/app\./i,
      `Hola {userName}, tus %{count} archivos están listos en https://example.com/app.`)
    // Word-level replacements (less specific, apply after sentences)
    .replace(/\b(Catch|Ride|Get on)\b/i, "Toma")
    .replace(/\bTake\b/i, "Toma")
    .replace(/\bbus\b/i,
      GUAGUA_BUS_DIALECTS.has(dialect) ? "guagua" :
      ["es-AR", "es-UY"].includes(dialect) ? "colectivo" :
      dialect === "es-MX" ? "camión" : "autobús")
    .replace(/\boffice\b/i, "oficina")
    .replace(/\bpackage\b/i, "paquete")
    .replace(/\breception\b/i, "recepción")
    .replace(/\bPick up\b/i, "Recoge")
    .replace(/\bfiles\b/i, "archivos")
    .replace(/\bfile\b/i, "archivo")
    .replace(/\bdeployment\b/i, "despliegue")
    .replace(/\bYou can update\b/i, VOSEO_DIALECTS.has(dialect) ? "Vos podés actualizar" : "Puedes actualizar")
    .replace(/\byour account now\b/i, "tu cuenta ahora")
    .replace(/\bYou can all update\b/i, VOSOTROS_DIALECTS.has(dialect) ? "Vosotros podéis actualizar" : "Ustedes pueden actualizar")
    .replace(/\byour passwords now\b/i, "vuestras contraseñas ahora")
    .replace(/\bPark the car near the office\./i, "Estaciona el coche cerca de la oficina.")
    .replace(/\bUse the computer to open the file\./i, "Usa la computadora para abrir el archivo.")
    .replace(/\bYou can update your account now\./i,
      VOSEO_DIALECTS.has(dialect) ? "Vos podés actualizar tu cuenta ahora." : "Puedes actualizar tu cuenta ahora.");
}

// ============================================================================
// Live translator factory
// ============================================================================

export type TranslateFn = (sample: any, dialect: SpanishDialect) => Promise<string>;

export async function createLiveTranslate(providerName: string): Promise<TranslateFn> {
  const registry = createProviderRegistry();
  const available = registry.listProviders();
  if (available.length === 0) {
    throw new Error(
      "No live providers are configured. Set LLM_API_URL + LLM_MODEL, DEEPL_AUTH_KEY, LIBRETRANSLATE_URL, or ENABLE_MYMEMORY=1."
    );
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

// ============================================================================
// Term checker
// ============================================================================

export function hasForbiddenTerm(output: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`(^|[^\\p{L}\\p{N}_])${escaped}(?=$|[^\\p{L}\\p{N}_])`, "iu").test(output);
}

// ============================================================================
// Core evaluation loop
// ============================================================================

export interface EvalOptions {
  judgeEnabled?: boolean;
  validateEnabled?: boolean;
  warnOnMissingMetadata?: boolean;
}

export interface EvalResult {
  dialect: SpanishDialect;
  fixture: string;
  provider: string;
  live: boolean;
  source: string;
  output: string;
  passes: boolean;
  failures: string[];
  warnings: string[];
  qualityWarnings: string[];
}

export async function evaluateSample(
  sample: any,
  dialect: SpanishDialect,
  translate: TranslateFn,
  options: EvalOptions & { providerName: string; live: boolean }
): Promise<EvalResult> {
  const { judgeEnabled = false, validateEnabled = false, warnOnMissingMetadata = false, providerName, live } = options;
  const failures: string[] = [];
  const warnings: string[] = [];
  const qualityWarnings: string[] = [];
  let output = "";

  try {
    output = await translate(sample, dialect);
  } catch (error) {
    failures.push(`Provider error: ${error instanceof Error ? error.message : String(error)}`);
  }

  const lexicalExpectations = buildLexicalAmbiguityExpectations(sample.source, dialect);

  // Forbidden terms
  for (const term of [...(sample.forbiddenOutputTerms || []), ...lexicalExpectations.forbiddenOutputTerms]) {
    if (output && hasForbiddenTerm(output, term)) {
      failures.push(`Forbidden output term present: ${term}`);
    }
  }

  // Required output (any)
  if (output && sample.requiredOutputAny?.length) {
    const matched = sample.requiredOutputAny.some((term: string) => hasForbiddenTerm(output, term));
    if (!matched) {
      failures.push(`Missing required output trait; expected one of: ${sample.requiredOutputAny.join(", ")}`);
    }
  }

  // Required output groups
  const requiredOutputGroups = [
    ...(sample.requiredOutputGroups || []),
    ...lexicalExpectations.requiredOutputGroups,
  ];
  if (output && requiredOutputGroups.length) {
    for (const group of requiredOutputGroups) {
      const matched = group.some((term: string) => hasForbiddenTerm(output, term));
      if (!matched) {
        failures.push(`Missing required output group; expected one of: ${group.join(", ")}`);
      }
    }
  }

  // Preferred output (quality warning only)
  if (output && sample.preferredOutputAny?.length) {
    const matched = sample.preferredOutputAny.some((term: string) => hasForbiddenTerm(output, term));
    if (!matched) {
      qualityWarnings.push(`Missing preferred dialect trait; expected one of: ${sample.preferredOutputAny.join(", ")}`);
    }
  }

  // Output judge
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
    for (const issue of judge.issues.filter((i) => !judge.blockingIssues.includes(i))) {
      qualityWarnings.push(`Judge ${issue.category}/${issue.severity}: ${issue.message}`);
    }
  }

  // Unified validation pipeline (benchmark mode)
  let validationReport: any;
  if (output && validateEnabled) {
    validationReport = validateTranslation({
      source: sample.source,
      translated: output,
      dialect,
      protectedTokens: sample.protectedTokens || [],
      glossary: sample.glossary || {},
      isMarkdown: sample.documentKind === "api-docs",
    });
    if (!validationReport.valid) {
      for (const issue of validationReport.blockingIssues) {
        failures.push(`Validation: ${issue}`);
      }
    }
  }

  // Metadata warnings
  if (warnOnMissingMetadata) {
    if (!sample.requiredContext?.length) {
      warnings.push("No requiredContext assertions recorded");
    }
    if (!sample.notes || sample.notes.length < 10) {
      warnings.push("Fixture lacks useful notes");
    }
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

// ============================================================================
// Fixture loading
// ============================================================================

export interface FixtureGroup {
  dialect: SpanishDialect;
  samples: any[];
}

export function loadFixtures(fixtureDir: string, dialectFilter: Set<SpanishDialect>): FixtureGroup[] {
  const groups: FixtureGroup[] = [];

  for (const file of readdirSync(fixtureDir).filter((name: string) => name.endsWith(".json")).sort()) {
    const dialect = basename(file, ".json") as SpanishDialect;
    if (dialectFilter.size > 0 && !dialectFilter.has(dialect)) continue;
    const samples = JSON.parse(readFileSync(join(fixtureDir, file), "utf-8"));
    groups.push({ dialect, samples });
  }

  return groups;
}

// ============================================================================
// Summary builder
// ============================================================================

export interface SummaryOptions {
  fixtureDir: string;
  providerName: string;
  live: boolean;
}

export function buildSummary(results: EvalResult[], options: SummaryOptions) {
  const { fixtureDir, providerName, live } = options;
  return {
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
}
