/**
 * Post-processing agreement validator for Spanish LLM output.
 *
 * Scans translated text for:
 * - Article-noun gender mismatches (el computadora → la computadora)
 * - Article-noun number mismatches (los libro → los libros)
 * - Adjective-noun number mismatches (las casas rojo → las casas rojas)
 *
 * Returns warnings, not errors — the LLM keeps latitude to make
 * stylistic choices. This is a CHECK layer, not a constraint layer.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import { resolveNounGender, isAmbiguousNoun, type NounGender } from "@dialectos/types";
import { spanishPluralize } from "./morphology.js";

const __dirname = dirname(fileURLToPath(import.meta.url));

interface WordListData {
  commonNonNouns: string[];
  invariantNouns: string[];
  invariantAdjectives: string[];
}

const wordListData: WordListData = JSON.parse(
  readFileSync(join(__dirname, "data", "spanish-word-lists.json"), "utf-8")
);

export interface AgreementWarning {
  type: "gender" | "number";
  found: string;
  suggestion: string;
}

/**
 * Informational note (never a correction) for gender homographs whose
 * article carries meaning: "el papa" (the Pope) / "la papa" (the potato) /
 * "el papá" (the dad). The engine preserves the source article verbatim
 * and surfaces this note instead. CEO rule, 2026-09-19.
 */
export interface AgreementNote {
  type: "ambiguous-gender";
  found: string;
  noun: string;
  message: string;
}

export interface AgreementResult {
  warnings: AgreementWarning[];
  /** Informational ambiguity notes — never affect `passed`, never rewritten. */
  notes: AgreementNote[];
  passed: boolean;
}

const MASC_SINGULAR = new Set(["el", "un", "del", "al", "ese", "aquel", "este"]);
const FEM_SINGULAR = new Set(["la", "una", "esa", "aquella", "esta"]);
const PLURAL_ARTICLES = new Set(["los", "las", "unos", "unas"]);
const MASC_PLURAL = new Set(["los", "unos"]);
const FEM_PLURAL = new Set(["las", "unas"]);

const ARTICLE_NOUN_RE = /\b(el|la|los|las|un|una|unos|unas|del|al)\s+([a-záéíóúñü][a-záéíóúñü]*)/gi;

// Plural nouns end in -s or -es. Check if a noun looks plural.
const PLURAL_ENDING_RE = /[ses]$/;

// Regex to find noun + adjective pairs: article + noun + adjective
// Spanish adjectives typically follow the noun
const NOUN_ADJ_RE = /\b(?:el|la|los|las|un|una|unos|unas|del|al)\s+([a-záéíóúñü]+)\s+([a-záéíóúñü]{3,})/gi;

/**
 * Validate article-noun gender and number agreement, plus adjective-noun
 * number agreement in Spanish text.
 */
export function validateAgreement(text: string): AgreementResult {
  const warnings: AgreementWarning[] = [];
  const notes: AgreementNote[] = [];

  const articleMatches = [...text.matchAll(ARTICLE_NOUN_RE)];

  for (const match of articleMatches) {
    const article = match[1].toLowerCase();
    const noun = match[2].toLowerCase();

    if (_looksLikeNonNoun(noun)) continue;

    // Ambiguous homographs ("el papa"/"la papa"/"el papá"): the article
    // itself distinguishes meanings, so it is NEVER wrong and NEVER
    // rewritten. Emit an informational note and skip all checks for
    // this noun (including number: the engine declares itself out of
    // scope for the whole word, not just its gender).
    if (isAmbiguousNoun(noun)) {
      notes.push({
        type: "ambiguous-gender",
        found: `${match[1]} ${match[2]}`,
        noun,
        message: `"${match[2]}" is a gender homograph (e.g. "el papa" the Pope vs "la papa" the potato): the original article was preserved.`,
      });
      continue;
    }

    const gender = resolveNounGender(noun);
    if (!gender) continue;

    // --- Gender agreement ---
    const isPluralArticle = PLURAL_ARTICLES.has(article);

    if (!isPluralArticle) {
      if (MASC_SINGULAR.has(article) && gender === "f") {
        warnings.push({
          type: "gender",
          found: `${match[1]} ${match[2]}`,
          suggestion: `la ${match[2]}`,
        });
      } else if (FEM_SINGULAR.has(article) && gender === "m") {
        warnings.push({
          type: "gender",
          found: `${match[1]} ${match[2]}`,
          suggestion: `el ${match[2]}`,
        });
      }
    } else {
      // Plural articles: check gender + number
      const nounIsPlural = PLURAL_ENDING_RE.test(noun);

      if (MASC_PLURAL.has(article) && gender === "f" && nounIsPlural) {
        warnings.push({
          type: "gender",
          found: `${match[1]} ${match[2]}`,
          suggestion: `las ${match[2]}`,
        });
      } else if (FEM_PLURAL.has(article) && gender === "m" && nounIsPlural) {
        warnings.push({
          type: "gender",
          found: `${match[1]} ${match[2]}`,
          suggestion: `los ${match[2]}`,
        });
      }

      // --- Number agreement ---
      // Plural article + singular noun = likely number mismatch
      if (!nounIsPlural && isPluralArticle) {
        // Only flag if the noun is clearly singular (doesn't end in s)
        // Some nouns are invariant (e.g., "crisis", "lunes")
        if (!_isInvariantNoun(noun)) {
          const pluralNoun = spanishPluralize(noun);
          if (pluralNoun !== noun) {
            warnings.push({
              type: "number",
              found: `${match[1]} ${match[2]}`,
              suggestion: `${match[1]} ${pluralNoun}`,
            });
          }
        }
      }
    }
  }

  // --- Adjective-noun number agreement ---
  const nounAdjMatches = [...text.matchAll(NOUN_ADJ_RE)];
  for (const match of nounAdjMatches) {
    const noun = match[1].toLowerCase();
    const adj = match[2].toLowerCase();

    if (_looksLikeNonNoun(noun) || _looksLikeNonNoun(adj)) continue;

    const nounIsPlural = PLURAL_ENDING_RE.test(noun);
    const adjIsPlural = PLURAL_ENDING_RE.test(adj);

    // If noun is plural but adjective is singular → number mismatch
    if (nounIsPlural && !adjIsPlural && adj.length > 3) {
      // Don't flag invariable adjectives (e.g., "verde", "joven", "grande")
      if (!_isInvariantAdjective(adj)) {
        const pluralAdj = spanishPluralize(adj);
        if (pluralAdj !== adj) {
          warnings.push({
            type: "number",
            found: `${noun} ${adj}`,
            suggestion: `${noun} ${pluralAdj}`,
          });
        }
      }
    }
  }

  return {
    warnings,
    notes,
    passed: warnings.length === 0,
  };
}

/**
 * Apply agreement corrections to text.
 */
export function applyAgreementFixes(text: string): string {
  const { warnings } = validateAgreement(text);
  if (warnings.length === 0) return text;

  let result = text;
  for (const w of warnings) {
    if (w.type !== "gender") continue;
    result = result.replace(w.found, w.suggestion);
  }
  return result;
}

// --- Helpers ---

const commonNonNouns = new Set(wordListData.commonNonNouns);
const INVARIANT_NOUNS = new Set(wordListData.invariantNouns);
const INVARIANT_ADJECTIVES = new Set(wordListData.invariantAdjectives);

function _looksLikeNonNoun(word: string): boolean {
  if (word.length <= 2) return true;

  if (commonNonNouns.has(word)) return true;
  if (word.endsWith("mente")) return true;

  return false;
}

function _isInvariantNoun(noun: string): boolean {
  return INVARIANT_NOUNS.has(noun);
}

function _isInvariantAdjective(adj: string): boolean {
  return INVARIANT_ADJECTIVES.has(adj);
}
