/**
 * i18n apply-gender-neutral command handler
 * Applies gender-neutral language strategies to locale files
 */

import type { I18nEntry, GenderNeutralStrategy, VariantResult } from "@espanol/types";
import { readLocaleFile, writeLocaleFile } from "@espanol/locale-utils";
import { validateFilePath } from "@espanol/security";

/**
 * Options for the apply-gender-neutral command
 */
export interface ApplyGenderNeutralOptions {
  /** Path to locale file */
  locale: string;
  /** Gender-neutral strategy to apply */
  strategy: GenderNeutralStrategy;
}

/**
 * Common gendered nouns that should be transformed
 * These are high-frequency words that commonly appear in i18n files
 * IMPORTANT: Order matters - more specific words must come before general patterns
 */
const COMMON_GENDERED_WORDS: Record<
  GenderNeutralStrategy,
  Array<{ from: RegExp; to: string }>
> = {
  latine: [
    { from: /\btodos\b/g, to: "todes" },
    { from: /\bTodos\b/g, to: "Todes" },
    { from: /\bTODOS\b/g, to: "TODES" },
    { from: /\btodas\b/g, to: "todes" },
    { from: /\bTodas\b/g, to: "Todes" },
    { from: /\bTODAS\b/g, to: "TODES" },
    { from: /\bbienvenidos\b/g, to: "bienvenides" },
    { from: /\bBienvenidos\b/g, to: "Bienvenides" },
    { from: /\bBIENVENIDOS\b/g, to: "BIENVENIDES" },
    { from: /\bbienvenidas\b/g, to: "bienvenides" },
    { from: /\bBienvenidas\b/g, to: "Bienvenides" },
    { from: /\bBIENVENIDAS\b/g, to: "BIENVENIDES" },
    { from: /\bamigos\b/g, to: "amigues" },
    { from: /\bAmigos\b/g, to: "Amigues" },
    { from: /\bAMIGOS\b/g, to: "AMIGUES" },
    { from: /\bamigas\b/g, to: "amigues" },
    { from: /\bAmigas\b/g, to: "Amigues" },
    { from: /\bAMIGAS\b/g, to: "AMIGUES" },
    { from: /\bcompañeros\b/g, to: "compañeres" },
    { from: /\bCompañeros\b/g, to: "Compañeres" },
    { from: /\bCOMPANEROS\b/g, to: "COMPANERES" },
    { from: /\bcompañeras\b/g, to: "compañeres" },
    { from: /\bCompañeras\b/g, to: "Compañeres" },
    { from: /\bCOMPANERAS\b/g, to: "COMPANERES" },
    { from: /\bniños\b/g, to: "niñes" },
    { from: /\bNiños\b/g, to: "Niñes" },
    { from: /\bNIÑOS\b/g, to: "NIÑES" },
    { from: /\bniñas\b/g, to: "niñes" },
    { from: /\bNiñas\b/g, to: "Niñes" },
    { from: /\bNIÑAS\b/g, to: "NIÑES" },
    { from: /\busuarios\b/g, to: "usuaries" },
    { from: /\bUsuarios\b/g, to: "Usuaries" },
    { from: /\bUSUARIOS\b/g, to: "USUARIES" },
    { from: /\busuarias\b/g, to: "usuaries" },
    { from: /\bUsuarias\b/g, to: "Usuaries" },
    { from: /\bUSUARIAS\b/g, to: "USUARIES" },
  ],

  elles: [
    { from: /\btodos\b/g, to: "elles" },
    { from: /\bTodos\b/g, to: "Elles" },
    { from: /\bTODOS\b/g, to: "ELLES" },
    { from: /\btodas\b/g, to: "elles" },
    { from: /\bTodas\b/g, to: "Elles" },
    { from: /\bTODAS\b/g, to: "ELLES" },
    { from: /\bbienvenidos\b/g, to: "bienvenides" },
    { from: /\bBienvenidos\b/g, to: "Bienvenides" },
    { from: /\bBIENVENIDOS\b/g, to: "BIENVENIDES" },
    { from: /\bbienvenidas\b/g, to: "bienvenides" },
    { from: /\bBienvenidas\b/g, to: "Bienvenides" },
    { from: /\bBIENVENIDAS\b/g, to: "BIENVENIDES" },
    { from: /\bamigos\b/g, to: "amigues" },
    { from: /\bAmigos\b/g, to: "Amigues" },
    { from: /\bAMIGOS\b/g, to: "AMIGUES" },
    { from: /\bamigas\b/g, to: "amigues" },
    { from: /\bAmigas\b/g, to: "Amigues" },
    { from: /\bAMIGAS\b/g, to: "AMIGUES" },
  ],

  x: [
    { from: /\btodos\b/g, to: "todxs" },
    { from: /\bTodos\b/g, to: "Todxs" },
    { from: /\bTODOS\b/g, to: "TODXS" },
    { from: /\btodas\b/g, to: "todxs" },
    { from: /\bTodas\b/g, to: "Todxs" },
    { from: /\bTODAS\b/g, to: "TODXS" },
    { from: /\bbienvenidos\b/g, to: "bienvenidxs" },
    { from: /\bBienvenidos\b/g, to: "Bienvenidxs" },
    { from: /\bBIENVENIDOS\b/g, to: "BIENVENIDXS" },
    { from: /\bbienvenidas\b/g, to: "bienvenidxs" },
    { from: /\bBienvenidas\b/g, to: "Bienvenidxs" },
    { from: /\bBIENVENIDAS\b/g, to: "BIENVENIDXS" },
    { from: /\bamigos\b/g, to: "amigxs" },
    { from: /\bAmigos\b/g, to: "Amigxs" },
    { from: /\bAMIGOS\b/g, to: "AMIGXS" },
    { from: /\bamigas\b/g, to: "amigxs" },
    { from: /\bAmigas\b/g, to: "Amigxs" },
    { from: /\bAMIGAS\b/g, to: "AMIGXS" },
  ],

  descriptive: [
    // Only include masculine forms - they will be expanded to "feminine y masculine"
    { from: /\btodos\b/g, to: "todas y todos" },
    { from: /\bTodos\b/g, to: "Todas y todos" },
    { from: /\bTODOS\b/g, to: "TODAS Y TODOS" },
    { from: /\bbienvenidos\b/g, to: "bienvenidas y bienvenidos" },
    { from: /\bBienvenidos\b/g, to: "Bienvenidas y bienvenidos" },
    { from: /\bBIENVENIDOS\b/g, to: "BIENVENIDAS Y BIENVENIDOS" },
    { from: /\bamigos\b/g, to: "amigas y amigos" },
    { from: /\bAmigos\b/g, to: "Amigas y amigos" },
    { from: /\bAMIGOS\b/g, to: "AMIGAS Y AMIGOS" },
  ],
};

/**
 * Apply gender-neutral transformation to a single value
 */
function applyGenderNeutral(value: string, strategy: GenderNeutralStrategy): string {
  let result = value;

  // Apply common word replacements (most specific first)
  const patterns = COMMON_GENDERED_WORDS[strategy];
  for (const pattern of patterns) {
    result = result.replace(pattern.from, pattern.to);
  }

  return result;
}

/**
 * Execute the apply-gender-neutral command
 */
export async function executeApplyGenderNeutral(
  options: ApplyGenderNeutralOptions
): Promise<VariantResult> {
  // Validate and read locale file
  const validatedPath = validateFilePath(options.locale);
  const entries = readLocaleFile(validatedPath);

  // Apply gender-neutral transformations
  const transformedEntries: I18nEntry[] = [];
  const changes: string[] = [];

  for (const entry of entries) {
    const originalValue = entry.value;
    const transformedValue = applyGenderNeutral(originalValue, options.strategy);

    if (transformedValue !== originalValue) {
      changes.push(`${entry.key}: "${originalValue}" → "${transformedValue}"`);
    }

    transformedEntries.push({
      key: entry.key,
      value: transformedValue,
    });
  }

  // Write transformed locale back to file
  writeLocaleFile(validatedPath, transformedEntries);

  return {
    adapted: changes.length > 0,
    changes,
  };
}
