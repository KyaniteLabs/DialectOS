import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import type { SpanishDialect } from "./index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dictionaryData = JSON.parse(
  readFileSync(join(__dirname, "dialectal-dictionary.json"), "utf-8")
);

export type SemanticField =
  | "technology" | "transport" | "food" | "household" | "clothing"
  | "actions" | "social" | "people" | "education" | "body_parts" | "nature"
  | "medicine_health" | "family_kinship" | "finance_banking" | "accessibility"
  | "core_vocabulary";

export interface Variant {
  term: string;
  frequency: 1 | 2 | 3;
  register: "formal" | "informal" | "universal";
  notes?: string;
  /** When true, this variant has a common non-slang meaning and should not
   *  be used as an avoid-term for lexical substitution. Prevents false
   *  positives like "botón" (button) being swapped to "tomba" (cop slang). */
  ambiguous?: boolean;
  /** Other words native speakers of this variant also use for the concept ("nevera" in es-ES). Not flagged. */
  alsoAccepted?: string[];
}

export interface DictionaryEntry {
  field: SemanticField;
  concept: string;
  englishGloss: string;
  panHispanic?: string;
  /** Everyday English words for the concept beyond its name ("fridge" for refrigerator), so the source check finds it. */
  englishTerms?: string[];
  variants?: Partial<Record<SpanishDialect, Variant>>;
}

export const DICTIONARY: readonly DictionaryEntry[] = dictionaryData as readonly DictionaryEntry[];
