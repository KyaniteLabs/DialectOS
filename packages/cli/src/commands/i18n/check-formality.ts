/**
 * i18n check-formality command handler
 * Checks locale files for formality consistency
 */

import type { I18nEntry, FormalityIssue } from "@espanol/types";
import { readLocaleFile } from "@espanol/locale-utils";
import { validateFilePath } from "@espanol/security";

/**
 * Options for the check-formality command
 */
export interface CheckFormalityOptions {
  /** Path to locale file */
  locale: string;
  /** Register to check against (formal or informal) */
  register: "formal" | "informal";
}

/**
 * Formality check result
 */
export interface FormalityCheckResult {
  /** Number of keys checked */
  totalKeys: number;
  /** Formality issues found */
  issues: FormalityIssue[];
}

/**
 * Informal pronouns (for formal register checks)
 * Each pattern has the word to match and its formal replacement
 */
const INFORMAL_PRONOUNS: Array<{ word: string; formal: string; description: string }> = [
  { word: "tú", formal: "usted", description: "2nd person singular informal" },
  { word: "vos", formal: "usted", description: "2nd person singular informal (voseo)" },
  { word: "vosotros", formal: "ustedes", description: "2nd person plural informal" },
];

/**
 * Informal verb conjugations (for formal register checks)
 * Maps informal verbs to their formal equivalents
 */
const INFORMAL_VERBS: Array<{ word: string; formal: string; description: string }> = [
  { word: "estás", formal: "está", description: "2nd person singular verb" },
  { word: "vais", formal: "van", description: "2nd person plural verb" },
  { word: "tienes", formal: "tiene", description: "2nd person singular verb" },
  { word: "vienes", formal: "viene", description: "2nd person singular verb" },
  { word: "sales", formal: "sale", description: "2nd person singular verb" },
  { word: "hablas", formal: "habla", description: "2nd person singular verb" },
  { word: "comes", formal: "come", description: "2nd person singular verb" },
  { word: "bebes", formal: "bebe", description: "2nd person singular verb" },
  { word: "quieres", formal: "quiere", description: "2nd person singular verb" },
  { word: "sabes", formal: "sabe", description: "2nd person singular verb" },
  { word: "haces", formal: "hace", description: "2nd person singular verb" },
  { word: "puedes", formal: "puede", description: "2nd person singular verb" },
  { word: "estáis", formal: "están", description: "2nd person plural verb" },
  { word: "tenéis", formal: "tienen", description: "2nd person plural verb" },
  { word: "venís", formal: "vienen", description: "2nd person plural verb" },
  { word: "salís", formal: "salen", description: "2nd person plural verb" },
  { word: "habláis", formal: "hablan", description: "2nd person plural verb" },
  { word: "coméis", formal: "comen", description: "2nd person plural verb" },
  { word: "bebéis", formal: "beben", description: "2nd person plural verb" },
  { word: "queréis", formal: "quieren", description: "2nd person plural verb" },
  { word: "sabéis", formal: "saben", description: "2nd person plural verb" },
  { word: "hacéis", formal: "hacen", description: "2nd person plural verb" },
  { word: "podéis", formal: "pueden", description: "2nd person plural verb" },
];

/**
 * Formal pronouns (for informal register checks)
 */
const FORMAL_PRONOUNS: Array<{ word: string; informal: string; description: string }> = [
  { word: "usted", informal: "tú", description: "2nd person singular formal" },
  { word: "ustedes", informal: "vosotros", description: "2nd person plural formal" },
];

/**
 * Check a single value for formality issues
 */
function checkValueFormality(
  key: string,
  value: string,
  register: "formal" | "informal"
): FormalityIssue | null {
  if (register === "formal") {
    // Check for informal pronouns in formal register
    for (const pattern of INFORMAL_PRONOUNS) {
      // Use lookahead/lookbehind for word boundaries that work with Unicode
      const regex = new RegExp(`(?<!\\w)${pattern.word}(?!\\w)`, "i");
      if (regex.test(value)) {
        return {
          key,
          value,
          suggestion: `Consider using formal register: "${pattern.formal}" instead of "${pattern.word}"`,
        };
      }
    }

    // Check for informal verbs in formal register
    for (const pattern of INFORMAL_VERBS) {
      const regex = new RegExp(`(?<!\\w)${pattern.word}(?!\\w)`, "i");
      if (regex.test(value)) {
        return {
          key,
          value,
          suggestion: `Consider using formal register: "${pattern.formal}" instead of "${pattern.word}"`,
        };
      }
    }
  } else {
    // Check for formal patterns in informal register
    for (const pattern of FORMAL_PRONOUNS) {
      const regex = new RegExp(`(?<!\\w)${pattern.word}(?!\\w)`, "i");
      if (regex.test(value)) {
        return {
          key,
          value,
          suggestion: `Consider using informal register: "${pattern.informal}" instead of "${pattern.word}"`,
        };
      }
    }
  }

  return null;
}

/**
 * Execute the check-formality command
 */
export async function executeCheckFormality(
  options: CheckFormalityOptions
): Promise<FormalityCheckResult> {
  // Validate and read locale file
  const validatedPath = validateFilePath(options.locale);
  const entries = readLocaleFile(validatedPath);

  const issues: FormalityIssue[] = [];

  for (const entry of entries) {
    const issue = checkValueFormality(entry.key, entry.value, options.register);
    if (issue) {
      issues.push(issue);
    }
  }

  return {
    totalKeys: entries.length,
    issues,
  };
}
