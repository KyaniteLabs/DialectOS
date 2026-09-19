/**
 * i18n manage-variants command handler
 * Creates dialect-specific variants of locale files
 *
 * Wave 2 (2026-09-19): the naive per-dialect regex table was replaced by
 * the shared deterministic engine (applyLexicalSubstitution from
 * @dialectos/providers) — the same engine the MCP tool uses. That fixes
 * the CLI's three tabulated defects in one move:
 * - "el ordenador" now adapts to "la computadora" (article gender agrees
 *   with the substituted noun; the old table produced "el computadora")
 * - the vosotros possessive bug ("vuestra" → "sua" via a bad $1 capture)
 *   is gone; the pronominal rules are explicit and correct below
 * - no-op rules ("maletero" → "maletero" in es-CL/es-VE/es-PR) no longer
 *   exist; whatever the shared dictionary doesn't cover simply passes
 *   through instead of pretending to adapt
 *
 * Verb conjugations ("conduce" → "maneja") were dropped on purpose: the
 * deterministic engine substitutes lexicon (nouns/concepts), including the
 * infinitive "conducir" → "manejar"; conjugated forms belong to the
 * LLM-backed translation pipeline, not to a regex table.
 */

import type { SpanishDialect, I18nEntry, VariantResult } from "@dialectos/types";
import { ALL_SPANISH_DIALECTS, DEFAULT_DIALECT } from "@dialectos/types";
import { readLocaleFile, writeLocaleFile } from "@dialectos/locale-utils";
import { validateFilePath } from "@dialectos/security";
import { applyLexicalSubstitution, applyCase } from "@dialectos/providers";

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
 * 2nd person plural: Spain uses vosotros; the Americas use ustedes.
 * Grammar, not lexicon — the shared dictionary does not carry pronouns,
 * so these stay explicit. Specific forms before generic ones; no capture
 * groups (the old `su$1` turned "vuestra" into "sua").
 */
const PRONOMINAL_ADAPTATIONS: Array<{ from: RegExp; to: string }> = [
  { from: /\bvosotros\b/gi, to: "ustedes" },
  { from: /\bvuestros\b/gi, to: "sus" },
  { from: /\bvuestras\b/gi, to: "sus" },
  { from: /\bvuestro\b/gi, to: "su" },
  { from: /\bvuestra\b/gi, to: "su" },
];

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
 * Apply dialect-specific adaptations to a single value: shared lexical
 * engine first (dictionary vocabulary + article gender agreement + plural
 * and case preservation), then the pronominal rules — except for the base
 * dialect (es-ES), where vosotros is correct Spanish and stays untouched.
 */
function applyAdaptations(value: string, variant: SpanishDialect): string {
  let adapted = applyLexicalSubstitution(value, variant);
  if (variant !== DEFAULT_DIALECT) {
    for (const { from, to } of PRONOMINAL_ADAPTATIONS) {
      // Preserve the source casing ("Vuestra casa" → "Su casa"), same as
      // the shared lexical engine does for dictionary swaps.
      adapted = adapted.replace(from, (match) => applyCase(match, to));
    }
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
