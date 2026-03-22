/**
 * i18n manage-variants command handler
 * Creates dialect-specific variants of locale files
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

/**
 * Dialect-specific word adaptations
 * Maps Spanish dialects to their regional vocabulary changes
 */
const DIALECT_ADAPTATIONS: Record<
  SpanishDialect,
  Array<{ from: RegExp; to: string; description: string }>
> = {
  "es-ES": [], // Base dialect, no adaptations

  // Mexican Spanish
  "es-MX": [
    { from: /\bvosotros\b/gi, to: "ustedes", description: "2nd person plural" },
    { from: /\bvuestro(a|os|as)?\b/gi, to: "su", description: "2nd person plural possessive" },
    { from: /\bordenador(es)?\b/gi, to: "computadora$1", description: "computer" },
    { from: /\bcoche(s)?\b/gi, to: "carro$1", description: "car" },
    { from: /\bbolígrafo(s)?\b/gi, to: "pluma$1", description: "pen" },
    { from: /\bzumo(s)?\b/gi, to: "jugo$1", description: "juice" },
    { from: /\bmóvil(es)?\b/gi, to: "celular$1", description: "mobile phone" },
    { from: /\bpatata(s)?\b/gi, to: "papa$1", description: "potato" },
    { from: /\bpiso(s)?\b/gi, to: "departamento$1", description: "apartment" },
  ],

  // Argentine Spanish
  "es-AR": [
    { from: /\bvosotros\b/gi, to: "ustedes", description: "2nd person plural" },
    { from: /\bvuestro(a|os|as)?\b/gi, to: "su", description: "2nd person plural possessive" },
    { from: /\bordenador(es)?\b/gi, to: "computadora$1", description: "computer" },
    { from: /\bcoche(s)?\b/gi, to: "auto$1", description: "car" },
    { from: /\bmóvil(es)?\b/gi, to: "celular$1", description: "mobile phone" },
    { from: /\bpatata(s)?\b/gi, to: "papa$1", description: "potato" },
    { from: /\bpiso(s)?\b/gi, to: "departamento$1", description: "apartment" },
  ],

  // Colombian Spanish
  "es-CO": [
    { from: /\bvosotros\b/gi, to: "ustedes", description: "2nd person plural" },
    { from: /\bvuestro(a|os|as)?\b/gi, to: "su", description: "2nd person plural possessive" },
    { from: /\bordenador(es)?\b/gi, to: "computadora$1", description: "computer" },
    { from: /\bcoche(s)?\b/gi, to: "carro$1", description: "car" },
    { from: /\bbolígrafo(s)?\b/gi, to: "esfero$1", description: "pen" },
    { from: /\bzumo(s)?\b/gi, to: "jugo$1", description: "juice" },
    { from: /\bmóvil(es)?\b/gi, to: "celular$1", description: "mobile phone" },
    { from: /\bpatata(s)?\b/gi, to: "papa$1", description: "potato" },
  ],

  // Cuban Spanish
  "es-CU": [
    { from: /\bvosotros\b/gi, to: "ustedes", description: "2nd person plural" },
    { from: /\bvuestro(a|os|as)?\b/gi, to: "su", description: "2nd person plural possessive" },
    { from: /\bordenador(es)?\b/gi, to: "computadora$1", description: "computer" },
    { from: /\bcoche(s)?\b/gi, to: "carro$1", description: "car" },
    { from: /\bbolígrafo(s)?\b/gi, to: "bolígrafo$1", description: "pen (kept)" },
    { from: /\bzumo(s)?\b/gi, to: "jugo$1", description: "juice" },
    { from: /\bmóvil(es)?\b/gi, to: "celular$1", description: "mobile phone" },
    { from: /\bpatata(s)?\b/gi, to: "papa$1", description: "potato" },
    { from: /\bpiso(s)?\b/gi, to: "apartamento$1", description: "apartment" },
    { from: /\bautobús(es)?\b/gi, to: "guagua$1", description: "bus" },
  ],

  // Peruvian Spanish
  "es-PE": [
    { from: /\bvosotros\b/gi, to: "ustedes", description: "2nd person plural" },
    { from: /\bvuestro(a|os|as)?\b/gi, to: "su", description: "2nd person plural possessive" },
    { from: /\bordenador(es)?\b/gi, to: "computadora$1", description: "computer" },
    { from: /\bcoche(s)?\b/gi, to: "carro$1", description: "car" },
    { from: /\bbolígrafo(s)?\b/gi, to: "pluma$1", description: "pen" },
    { from: /\bzumo(s)?\b/gi, to: "jugo$1", description: "juice" },
    { from: /\bmóvil(es)?\b/gi, to: "celular$1", description: "mobile phone" },
    { from: /\bpatata(s)?\b/gi, to: "papa$1", description: "potato" },
  ],

  // Chilean Spanish
  "es-CL": [
    { from: /\bvosotros\b/gi, to: "ustedes", description: "2nd person plural" },
    { from: /\bvuestro(a|os|as)?\b/gi, to: "su", description: "2nd person plural possessive" },
    { from: /\bordenador(es)?\b/gi, to: "computadora$1", description: "computer" },
    { from: /\bcoche(s)?\b/gi, to: "auto$1", description: "car" },
    { from: /\bbolígrafo(s)?\b/gi, to: "bolígrafo$1", description: "pen (kept)" },
    { from: /\bzumo(s)?\b/gi, to: "jugo$1", description: "juice" },
    { from: /\bmóvil(es)?\b/gi, to: "celular$1", description: "mobile phone" },
    { from: /\bpatata(s)?\b/gi, to: "papa$1", description: "potato" },
  ],

  // Venezuelan Spanish
  "es-VE": [
    { from: /\bvosotros\b/gi, to: "ustedes", description: "2nd person plural" },
    { from: /\bvuestro(a|os|as)?\b/gi, to: "su", description: "2nd person plural possessive" },
    { from: /\bordenador(es)?\b/gi, to: "computadora$1", description: "computer" },
    { from: /\bcoche(s)?\b/gi, to: "carro$1", description: "car" },
    { from: /\bbolígrafo(s)?\b/gi, to: "lapicero$1", description: "pen" },
    { from: /\bzumo(s)?\b/gi, to: "jugo$1", description: "juice" },
    { from: /\bmóvil(es)?\b/gi, to: "celular$1", description: "mobile phone" },
    { from: /\bpatata(s)?\b/gi, to: "papa$1", description: "potato" },
  ],

  // Uruguayan Spanish
  "es-UY": [
    { from: /\bvosotros\b/gi, to: "ustedes", description: "2nd person plural" },
    { from: /\bvuestro(a|os|as)?\b/gi, to: "su", description: "2nd person plural possessive" },
    { from: /\bordenador(es)?\b/gi, to: "computadora$1", description: "computer" },
    { from: /\bcoche(s)?\b/gi, to: "auto$1", description: "car" },
    { from: /\bbolígrafo(s)?\b/gi, to: "bolígrafo$1", description: "pen (kept)" },
    { from: /\bzumo(s)?\b/gi, to: "jugo$1", description: "juice" },
    { from: /\bmóvil(es)?\b/gi, to: "celular$1", description: "mobile phone" },
    { from: /\bpatata(s)?\b/gi, to: "papa$1", description: "potato" },
  ],

  // Paraguayan Spanish
  "es-PY": [
    { from: /\bvosotros\b/gi, to: "ustedes", description: "2nd person plural" },
    { from: /\bvuestro(a|os|as)?\b/gi, to: "su", description: "2nd person plural possessive" },
    { from: /\bordenador(es)?\b/gi, to: "computadora$1", description: "computer" },
    { from: /\bcoche(s)?\b/gi, to: "auto$1", description: "car" },
    { from: /\bbolígrafo(s)?\b/gi, to: "bolígrafo$1", description: "pen (kept)" },
    { from: /\bzumo(s)?\b/gi, to: "jugo$1", description: "juice" },
    { from: /\bmóvil(es)?\b/gi, to: "celular$1", description: "mobile phone" },
    { from: /\bpatata(s)?\b/gi, to: "papa$1", description: "potato" },
  ],

  // Bolivian Spanish
  "es-BO": [
    { from: /\bvosotros\b/gi, to: "ustedes", description: "2nd person plural" },
    { from: /\bvuestro(a|os|as)?\b/gi, to: "su", description: "2nd person plural possessive" },
    { from: /\bordenador(es)?\b/gi, to: "computadora$1", description: "computer" },
    { from: /\bcoche(s)?\b/gi, to: "carro$1", description: "car" },
    { from: /\bbolígrafo(s)?\b/gi, to: "bolígrafo$1", description: "pen (kept)" },
    { from: /\bzumo(s)?\b/gi, to: "jugo$1", description: "juice" },
    { from: /\bmóvil(es)?\b/gi, to: "celular$1", description: "mobile phone" },
    { from: /\bpatata(s)?\b/gi, to: "papa$1", description: "potato" },
  ],

  // Ecuadorian Spanish
  "es-EC": [
    { from: /\bvosotros\b/gi, to: "ustedes", description: "2nd person plural" },
    { from: /\bvuestro(a|os|as)?\b/gi, to: "su", description: "2nd person plural possessive" },
    { from: /\bordenador(es)?\b/gi, to: "computadora$1", description: "computer" },
    { from: /\bcoche(s)?\b/gi, to: "carro$1", description: "car" },
    { from: /\bbolígrafo(s)?\b/gi, to: "esfero$1", description: "pen" },
    { from: /\bzumo(s)?\b/gi, to: "jugo$1", description: "juice" },
    { from: /\bmóvil(es)?\b/gi, to: "celular$1", description: "mobile phone" },
    { from: /\bpatata(s)?\b/gi, to: "papa$1", description: "potato" },
  ],

  // Guatemalan Spanish
  "es-GT": [
    { from: /\bvosotros\b/gi, to: "ustedes", description: "2nd person plural" },
    { from: /\bvuestro(a|os|as)?\b/gi, to: "su", description: "2nd person plural possessive" },
    { from: /\bordenador(es)?\b/gi, to: "computadora$1", description: "computer" },
    { from: /\bcoche(s)?\b/gi, to: "carro$1", description: "car" },
    { from: /\bbolígrafo(s)?\b/gi, to: "bolígrafo$1", description: "pen (kept)" },
    { from: /\bzumo(s)?\b/gi, to: "jugo$1", description: "juice" },
    { from: /\bmóvil(es)?\b/gi, to: "celular$1", description: "mobile phone" },
    { from: /\bpatata(s)?\b/gi, to: "papa$1", description: "potato" },
  ],

  // Honduran Spanish
  "es-HN": [
    { from: /\bvosotros\b/gi, to: "ustedes", description: "2nd person plural" },
    { from: /\bvuestro(a|os|as)?\b/gi, to: "su", description: "2nd person plural possessive" },
    { from: /\bordenador(es)?\b/gi, to: "computadora$1", description: "computer" },
    { from: /\bcoche(s)?\b/gi, to: "carro$1", description: "car" },
    { from: /\bbolígrafo(s)?\b/gi, to: "bolígrafo$1", description: "pen (kept)" },
    { from: /\bzumo(s)?\b/gi, to: "jugo$1", description: "juice" },
    { from: /\bmóvil(es)?\b/gi, to: "celular$1", description: "mobile phone" },
    { from: /\bpatata(s)?\b/gi, to: "papa$1", description: "potato" },
  ],

  // Salvadoran Spanish
  "es-SV": [
    { from: /\bvosotros\b/gi, to: "ustedes", description: "2nd person plural" },
    { from: /\bvuestro(a|os|as)?\b/gi, to: "su", description: "2nd person plural possessive" },
    { from: /\bordenador(es)?\b/gi, to: "computadora$1", description: "computer" },
    { from: /\bcoche(s)?\b/gi, to: "carro$1", description: "car" },
    { from: /\bbolígrafo(s)?\b/gi, to: "bolígrafo$1", description: "pen (kept)" },
    { from: /\bzumo(s)?\b/gi, to: "jugo$1", description: "juice" },
    { from: /\bmóvil(es)?\b/gi, to: "celular$1", description: "mobile phone" },
    { from: /\bpatata(s)?\b/gi, to: "papa$1", description: "potato" },
  ],

  // Nicaraguan Spanish
  "es-NI": [
    { from: /\bvosotros\b/gi, to: "ustedes", description: "2nd person plural" },
    { from: /\bvuestro(a|os|as)?\b/gi, to: "su", description: "2nd person plural possessive" },
    { from: /\bordenador(es)?\b/gi, to: "computadora$1", description: "computer" },
    { from: /\bcoche(s)?\b/gi, to: "carro$1", description: "car" },
    { from: /\bbolígrafo(s)?\b/gi, to: "bolígrafo$1", description: "pen (kept)" },
    { from: /\bzumo(s)?\b/gi, to: "jugo$1", description: "juice" },
    { from: /\bmóvil(es)?\b/gi, to: "celular$1", description: "mobile phone" },
    { from: /\bpatata(s)?\b/gi, to: "papa$1", description: "potato" },
  ],

  // Costa Rican Spanish
  "es-CR": [
    { from: /\bvosotros\b/gi, to: "ustedes", description: "2nd person plural" },
    { from: /\bvuestro(a|os|as)?\b/gi, to: "su", description: "2nd person plural possessive" },
    { from: /\bordenador(es)?\b/gi, to: "computadora$1", description: "computer" },
    { from: /\bcoche(s)?\b/gi, to: "carro$1", description: "car" },
    { from: /\bbolígrafo(s)?\b/gi, to: "bolígrafo$1", description: "pen (kept)" },
    { from: /\bzumo(s)?\b/gi, to: "jugo$1", description: "juice" },
    { from: /\bmóvil(es)?\b/gi, to: "celular$1", description: "mobile phone" },
    { from: /\bpatata(s)?\b/gi, to: "papa$1", description: "potato" },
  ],

  // Panamanian Spanish
  "es-PA": [
    { from: /\bvosotros\b/gi, to: "ustedes", description: "2nd person plural" },
    { from: /\bvuestro(a|os|as)?\b/gi, to: "su", description: "2nd person plural possessive" },
    { from: /\bordenador(es)?\b/gi, to: "computadora$1", description: "computer" },
    { from: /\bcoche(s)?\b/gi, to: "carro$1", description: "car" },
    { from: /\bbolígrafo(s)?\b/gi, to: "bolígrafo$1", description: "pen (kept)" },
    { from: /\bzumo(s)?\b/gi, to: "jugo$1", description: "juice" },
    { from: /\bmóvil(es)?\b/gi, to: "celular$1", description: "mobile phone" },
    { from: /\bpatata(s)?\b/gi, to: "papa$1", description: "potato" },
  ],

  // Dominican Spanish
  "es-DO": [
    { from: /\bvosotros\b/gi, to: "ustedes", description: "2nd person plural" },
    { from: /\bvuestro(a|os|as)?\b/gi, to: "su", description: "2nd person plural possessive" },
    { from: /\bordenador(es)?\b/gi, to: "computadora$1", description: "computer" },
    { from: /\bcoche(s)?\b/gi, to: "carro$1", description: "car" },
    { from: /\bbolígrafo(s)?\b/gi, to: "bolígrafo$1", description: "pen (kept)" },
    { from: /\bzumo(s)?\b/gi, to: "jugo$1", description: "juice" },
    { from: /\bmóvil(es)?\b/gi, to: "celular$1", description: "mobile phone" },
    { from: /\bpatata(s)?\b/gi, to: "papa$1", description: "potato" },
  ],

  // Puerto Rican Spanish
  "es-PR": [
    { from: /\bvosotros\b/gi, to: "ustedes", description: "2nd person plural" },
    { from: /\bvuestro(a|os|as)?\b/gi, to: "su", description: "2nd person plural possessive" },
    { from: /\bordenador(es)?\b/gi, to: "computadora$1", description: "computer" },
    { from: /\bcoche(s)?\b/gi, to: "carro$1", description: "car" },
    { from: /\bbolígrafo(s)?\b/gi, to: "bolígrafo$1", description: "pen (kept)" },
    { from: /\bzumo(s)?\b/gi, to: "jugo$1", description: "juice" },
    { from: /\bmóvil(es)?\b/gi, to: "celular$1", description: "mobile phone" },
    { from: /\bpatata(s)?\b/gi, to: "papa$1", description: "potato" },
  ],
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
