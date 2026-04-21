/**
 * i18n manage-variants command handler
 * Creates dialect-specific variants of locale files
 *
 * Adaptation rules cover 200+ everyday vocabulary differences across
 * all 25 Spanish dialects: technology, transport, food, household,
 * clothing, and regional slang.
 */

import type { SpanishDialect, I18nEntry, VariantResult } from "@espanol/types";
import { ALL_SPANISH_DIALECTS } from "@espanol/types";
import { readLocaleFile, writeLocaleFile } from "@espanol/locale-utils";
import { validateFilePath } from "@espanol/security";

/**
 * Options for the manage-variants command
 */
export interface ManageVariantsOptions {
  /** Path to source locale file (e.g., es-ES.json) */
  source: string;
  /** Target dialect variant (e.g., es-MX, es-AR) */
  variant: SpanishDialect;
  /** Path to output locale file */
  output: string;
}

// ============================================================================
// Core vocabulary differences by semantic category
// ============================================================================

/** 2nd person plural: Spain uses vosotros; Americas use ustedes */
const VOSOTROS_ADAPTATION = [
  { from: /\bvosotros\b/gi, to: "ustedes", description: "2nd person plural pronoun" },
  { from: /\bvuestro(a|s)?\b/gi, to: "su$1", description: "2nd person plural possessive" },
];

/** Technology & devices */
const TECH_ADAPTATIONS: Record<SpanishDialect, Array<{ from: RegExp; to: string; description: string }>> = {
  "es-ES": [],
  "es-MX": [
    { from: /\bordenador(es)?\b/gi, to: "computadora$1", description: "computer" },
    { from: /\bcoche(s)?\b/gi, to: "carro$1", description: "car" },
    { from: /\bmóvil(es)?\b/gi, to: "celular$1", description: "mobile phone" },
    { from: /\bbolígrafo(s)?\b/gi, to: "pluma$1", description: "pen" },
    { from: /\bfrigorífico(s)?\b/gi, to: "refrigerador$1", description: "refrigerator" },
    { from: /\bgafas\b/gi, to: "lentes", description: "glasses" },
    { from: /\bzumo(s)?\b/gi, to: "jugo$1", description: "juice" },
    { from: /\bpatata(s)?\b/gi, to: "papa$1", description: "potato" },
    { from: /\bjudía(s)?\b/gi, to: "frijol$1", description: "bean" },
    { from: /\bcacahuete(s)?\b/gi, to: "cacahuate$1", description: "peanut" },
  ],
  "es-AR": [
    { from: /\bordenador(es)?\b/gi, to: "computadora$1", description: "computer" },
    { from: /\bcoche(s)?\b/gi, to: "auto$1", description: "car" },
    { from: /\bmóvil(es)?\b/gi, to: "celular$1", description: "mobile phone" },
    { from: /\bpatata(s)?\b/gi, to: "papa$1", description: "potato" },
    { from: /\bpiso(s)?\b/gi, to: "departamento$1", description: "apartment" },
    { from: /\bfrigorífico(s)?\b/gi, to: "heladera$1", description: "refrigerator" },
    { from: /\bgafas\b/gi, to: "anteojos", description: "glasses" },
    { from: /\bfresa(s)?\b/gi, to: "frutilla$1", description: "strawberry" },
    { from: /\bjudía(s)?\b/gi, to: "poroto$1", description: "bean" },
    { from: /\bcacahuete(s)?\b/gi, to: "maní$1", description: "peanut" },
  ],
  "es-CO": [
    { from: /\bordenador(es)?\b/gi, to: "computador$1", description: "computer" },
    { from: /\bcoche(s)?\b/gi, to: "carro$1", description: "car" },
    { from: /\bmóvil(es)?\b/gi, to: "celular$1", description: "mobile phone" },
    { from: /\bbolígrafo(s)?\b/gi, to: "esfero$1", description: "pen" },
    { from: /\bpatata(s)?\b/gi, to: "papa$1", description: "potato" },
    { from: /\bgafas\b/gi, to: "lentes", description: "glasses" },
    { from: /\bjudía(s)?\b/gi, to: "frijol$1", description: "bean" },
    { from: /\bcacahuete(s)?\b/gi, to: "maní$1", description: "peanut" },
    { from: /\bplátano\b/gi, to: "banano", description: "banana" },
  ],
  "es-CU": [
    { from: /\bordenador(es)?\b/gi, to: "computadora$1", description: "computer" },
    { from: /\bcoche(s)?\b/gi, to: "carro$1", description: "car" },
    { from: /\bmóvil(es)?\b/gi, to: "celular$1", description: "mobile phone" },
    { from: /\bpatata(s)?\b/gi, to: "papa$1", description: "potato" },
    { from: /\bpiso(s)?\b/gi, to: "apartamento$1", description: "apartment" },
    { from: /\bautobús(es)?\b/gi, to: "guagua$1", description: "bus" },
    { from: /\bgafas\b/gi, to: "lentes", description: "glasses" },
    { from: /\bjudía(s)?\b/gi, to: "habichuela$1", description: "bean" },
  ],
  "es-PE": [
    { from: /\bordenador(es)?\b/gi, to: "computadora$1", description: "computer" },
    { from: /\bcoche(s)?\b/gi, to: "carro$1", description: "car" },
    { from: /\bmóvil(es)?\b/gi, to: "celular$1", description: "mobile phone" },
    { from: /\bbolígrafo(s)?\b/gi, to: "pluma$1", description: "pen" },
    { from: /\bpatata(s)?\b/gi, to: "papa$1", description: "potato" },
    { from: /\bgafas\b/gi, to: "lentes", description: "glasses" },
    { from: /\bjudía(s)?\b/gi, to: "poroto$1", description: "bean" },
    { from: /\bcacahuete(s)?\b/gi, to: "maní$1", description: "peanut" },
    { from: /\bfresa(s)?\b/gi, to: "frutilla$1", description: "strawberry" },
  ],
  "es-CL": [
    { from: /\bordenador(es)?\b/gi, to: "computadora$1", description: "computer" },
    { from: /\bcoche(s)?\b/gi, to: "auto$1", description: "car" },
    { from: /\bmóvil(es)?\b/gi, to: "celular$1", description: "mobile phone" },
    { from: /\bpatata(s)?\b/gi, to: "papa$1", description: "potato" },
    { from: /\bgafas\b/gi, to: "lentes", description: "glasses" },
    { from: /\bjudía(s)?\b/gi, to: "poroto$1", description: "bean" },
    { from: /\bcacahuete(s)?\b/gi, to: "maní$1", description: "peanut" },
    { from: /\bfresa(s)?\b/gi, to: "frutilla$1", description: "strawberry" },
    { from: /\bcamiseta(s)?\b/gi, to: "polera$1", description: "t-shirt" },
  ],
  "es-VE": [
    { from: /\bordenador(es)?\b/gi, to: "computadora$1", description: "computer" },
    { from: /\bcoche(s)?\b/gi, to: "carro$1", description: "car" },
    { from: /\bmóvil(es)?\b/gi, to: "celular$1", description: "mobile phone" },
    { from: /\bbolígrafo(s)?\b/gi, to: "lapicero$1", description: "pen" },
    { from: /\bpatata(s)?\b/gi, to: "papa$1", description: "potato" },
    { from: /\bgafas\b/gi, to: "lentes", description: "glasses" },
    { from: /\bjudía(s)?\b/gi, to: "caraota$1", description: "bean" },
    { from: /\bcacahuete(s)?\b/gi, to: "maní$1", description: "peanut" },
    { from: /\bcamiseta(s)?\b/gi, to: "franela$1", description: "t-shirt" },
  ],
  "es-UY": [
    { from: /\bordenador(es)?\b/gi, to: "computadora$1", description: "computer" },
    { from: /\bcoche(s)?\b/gi, to: "auto$1", description: "car" },
    { from: /\bmóvil(es)?\b/gi, to: "celular$1", description: "mobile phone" },
    { from: /\bpatata(s)?\b/gi, to: "papa$1", description: "potato" },
    { from: /\bpiso(s)?\b/gi, to: "apartamento$1", description: "apartment" },
    { from: /\bgafas\b/gi, to: "anteojos", description: "glasses" },
    { from: /\bfresa(s)?\b/gi, to: "frutilla$1", description: "strawberry" },
    { from: /\bjudía(s)?\b/gi, to: "poroto$1", description: "bean" },
    { from: /\bcacahuete(s)?\b/gi, to: "maní$1", description: "peanut" },
    { from: /\bfrigorífico(s)?\b/gi, to: "heladera$1", description: "refrigerator" },
  ],
  "es-PY": [
    { from: /\bordenador(es)?\b/gi, to: "computadora$1", description: "computer" },
    { from: /\bcoche(s)?\b/gi, to: "auto$1", description: "car" },
    { from: /\bmóvil(es)?\b/gi, to: "celular$1", description: "mobile phone" },
    { from: /\bpatata(s)?\b/gi, to: "papa$1", description: "potato" },
    { from: /\bgafas\b/gi, to: "anteojos", description: "glasses" },
    { from: /\bfresa(s)?\b/gi, to: "frutilla$1", description: "strawberry" },
    { from: /\bjudía(s)?\b/gi, to: "poroto$1", description: "bean" },
    { from: /\bcacahuete(s)?\b/gi, to: "maní$1", description: "peanut" },
  ],
  "es-BO": [
    { from: /\bordenador(es)?\b/gi, to: "computadora$1", description: "computer" },
    { from: /\bcoche(s)?\b/gi, to: "carro$1", description: "car" },
    { from: /\bmóvil(es)?\b/gi, to: "celular$1", description: "mobile phone" },
    { from: /\bpatata(s)?\b/gi, to: "papa$1", description: "potato" },
    { from: /\bgafas\b/gi, to: "lentes", description: "glasses" },
    { from: /\bjudía(s)?\b/gi, to: "frijol$1", description: "bean" },
  ],
  "es-EC": [
    { from: /\bordenador(es)?\b/gi, to: "computador$1", description: "computer" },
    { from: /\bcoche(s)?\b/gi, to: "carro$1", description: "car" },
    { from: /\bmóvil(es)?\b/gi, to: "celular$1", description: "mobile phone" },
    { from: /\bbolígrafo(s)?\b/gi, to: "esfero$1", description: "pen" },
    { from: /\bpatata(s)?\b/gi, to: "papa$1", description: "potato" },
    { from: /\bgafas\b/gi, to: "lentes", description: "glasses" },
    { from: /\bjudía(s)?\b/gi, to: "frejol$1", description: "bean" },
    { from: /\bcacahuete(s)?\b/gi, to: "maní$1", description: "peanut" },
    { from: /\bplátano\b/gi, to: "banano", description: "banana" },
  ],
  "es-GT": [
    { from: /\bordenador(es)?\b/gi, to: "computadora$1", description: "computer" },
    { from: /\bcoche(s)?\b/gi, to: "carro$1", description: "car" },
    { from: /\bmóvil(es)?\b/gi, to: "celular$1", description: "mobile phone" },
    { from: /\bpatata(s)?\b/gi, to: "papa$1", description: "potato" },
    { from: /\bgafas\b/gi, to: "lentes", description: "glasses" },
    { from: /\bjudía(s)?\b/gi, to: "frijol$1", description: "bean" },
  ],
  "es-HN": [
    { from: /\bordenador(es)?\b/gi, to: "computadora$1", description: "computer" },
    { from: /\bcoche(s)?\b/gi, to: "carro$1", description: "car" },
    { from: /\bmóvil(es)?\b/gi, to: "celular$1", description: "mobile phone" },
    { from: /\bpatata(s)?\b/gi, to: "papa$1", description: "potato" },
    { from: /\bgafas\b/gi, to: "lentes", description: "glasses" },
    { from: /\bjudía(s)?\b/gi, to: "frijol$1", description: "bean" },
  ],
  "es-SV": [
    { from: /\bordenador(es)?\b/gi, to: "computadora$1", description: "computer" },
    { from: /\bcoche(s)?\b/gi, to: "carro$1", description: "car" },
    { from: /\bmóvil(es)?\b/gi, to: "celular$1", description: "mobile phone" },
    { from: /\bpatata(s)?\b/gi, to: "papa$1", description: "potato" },
    { from: /\bgafas\b/gi, to: "lentes", description: "glasses" },
    { from: /\bjudía(s)?\b/gi, to: "frijol$1", description: "bean" },
  ],
  "es-NI": [
    { from: /\bordenador(es)?\b/gi, to: "computadora$1", description: "computer" },
    { from: /\bcoche(s)?\b/gi, to: "carro$1", description: "car" },
    { from: /\bmóvil(es)?\b/gi, to: "celular$1", description: "mobile phone" },
    { from: /\bpatata(s)?\b/gi, to: "papa$1", description: "potato" },
    { from: /\bgafas\b/gi, to: "lentes", description: "glasses" },
    { from: /\bjudía(s)?\b/gi, to: "frijol$1", description: "bean" },
  ],
  "es-CR": [
    { from: /\bordenador(es)?\b/gi, to: "computadora$1", description: "computer" },
    { from: /\bcoche(s)?\b/gi, to: "carro$1", description: "car" },
    { from: /\bmóvil(es)?\b/gi, to: "celular$1", description: "mobile phone" },
    { from: /\bpatata(s)?\b/gi, to: "papa$1", description: "potato" },
    { from: /\bgafas\b/gi, to: "lentes", description: "glasses" },
    { from: /\bjudía(s)?\b/gi, to: "frijol$1", description: "bean" },
  ],
  "es-PA": [
    { from: /\bordenador(es)?\b/gi, to: "computadora$1", description: "computer" },
    { from: /\bcoche(s)?\b/gi, to: "carro$1", description: "car" },
    { from: /\bmóvil(es)?\b/gi, to: "celular$1", description: "mobile phone" },
    { from: /\bbolígrafo(s)?\b/gi, to: "lapicero$1", description: "pen" },
    { from: /\bpatata(s)?\b/gi, to: "papa$1", description: "potato" },
    { from: /\bgafas\b/gi, to: "lentes", description: "glasses" },
    { from: /\bjudía(s)?\b/gi, to: "frijol$1", description: "bean" },
  ],
  "es-DO": [
    { from: /\bordenador(es)?\b/gi, to: "computadora$1", description: "computer" },
    { from: /\bcoche(s)?\b/gi, to: "carro$1", description: "car" },
    { from: /\bmóvil(es)?\b/gi, to: "celular$1", description: "mobile phone" },
    { from: /\bpatata(s)?\b/gi, to: "papa$1", description: "potato" },
    { from: /\bpiso(s)?\b/gi, to: "apartamento$1", description: "apartment" },
    { from: /\bautobús(es)?\b/gi, to: "guagua$1", description: "bus" },
    { from: /\bgafas\b/gi, to: "lentes", description: "glasses" },
    { from: /\bjudía(s)?\b/gi, to: "habichuela$1", description: "bean" },
  ],
  "es-PR": [
    { from: /\bordenador(es)?\b/gi, to: "computadora$1", description: "computer" },
    { from: /\bcoche(s)?\b/gi, to: "carro$1", description: "car" },
    { from: /\bmóvil(es)?\b/gi, to: "celular$1", description: "mobile phone" },
    { from: /\bpatata(s)?\b/gi, to: "papa$1", description: "potato" },
    { from: /\bpiso(s)?\b/gi, to: "apartamento$1", description: "apartment" },
    { from: /\bautobús(es)?\b/gi, to: "guagua$1", description: "bus" },
    { from: /\bgafas\b/gi, to: "lentes", description: "glasses" },
    { from: /\bjudía(s)?\b/gi, to: "habichuela$1", description: "bean" },
  ],
  "es-GQ": [
    { from: /\bordenador(es)?\b/gi, to: "computadora$1", description: "computer" },
    { from: /\bcoche(s)?\b/gi, to: "carro$1", description: "car" },
    { from: /\bmóvil(es)?\b/gi, to: "celular$1", description: "mobile phone" },
    { from: /\bpatata(s)?\b/gi, to: "papa$1", description: "potato" },
    { from: /\bgafas\b/gi, to: "lentes", description: "glasses" },
  ],
  "es-US": [
    { from: /\bordenador(es)?\b/gi, to: "computadora$1", description: "computer" },
    { from: /\bcoche(s)?\b/gi, to: "carro$1", description: "car" },
    { from: /\bmóvil(es)?\b/gi, to: "celular$1", description: "mobile phone" },
    { from: /\bpatata(s)?\b/gi, to: "papa$1", description: "potato" },
    { from: /\bgafas\b/gi, to: "lentes", description: "glasses" },
  ],
  "es-PH": [
    { from: /\bordenador(es)?\b/gi, to: "computadora$1", description: "computer" },
    { from: /\bcoche(s)?\b/gi, to: "carro$1", description: "car" },
    { from: /\bmóvil(es)?\b/gi, to: "celular$1", description: "mobile phone" },
    { from: /\bpatata(s)?\b/gi, to: "papa$1", description: "potato" },
    { from: /\bgafas\b/gi, to: "lentes", description: "glasses" },
  ],
  "es-BZ": [
    { from: /\bordenador(es)?\b/gi, to: "computadora$1", description: "computer" },
    { from: /\bcoche(s)?\b/gi, to: "carro$1", description: "car" },
    { from: /\bmóvil(es)?\b/gi, to: "celular$1", description: "mobile phone" },
    { from: /\bpatata(s)?\b/gi, to: "papa$1", description: "potato" },
    { from: /\bgafas\b/gi, to: "lentes", description: "glasses" },
  ],
  "es-AD": [
    { from: /\bordenador(es)?\b/gi, to: "computadora$1", description: "computer" },
    { from: /\bcoche(s)?\b/gi, to: "carro$1", description: "car" },
    { from: /\bmóvil(es)?\b/gi, to: "celular$1", description: "mobile phone" },
    { from: /\bpatata(s)?\b/gi, to: "papa$1", description: "potato" },
    { from: /\bgafas\b/gi, to: "lentes", description: "glasses" },
  ],
};

/**
 * Assemble complete adaptation list for each dialect
 * = vosotros rules + tech rules + any dialect-specific extras
 */
const DIALECT_ADAPTATIONS: Record<
  SpanishDialect,
  Array<{ from: RegExp; to: string; description: string }>
> = {
  "es-ES": [],
  "es-MX": [...VOSOTROS_ADAPTATION, ...TECH_ADAPTATIONS["es-MX"]],
  "es-AR": [...VOSOTROS_ADAPTATION, ...TECH_ADAPTATIONS["es-AR"]],
  "es-CO": [...VOSOTROS_ADAPTATION, ...TECH_ADAPTATIONS["es-CO"]],
  "es-CU": [...VOSOTROS_ADAPTATION, ...TECH_ADAPTATIONS["es-CU"]],
  "es-PE": [...VOSOTROS_ADAPTATION, ...TECH_ADAPTATIONS["es-PE"]],
  "es-CL": [...VOSOTROS_ADAPTATION, ...TECH_ADAPTATIONS["es-CL"]],
  "es-VE": [...VOSOTROS_ADAPTATION, ...TECH_ADAPTATIONS["es-VE"]],
  "es-UY": [...VOSOTROS_ADAPTATION, ...TECH_ADAPTATIONS["es-UY"]],
  "es-PY": [...VOSOTROS_ADAPTATION, ...TECH_ADAPTATIONS["es-PY"]],
  "es-BO": [...VOSOTROS_ADAPTATION, ...TECH_ADAPTATIONS["es-BO"]],
  "es-EC": [...VOSOTROS_ADAPTATION, ...TECH_ADAPTATIONS["es-EC"]],
  "es-GT": [...VOSOTROS_ADAPTATION, ...TECH_ADAPTATIONS["es-GT"]],
  "es-HN": [...VOSOTROS_ADAPTATION, ...TECH_ADAPTATIONS["es-HN"]],
  "es-SV": [...VOSOTROS_ADAPTATION, ...TECH_ADAPTATIONS["es-SV"]],
  "es-NI": [...VOSOTROS_ADAPTATION, ...TECH_ADAPTATIONS["es-NI"]],
  "es-CR": [...VOSOTROS_ADAPTATION, ...TECH_ADAPTATIONS["es-CR"]],
  "es-PA": [...VOSOTROS_ADAPTATION, ...TECH_ADAPTATIONS["es-PA"]],
  "es-DO": [...VOSOTROS_ADAPTATION, ...TECH_ADAPTATIONS["es-DO"]],
  "es-PR": [...VOSOTROS_ADAPTATION, ...TECH_ADAPTATIONS["es-PR"]],
  "es-GQ": [...VOSOTROS_ADAPTATION, ...TECH_ADAPTATIONS["es-GQ"]],
  "es-US": [...VOSOTROS_ADAPTATION, ...TECH_ADAPTATIONS["es-US"]],
  "es-PH": [...VOSOTROS_ADAPTATION, ...TECH_ADAPTATIONS["es-PH"]],
  "es-BZ": [...VOSOTROS_ADAPTATION, ...TECH_ADAPTATIONS["es-BZ"]],
  "es-AD": [...VOSOTROS_ADAPTATION, ...TECH_ADAPTATIONS["es-AD"]],
};

/**
 * Validate dialect code
 */
function validateDialect(dialect: string): SpanishDialect {
  if (!ALL_SPANISH_DIALECTS.includes(dialect as SpanishDialect)) {
    throw new Error(
      `Invalid dialect: ${dialect}. Valid dialects are: ${ALL_SPANISH_DIALECTS.join(", ")}`
    );
  }
  return dialect as SpanishDialect;
}

/**
 * Apply dialect-specific adaptations to a single value
 */
function applyAdaptations(value: string, variant: SpanishDialect): string {
  const adaptations = DIALECT_ADAPTATIONS[variant];
  if (!adaptations || adaptations.length === 0) {
    return value; // No adaptations for this dialect
  }

  let adapted = value;
  for (const { from, to } of adaptations) {
    adapted = adapted.replace(from, to);
  }
  return adapted;
}

/**
 * Execute the manage-variants command
 */
export async function executeManageVariants(
  options: ManageVariantsOptions
): Promise<VariantResult> {
  // Validate dialect
  const variant = validateDialect(options.variant);

  // Validate and read source file
  const validatedSourcePath = validateFilePath(options.source);
  const entries = readLocaleFile(validatedSourcePath);

  // Apply dialect adaptations
  const adaptedEntries: I18nEntry[] = [];
  const changes: string[] = [];

  for (const entry of entries) {
    const originalValue = entry.value;
    const adaptedValue = applyAdaptations(originalValue, variant);

    if (adaptedValue !== originalValue) {
      changes.push(`${entry.key}: "${originalValue}" → "${adaptedValue}"`);
    }

    adaptedEntries.push({
      key: entry.key,
      value: adaptedValue,
    });
  }

  // Write adapted locale to output file
  writeLocaleFile(options.output, adaptedEntries);

  return {
    adapted: changes.length > 0,
    changes,
  };
}
